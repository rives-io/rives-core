import os
from pydantic import BaseModel
import logging
from typing import Optional, List, Annotated
import json
from py_expression_eval import Parser
import pickle
import traceback

from cartesi.abi import String, Bytes, Bytes32, UInt, Bool, ABIType

from cartesapp.storage import Entity, helpers, Storage, seed
from cartesapp.utils import hex2bytes, str2bytes, bytes2str

from .riv import riv_get_cartridge_info, riv_get_cover, verify_log
from .core_settings import CoreSettings, generate_cartridge_id, get_cartridges_path, is_inside_cm, \
    get_cartridge_tapes_filename, generate_rule_id, generate_rule_parameters_tag, \
    format_cartridge_id_from_bytes, format_tape_id_from_bytes

LOGGER = logging.getLogger(__name__)


###
# Model

UInt256List = Annotated[List[int], ABIType('uint256[]')]
Int256List = Annotated[List[int], ABIType('int256[]')]
Bytes32List = Annotated[List[bytes], ABIType('bytes32[]')]
StringList = Annotated[List[str], ABIType('string[]')]
AddressList = Annotated[List[str], ABIType('address[]')]
BytesList = Annotated[List[bytes], ABIType('bytes[]')]
Bytes32ListList = Annotated[List[bytes], ABIType('bytes32[][]')]

# TODO: TypeError: unhashable type: 'ABIType' allow python cartesi types
class Cartridge(Entity):
    id              = helpers.PrimaryKey(str, 64)
    name            = helpers.Required(str, index=True)
    user_address    = helpers.Required(str, 42, index=True)
    info            = helpers.Optional(helpers.Json, lazy=True)
    original_info   = helpers.Optional(helpers.Json, lazy=True)
    created_at      = helpers.Required(int, unsigned=True)
    updated_at      = helpers.Required(int, unsigned=True)
    input_index     = helpers.Required(int, lazy=True) # -1 means not created by an input (created in genesis)
    cover           = helpers.Optional(bytes, lazy=True)
    active          = helpers.Optional(bool, lazy=True, index=True)
    primary         = helpers.Optional(bool, index=True)
    primary_id      = helpers.Optional(str, 64, lazy=True)
    versions        = helpers.Optional(helpers.StrArray, lazy=True)
    last_version    = helpers.Optional(str, 64)
    tapes           = helpers.Optional(helpers.StrArray, lazy=True)
    tags            = helpers.Set("CartridgeTag")
    authors         = helpers.Set("CartridgeAuthor")

class CartridgeTag(Entity):
    cartridges      = helpers.Set(Cartridge)
    name            = helpers.PrimaryKey(str)

class CartridgeAuthor(Entity):
    cartridges      = helpers.Set(Cartridge)
    name            = helpers.PrimaryKey(str)

class Rule(Entity):
    id              = helpers.PrimaryKey(str, 64)
    name            = helpers.Required(str, index=True)
    description     = helpers.Optional(str)
    cartridge_id    = helpers.Required(str, 64, index=True)
    created_by      = helpers.Required(str, 42, index=True)
    created_at      = helpers.Required(int, unsigned=True)
    input_index     = helpers.Required(int, lazy=True) # -1 means not created by an input (created in genesis or default rule)
    args            = helpers.Optional(str)
    in_card         = helpers.Optional(bytes)
    score_function  = helpers.Optional(str)
    start           = helpers.Optional(int, unsigned=True, index=True)
    end             = helpers.Optional(int, unsigned=True, index=True)
    tapes           = helpers.Optional(helpers.StrArray, lazy=True)
    allow_tapes     = helpers.Optional(bool, lazy=True)
    allow_in_card   = helpers.Optional(bool, lazy=True)
    save_tapes      = helpers.Optional(bool, lazy=True)
    save_out_cards  = helpers.Optional(bool, lazy=True)
    tags            = helpers.Set("RuleTag")

class RuleTag(Entity):
    rules           = helpers.Set(Rule)
    cartridge_id    = helpers.Required(str, 64, index=True)
    name            = helpers.Required(str, index=True)
    helpers.PrimaryKey(cartridge_id, name)

class Tape(Entity):
    id              = helpers.PrimaryKey(str, 64)
    cartridge_id    = helpers.Required(str, 64, index=True)
    rule_id         = helpers.Required(str, 64, index=True)
    user_address    = helpers.Required(str, 42, index=True)
    timestamp       = helpers.Required(int, unsigned=True, index=True)
    input_index     = helpers.Required(int, lazy=True)
    score           = helpers.Optional(int, lazy=True)
    verified        = helpers.Optional(bool, lazy=True)
    rank            = helpers.Optional(int, lazy=True)
    out_card        = helpers.Optional(bytes, lazy=True)
    in_card         = helpers.Optional(bytes, lazy=True)
    tapes           = helpers.Optional(helpers.StrArray, lazy=True)
    data            = helpers.Optional(bytes, lazy=True)

class RuleData(BaseModel):
    cartridge_id:       Bytes32
    name:               String
    description:        String
    args:               String
    in_card:            Bytes
    score_function:     String
    start:              UInt
    end:                UInt
    tags:               StringList
    tapes:              Bytes32List
    allow_tapes:        Bool
    allow_in_card:      Bool
    save_tapes:         Bool
    save_out_cards:     Bool

class Author(BaseModel):
    name:           str
    link:           str

class InfoCartridge(BaseModel):
    name:           str
    summary:        Optional[str]
    description:    Optional[str]
    version:        Optional[str]
    status:         Optional[str]
    tags:           List[str]
    authors:        Optional[List[Author]]
    links:          Optional[List[str]]
    tapes:          Optional[List[str]]


# class TapeHash:
#     cartridge_tapes = {} # {"rules":{}}
#     def __new__(cls):
#         return cls

#     @classmethod
#     def get_cartridge_tapes(cls):
#         cartridge_tapes = {} # {"rules":{}}
#         if Storage.STORAGE_PATH is not None:
#             if os.path.exists(get_cartridge_tapes_filename()):
#                 f = open(get_cartridge_tapes_filename(), 'rb')
#                 cartridge_tapes = pickle.load(f)
#                 f.close()
#         else:
#             cartridge_tapes = cls.cartridge_tapes
#         return cartridge_tapes

#     @classmethod
#     def store_cartridge_tape(cls,cartridge_tapes):
#         if Storage.STORAGE_PATH is not None:
#             with open(get_cartridge_tapes_filename(), 'wb') as f:
#                 pickle.dump(cartridge_tapes, f)
#         else:
#             cls.cartridge_tapes = cartridge_tapes

#     @classmethod
#     def add(cls, tape_hash):
#         cartridge_tapes = cls.get_cartridge_tapes()
#         cartridge_tapes[tape_hash] = False
#         cls.store_cartridge_tape(cartridge_tapes)

#     @classmethod
#     def check_duplicate(cls, tape_hash):
#         cartridge_tapes = cls.get_cartridge_tapes()
#         return tape_hash in cartridge_tapes

#     @classmethod
#     def check_verified(cls, tape_hash):
#         cartridge_tapes = cls.get_cartridge_tapes()
#         return tape_hash in cartridge_tapes \
#             and cartridge_tapes[tape_hash] is not None
    
#     @classmethod
#     def set_verified(cls,tape_hash, out_card):
#         cartridge_tapes = cls.get_cartridge_tapes()
#         cartridge_tapes[tape_hash] = out_card
#         cls.store_cartridge_tape(cartridge_tapes)

#     @classmethod
#     def get_outcard(cls, tape_hash):
#         cartridge_tapes = cls.get_cartridge_tapes()
#         return cartridge_tapes.get(tape_hash)
    
###
# Seeds

@seed()
def initialize_data():
    cartridge_ids = {}
    cartridge_data = {}
    for cartridge in CoreSettings().genesis_cartridges:
        try:
            cartridge_path = f"misc/{cartridge}.sqfs"
            with open(cartridge_path,'rb') as cartridge_example_file:
                cartridge_example_data = cartridge_example_file.read()
                cartridge_ids[cartridge] = generate_cartridge_id(cartridge_example_data)
                cartridge_data[cartridge] = cartridge_example_data
                create_cartridge(cartridge_example_data,msg_sender=CoreSettings().operator_address)
                if is_inside_cm(): os.remove(cartridge_path)
        except Exception as e:
            LOGGER.warning(e)
            traceback.print_exc()

    for genesis_rule_cartridge in CoreSettings().genesis_rules:
        if cartridge_ids.get(genesis_rule_cartridge) is not None:
            try:
                rule_conf_dict = {
                    "cartridge_id":hex2bytes(cartridge_ids[genesis_rule_cartridge]),
                    "name":str(CoreSettings().genesis_rules[genesis_rule_cartridge].get("name")),
                    "description":str(CoreSettings().genesis_rules[genesis_rule_cartridge].get("description") or ""),
                    "args":str(CoreSettings().genesis_rules[genesis_rule_cartridge].get("args") or ""),
                    "in_card":bytes.fromhex(str(CoreSettings().genesis_rules[genesis_rule_cartridge].get('in_card') or "")),
                    "score_function":str(CoreSettings().genesis_rules[genesis_rule_cartridge].get("score_function") or ""),
                    "start":int(CoreSettings().genesis_rules[genesis_rule_cartridge].get("start") or 0),
                    "end":  int(CoreSettings().genesis_rules[genesis_rule_cartridge].get("end") or 0),
                    "tags": ["genesis"],
                    "tapes": [],
                    "allow_tapes": False,
                    "allow_in_card": False,
                    "save_tapes": False,
                    "save_out_cards": False,
                }
                rule_conf = RuleData.parse_obj(rule_conf_dict)

                cartridge = Cartridge.get(lambda r: r.id == cartridge_ids[genesis_rule_cartridge])
                if cartridge is None:
                    raise Exception(f"Couldn't find cartridge")

                rule_id = generate_rule_id(
                    hex2bytes(cartridge.primary_id or cartridge.id),
                    hex2bytes(cartridge.id),
                    str2bytes(rule_conf.name))
                if helpers.count(r for r in Rule if r.id == rule_id) > 0:
                    raise Exception(f"Rule already exists")
                test_replay_file = open(CoreSettings().test_tape_path,'rb')
                test_replay = test_replay_file.read()
                test_replay_file.close()

                verification_output = verify_log(cartridge_data[genesis_rule_cartridge],test_replay,rule_conf_dict["args"],rule_conf_dict["in_card"])
                insert_rule(rule_id, rule_conf, verification_output.get("outcard"), msg_sender=CoreSettings().operator_address)
            except Exception as e:
                LOGGER.warning(e)
                traceback.print_exc()

###
# Helpers

def create_default_rule(cartridge: Cartridge, outcard_raw: bytes, **metadata):
    rule_conf_dict = {
        "cartridge_id":hex2bytes(cartridge.id),
        "name":"default",
        "description":"",
        "args":"",
        "in_card":b"",
        "score_function":"",
        "start":0,
        "end":0,
        "tags":["default"],
        "tapes": [],
        "allow_tapes": False,
        "allow_in_card": False,
        "save_tapes": False,
        "save_out_cards": False,
    }
    if outcard_raw[:4] == b"JSON":
        try:
            if json.loads(outcard_raw[4:]).get('score') is not None:
                rule_conf_dict["score_function"] = "score"
        except Exception as e:
            LOGGER.info(f"Couldn't parse json outcard: {e}, ignoring score function")

    rule_conf = RuleData.parse_obj(rule_conf_dict)
    rule_id = generate_rule_id(
        hex2bytes(cartridge.primary_id or cartridge.id),
        hex2bytes(cartridge.id),
        str2bytes(rule_conf.name))
    return insert_rule_db(rule_id, rule_conf,**metadata)
    
def insert_rule(rule_id:str, rule_conf: RuleData,outcard_raw: bytes,**metadata):
    # str2bytes(metadata.msg_sender) + metadata.timestamp.to_bytes(32, byteorder='big')

    if rule_conf.start > 0 and rule_conf.end > 0 and rule_conf.start > rule_conf.end:
        raise Exception(f"Inconsistent start and end time")
    # process outcard
    # function_log = "no function"
    if rule_conf.score_function is not None and len(rule_conf.score_function) > 0:
        outcard_format = outcard_raw[:4]
        if outcard_format != b"JSON":
            raise Exception(f"Outcard format is not json")

        outcard_str = bytes2str(outcard_raw[4:])

        LOGGER.info(f"==== BEGIN OUTCARD ({outcard_format}) ====")
        LOGGER.info(outcard_str)
        LOGGER.info("==== END OUTCARD ====")

        try:
            outcard_json = json.loads(outcard_str)
        except Exception as e:
            raise Exception(f"Couldn't parse json outcard: {e}")

        try:
            parser = Parser()
            score = parser.parse(rule_conf.score_function).evaluate(outcard_json)
        except Exception as e:
            raise Exception(f"Couldn't parse score: {e}")
        # function_log = f"function {rule_conf.score_function}"
    # LOGGER.info(f"Creating rule {rule_conf.name} (id={rule_id}) with {function_log}")

    # convert tapes to hex id
    rule_conf.tapes = [t.hex() for t in rule_conf.tapes]

    return insert_rule_db(rule_id,rule_conf,**metadata)
    
def insert_rule_db(rule_id:str, rule_conf: RuleData,**metadata):

    if helpers.count(r for r in Rule if r.id == rule_id) > 0:
        raise Exception(f"Rule already exists")
    
    LOGGER.info(f"Creating rule {rule_conf.name} (id={rule_id})")

    user_address = metadata.get('msg_sender')
    if user_address is not None: user_address = user_address.lower()

    payload_cartridge = format_cartridge_id_from_bytes(rule_conf.cartridge_id)

    new_rule = Rule(
        id = rule_id,
        cartridge_id = payload_cartridge,
        name = rule_conf.name,
        description = rule_conf.description,
        created_by = user_address,
        created_at = metadata.get('timestamp') or 0,
        input_index = metadata.get('input_index') or -1, # not created by an input (genesis or default rule)
        args = rule_conf.args,
        in_card = rule_conf.in_card,
        score_function = rule_conf.score_function,
        start = rule_conf.start if rule_conf.start > 0 else None,
        end = rule_conf.end if rule_conf.end > 0 else None,
        tapes = rule_conf.tapes,
        allow_tapes = rule_conf.allow_tapes,
        allow_in_card = rule_conf.allow_in_card,
        save_tapes = rule_conf.save_tapes,
        save_out_cards = rule_conf.save_out_cards,
    )

    tags = list(rule_conf.tags)
    tags.append(generate_rule_parameters_tag(rule_conf.args,rule_conf.in_card,rule_conf.score_function))
    for tag in tags:
        rule_tag = RuleTag.get(lambda r: r.name == tag and r.cartridge_id == payload_cartridge)
        if rule_tag is None:
            rule_tag = RuleTag(name = tag, cartridge_id = payload_cartridge)
        rule_tag.rules.add(new_rule)

    # LOGGER.info(f"{new_rule=}")

    return new_rule


def create_cartridge(cartridge_data, **metadata):
    data_hash = generate_cartridge_id(cartridge_data)
    
    if metadata.get('timestamp') is None: metadata['timestamp'] = 0

    user_address = metadata.get('msg_sender')
    if user_address is not None: user_address = user_address.lower()

    if helpers.count(c for c in Cartridge if c.id == data_hash) > 0:
        raise Exception(f"Cartridge hash already exists")

    cartridges_path = get_cartridges_path()
    if not os.path.exists(cartridges_path):
        os.makedirs(cartridges_path)
    cartridge_filepath = f"{cartridges_path}/{data_hash}"

    with open(cartridge_filepath,'wb') as cartridge_file:
        cartridge_file.write(cartridge_data)

    cartridge_info = riv_get_cartridge_info(cartridge_filepath)
    
    # validate info
    cartridge_info_json = json.loads(cartridge_info)
    InfoCartridge(**cartridge_info_json)

    # check if cartridge already exists
    cartridge = Cartridge.get(lambda r: r.name == cartridge_info_json['name'] and r.primary)
    if cartridge is not None:
        # check user
        if cartridge.user_address != user_address:
            raise Exception(f"Not the same user")

    # check if cartridge runs
    test_replay_file = open(CoreSettings().test_tape_path,'rb')
    test_replay = test_replay_file.read()
    test_replay_file.close()

    # parse tapes to incard
    incard = b""
    if cartridge_info_json.get("tapes") is not None:
        incard = format_incard(map(lambda x: format_tape_id_from_bytes(hex2bytes(x)), cartridge_info_json["tapes"]),[b''])

    verification_output = verify_log(cartridge_data,test_replay,'',incard,get_screenshot=True)
    screenshot = verification_output.get("screenshot")

    cartridge_cover = riv_get_cover(cartridge_filepath)
    if cartridge_cover is None or len(cartridge_cover) == 0:
        #cartridge_cover = riv_get_cartridge_screenshot(data_hash,0)
        cartridge_cover = screenshot

    LOGGER.info(f"Creating cartridge {cartridge_info_json['name']} (id={data_hash})")


    tapes = []
    if cartridge_info_json.get("tapes") is not None:
        tapes = cartridge_info_json["tapes"]
    authors = []
    if cartridge_info_json.get('authors') is not None:
        for author_json in cartridge_info_json['authors']:
            if author_json.get('name') is not None:
                author = CartridgeAuthor.get(lambda r: r.name == author_json['name'])
                if author is None: author = CartridgeAuthor(name=author_json['name'])
                authors.append(author)

    if cartridge is None:
        cartridge = Cartridge(
            id = data_hash,
            name = cartridge_info_json['name'],
            authors = authors,
            user_address = user_address,
            created_at = metadata.get('timestamp') or 0,
            input_index = metadata.get('input_index') or -1, # genesis input index
            updated_at = metadata.get('timestamp') or 0,
            info = cartridge_info_json,
            original_info = cartridge_info_json,
            cover = cartridge_cover,
            active = True,
            primary = True,
            tapes = tapes,
            versions = [data_hash],
            last_version = data_hash
        )
        new_cartridge = cartridge
    else:
        cartridge.authors = authors if cartridge_info_json.get('authors') else cartridge.authors
        cartridge.updated_at = metadata.get('timestamp') or 0
        cartridge.info = cartridge_info_json
        cartridge.cover = cartridge_cover
        cartridge.active = True
        cartridge.versions.append(data_hash)
        cartridge.last_version = data_hash

        new_cartridge = Cartridge(
            id = data_hash,
            name = cartridge_info_json['name'],
            authors = authors,
            user_address = user_address,
            created_at = metadata.get('timestamp') or 0,
            input_index = metadata.get('input_index') or -1, # genesis input index
            updated_at = metadata.get('timestamp') or 0,
            info = cartridge_info_json,
            active = True,
            primary = False,
            primary_id = cartridge.id,
            tapes = tapes
        )
    if cartridge_info_json.get("tags") is not None and len(cartridge_info_json['tags']) > 0:
        tags = list(cartridge_info_json['tags'])
        for tag in tags:
            cartridge_tag = CartridgeTag.get(lambda r: r.name == tag)
            if cartridge_tag is None:
                cartridge_tag = CartridgeTag(name = tag)
            cartridge_tag.cartridges.add(new_cartridge)

    metadata['input_index'] = -1 # not created by an input
    # LOGGER.info(f"{new_cartridge=}")

    # create default rule with no arguments, incard, score
    create_default_rule(new_cartridge, verification_output.get("outcard"), **metadata)

    return new_cartridge

def delete_cartridge(cartridge_id,**metadata):
    cartridge = Cartridge.get(lambda c: c.id == cartridge_id and c.active)
    if cartridge is None:
        raise Exception(f"Cartridge doesn't exist")

    # if cartridge.user_address != metadata['msg_sender'].lower() and \
    #         metadata['msg_sender'].lower() != CoreSettings().operator_address.lower():
    if metadata['msg_sender'].lower() != CoreSettings().operator_address:
        raise Exception(f"Sender not allowed")
    
    cartridges_deleted = []
    if cartridge.primary:
        primary_cartridge = cartridge
        for c in primary_cartridge.versions:
            if c != cartridge_id:
                cartridges_deleted.extend(delete_cartridge(c,**metadata))
    else: 
        primary_cartridge = Cartridge.get(lambda c: c.id == cartridge.primary_id and c.active)

    primary_cartridge.versions.remove(cartridge_id)
    if (primary_cartridge.last_version == cartridge_id):
        if len(primary_cartridge.versions) > 0:
            primary_cartridge.last_version = primary_cartridge.versions[-1]
        else:
            primary_cartridge.last_version = ''
            primary_cartridge.active = False

    with open(f"{get_cartridges_path()}/{cartridge_id}",'rb')as cartridge_file:
        cartridge_data = cartridge_file.read()
    cur_cartridge = (cartridge,cartridge_data)
    cartridges_deleted.append(cur_cartridge)

    cartridge.active = False
    cartridge.cover = None
    os.remove(f"{get_cartridges_path()}/{cartridge_id}")

    return cartridges_deleted

def change_cartridge_user_address(cartridge_id,new_user_address, internal_call=False, **metadata):
    cartridge = Cartridge.get(lambda c: c.id == cartridge_id and c.active)
    if cartridge is None:
        raise Exception(f"Cartridge doesn't exist")

    if cartridge.user_address != metadata['msg_sender'].lower():
        raise Exception(f"Sender not allowed")

    if not internal_call and not cartridge.primary:
        raise Exception(f"Not primary cartridge")

    primary_cartridge = cartridge
    for c in primary_cartridge.versions:
        if c != cartridge_id:
            change_cartridge_user_address(c,new_user_address, internal_call=True,**metadata)

    cartridge.user_address = new_user_address
    return cartridge

def format_incard(tape_ids: List[str],incards: List[bytes]) -> bytes:
    incard_data_list = []
    for incard in incards:
        if len(incard) > 0: incard_data_list.append(incard)
    incard_data_list.extend(format_tapes_to_byte_list(tape_ids))
    return format_bytes_list_to_incard(incard_data_list)
    
def format_tapes_to_byte_list(tape_ids: List[str]) -> List[bytes]:
    tapes_data_list = []
    for t in tape_ids:
        tape_id = t[2:] if t.startswith('0x') else t
        tape = Tape.get(lambda r: r.id == tape_id)
        if tape is None or tape.out_card is None or len(tape.out_card) == 0: continue
        tapes_data_list.append(tape.out_card)
        # outcard = TapeHash.get_outcard(tape_id)
        # if outcard is None or len(outcard) == 0: continue
        # tapes_data_list.append(outcard)
    return tapes_data_list


word_size = 8
to_bytes_half = lambda x: x.to_bytes(word_size//2,'big')
to_bytes = lambda x: x.to_bytes(word_size,'big')

def format_bytes_list_to_incard(incard_data_list: List[bytes]):
    if len(incard_data_list) == 0: return b''
    if len(incard_data_list) == 1: return incard_data_list[0]
    next_pos = (1 + len(incard_data_list)) * 8
    final_incard = b'MICS' + to_bytes_half(len(incard_data_list))
    incard_data = b''
    for outcard in incard_data_list:
        l = len(outcard)
        final_incard += to_bytes_half(next_pos) + to_bytes_half(l)
        r = l % word_size
        if r > 0: l += word_size - r
        incard_data += outcard.ljust(l)
        next_pos += l
    final_incard += incard_data
    return final_incard


# Tipo (4-byte words)
# [MICD, n_incards, offset_1, length_1, offset_2, length_2, ..., bytes_1, bytes_2, ...]
# ￼
# 0 - MICD - header
# 4 - 0x0000002 - incard count
# 8 - 0x000001c - incard 1 offset (in the 2MB data)
# 12 - 0x0000010 - incard 1 size (0x10 bytes)
# 16 - 0x0000080 - incard 2 offset
# 24 - 0x0000010 - incard 2 size (0x10 bytes)
# 28 - incard 1 start
# ...
