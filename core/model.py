import os
from pydantic import BaseModel
import logging
from typing import Optional, List
import json
from py_expression_eval import Parser
import pickle

from cartesi.abi import String, Bytes, Bytes32

from cartesapp.storage import Entity, helpers, Storage, seed
from cartesapp.utils import hex2bytes, str2bytes, bytes2str

from .riv import riv_get_cartridge_info, riv_get_cover, verify_log
from .core_settings import CoreSettings, generate_cartridge_id, get_cartridges_path, is_inside_cm, get_cartridge_tapes_filename, generate_rule_id

LOGGER = logging.getLogger(__name__)


###
# Model

# TODO: TypeError: unhashable type: 'ABIType' allow python cartesi types
class Cartridge(Entity):
    id              = helpers.PrimaryKey(str, 64)
    name            = helpers.Required(str, index=True, unique=True)
    user_address    = helpers.Required(str, 42)
    info            = helpers.Optional(helpers.Json, lazy=True)
    created_at      = helpers.Required(int, unsigned=True)
    input_index     = helpers.Required(int, lazy=True) # -1 means not created by an input (created in genesis)
    cover           = helpers.Optional(bytes, lazy=True)

class Rule(Entity):
    id              = helpers.PrimaryKey(str, 64)
    name            = helpers.Required(str, index=True)
    description     = helpers.Optional(str, index=True)
    cartridge_id    = helpers.Required(str, 64, index=True)
    created_by      = helpers.Required(str, 42)
    created_at      = helpers.Required(int, unsigned=True) # -1 means not created by an input (created in genesis or default rule)
    input_index     = helpers.Required(int, lazy=True)
    args            = helpers.Optional(str)
    in_card         = helpers.Optional(bytes)
    score_function  = helpers.Optional(str)

class RuleData(BaseModel):
    cartridge_id:       Bytes32
    name:               String
    description:        String
    args:               String
    in_card:            Bytes
    score_function:     String

class Author(BaseModel):
    name:           str
    link:           str

class CartridgeInfo(BaseModel):
    name:           str
    summary:        Optional[str]
    description:    Optional[str]
    version:        Optional[str]
    status:         Optional[str]
    tags:           List[str]
    authors:        Optional[List[Author]]
    url:            Optional[str]


class TapeHash:
    cartridge_tapes = {}
    def __new__(cls):
        return cls

    @classmethod
    def get_cartridge_tapes(cls):
        cartridge_tapes = {}
        if Storage.STORAGE_PATH is not None:
            if os.path.exists(get_cartridge_tapes_filename()):
                f = open(get_cartridge_tapes_filename(), 'rb')
                cartridge_tapes = pickle.load(f)
                f.close()
        else:
            cartridge_tapes = cls.cartridge_tapes
        return cartridge_tapes

    @classmethod
    def store_cartridge_tape(cls,cartridge_tapes):
        if Storage.STORAGE_PATH is not None:
            with open(get_cartridge_tapes_filename(), 'wb') as f:
                pickle.dump(cartridge_tapes, f)
        else:
            cls.cartridge_tapes = cartridge_tapes

    @classmethod
    def add(cls, cartridge_id, tape_hash):
        cartridge_tapes = cls.get_cartridge_tapes()
        if cartridge_tapes.get(cartridge_id) is None: cartridge_tapes[cartridge_id] = {}
        cartridge_tapes[cartridge_id][tape_hash] = False
        cls.store_cartridge_tape(cartridge_tapes)

    @classmethod
    def check_duplicate(cls, cartridge_id, tape_hash):
        cartridge_tapes = cls.get_cartridge_tapes()
        return cartridge_tapes.get(cartridge_id) is not None \
            and tape_hash in cartridge_tapes[cartridge_id]

    @classmethod
    def check_verified(cls, cartridge_id, tape_hash):
        cartridge_tapes = cls.get_cartridge_tapes()
        return cartridge_tapes.get(cartridge_id) is not None \
            and tape_hash in cartridge_tapes[cartridge_id] \
            and cartridge_tapes[cartridge_id][tape_hash]
    
    @classmethod
    def set_verified(cls, cartridge_id, tape_hash):
        cartridge_tapes = cls.get_cartridge_tapes()
        if cartridge_tapes.get(cartridge_id) is None: cartridge_tapes[cartridge_id] = {}
        cartridge_tapes[cartridge_id][tape_hash] = True
        cls.store_cartridge_tape(cartridge_tapes)
###
# Seeds

@seed()
def initialize_data():
    if CoreSettings.insert_genesis_cartridges:
        try:
            cartridge_example_file = open('misc/snake.sqfs','rb')
            cartridge_example_data = cartridge_example_file.read()
            cartridge_example_file.close()
            snake_id = generate_cartridge_id(cartridge_example_data)
            snake_data = cartridge_example_data
            create_cartridge(cartridge_example_data,msg_sender="0xAf1577F6A113da0bc671a59D247528811501cF94")
            if is_inside_cm(): os.remove('misc/snake.sqfs')
        except Exception as e:
            LOGGER.warning(e)

        try:
            cartridge_example_file = open('misc/freedoom.sqfs','rb')
            cartridge_example_data = cartridge_example_file.read()
            cartridge_example_file.close()
            freedoom_id = generate_cartridge_id(cartridge_example_data)
            freedoom_data = cartridge_example_data
            create_cartridge(cartridge_example_data,msg_sender="0xAf1577F6A113da0bc671a59D247528811501cF94")
            if is_inside_cm(): os.remove('misc/freedoom.sqfs')
        except Exception as e:
            LOGGER.warning(e)

        try:
            cartridge_example_file = open('misc/antcopter.sqfs','rb')
            cartridge_example_data = cartridge_example_file.read()
            cartridge_example_file.close()
            antcopter_id = generate_cartridge_id(cartridge_example_data)
            antcopter_data = cartridge_example_data
            create_cartridge(cartridge_example_data,msg_sender="0xAf1577F6A113da0bc671a59D247528811501cF94")
            if is_inside_cm(): os.remove('misc/antcopter.sqfs')
        except Exception as e:
            LOGGER.warning(e)

        try:
            cartridge_example_file = open('misc/monky.sqfs','rb')
            cartridge_example_data = cartridge_example_file.read()
            cartridge_example_file.close()
            monky_id = generate_cartridge_id(cartridge_example_data)
            monky_data = cartridge_example_data
            create_cartridge(cartridge_example_data,msg_sender="0xAf1577F6A113da0bc671a59D247528811501cF94")
            if is_inside_cm(): os.remove('misc/monky.sqfs')
        except Exception as e:
            LOGGER.warning(e)

        # try:
        #     cartridge_example_file = open('misc/breakout.sqfs','rb')
        #     cartridge_example_data = cartridge_example_file.read()
        #     cartridge_example_file.close()
        #     breakout_id = generate_cartridge_id(cartridge_example_data)
        #     breakout_data = cartridge_example_data
        #     create_cartridge(cartridge_example_data,msg_sender="0xd33Dfbfb0D0961284656e0225CFfB561090762D3")
        #     if is_inside_cm(): os.remove('misc/breakout.sqfs')
        # except Exception as e:
        #     LOGGER.warning(e)

        # try:
        #     cartridge_example_file = open('misc/2048.sqfs','rb')
        #     cartridge_example_data = cartridge_example_file.read()
        #     cartridge_example_file.close()
        #     id_2048 = generate_cartridge_id(cartridge_example_data)
        #     data_2048 = cartridge_example_data
        #     create_cartridge(cartridge_example_data,msg_sender="0xAf1577F6A113da0bc671a59D247528811501cF94")
        #     if is_inside_cm(): os.remove('misc/2048.sqfs')
        # except Exception as e:
        #     LOGGER.warning(e)

        try:
            cartridge_example_file = open('misc/tetrix.sqfs','rb')
            cartridge_example_data = cartridge_example_file.read()
            cartridge_example_file.close()
            tetrix_id = generate_cartridge_id(cartridge_example_data)
            tetrix_data = cartridge_example_data
            create_cartridge(cartridge_example_data,msg_sender="0xAf1577F6A113da0bc671a59D247528811501cF94")
            if is_inside_cm(): os.remove('misc/tetrix.sqfs')
        except Exception as e:
            LOGGER.warning(e)

        try:
            cartridge_example_file = open('misc/particles.sqfs','rb')
            cartridge_example_data = cartridge_example_file.read()
            cartridge_example_file.close()
            particles_id = generate_cartridge_id(cartridge_example_data)
            particles_data = cartridge_example_data
            create_cartridge(cartridge_example_data,msg_sender="0xAf1577F6A113da0bc671a59D247528811501cF94")
            if is_inside_cm(): os.remove('misc/particles.sqfs')
        except Exception as e:
            LOGGER.warning(e)

        try:
            rule_conf_dict = {
                "cartridge_id":hex2bytes(antcopter_id),
                "name":"Only 5 to beat",
                "description":"You'll have only 5 lives to beat the game. Each new level and each apple earn you points, but you loose point with time. Be fast and efficient! ",
                "args":"5",
                "in_card":b"",
                "score_function":"score"
            }
            rule_conf = RuleData.parse_obj(rule_conf_dict)
            rule_id = generate_rule_id(rule_conf.cartridge_id,str2bytes(rule_conf.name))
            if helpers.count(r for r in Rule if r.id == rule_id) > 0:
                raise Exception(f"Rule already exists")
            test_replay_file = open(CoreSettings.test_tape_path,'rb')
            test_replay = test_replay_file.read()
            test_replay_file.close()

            verification_output = verify_log(antcopter_data,test_replay,rule_conf_dict["args"],rule_conf_dict["in_card"])
            insert_rule(rule_conf,verification_output.get("outcard"),msg_sender="0xCB76129e0eD325E1E5c17F3f363BC2e93a227eCF")
        except Exception as e:
            LOGGER.warning(e)
            

###
# Helpers

def create_default_rule(cartridge_id,outcard_raw,**metadata):
    rule_conf_dict = {
        "cartridge_id":hex2bytes(cartridge_id),
        "name":"default",
        "description":"",
        "args":"",
        "in_card":b"",
        "score_function":""
    }
    if outcard_raw[:4] == b"JSON":
        try:
            if json.loads(outcard_raw[4:]).get('score') is not None:
                rule_conf_dict["score_function"] = "score"
        except Exception as e:
            LOGGER.info(f"Couldn't parse json outcard: {e}, ignoring score function")

    rule_conf = RuleData.parse_obj(rule_conf_dict)
    return insert_rule(rule_conf,outcard_raw,**metadata)
    
def insert_rule(rule_conf,outcard_raw,**metadata):
    # str2bytes(metadata.msg_sender) + metadata.timestamp.to_bytes(32, byteorder='big')
    rule_id = generate_rule_id(rule_conf.cartridge_id,str2bytes(rule_conf.name))

    if helpers.count(r for r in Rule if r.id == rule_id) > 0:
        raise Exception(f"Rule already exists")
    # process outcard
    function_log = "no function"
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
        function_log = f"function {rule_conf.score_function}"
    
    LOGGER.info(f"Creating rule {rule_conf.name} (id={rule_id}) with {function_log}")

    new_rule = Rule(
        id = rule_id,
        cartridge_id = rule_conf.cartridge_id.hex(),
        name = rule_conf.name,
        description = rule_conf.description,
        created_by = metadata['msg_sender'],
        created_at = metadata.get('timestamp') or 0,
        input_index = metadata.get('input_index') or -1, # not created by an input (genesis or default rule)
        args = rule_conf.args,
        in_card = rule_conf.in_card,
        score_function = rule_conf.score_function
    )

    # LOGGER.info(f"{new_rule=}")

    return rule_id


def create_cartridge(cartridge_data,**metadata):
    data_hash = generate_cartridge_id(cartridge_data)
    
    if helpers.count(c for c in Cartridge if c.id == data_hash) > 0:
        raise Exception(f"Cartridge already exists")

    cartridges_path = get_cartridges_path()
    if not os.path.exists(cartridges_path):
        os.makedirs(cartridges_path)
    with open(f"{cartridges_path}/{data_hash}",'wb') as cartridge_file:
        cartridge_file.write(cartridge_data)

    cartridge_info = riv_get_cartridge_info(data_hash)
    
    # validate info
    cartridge_info_json = json.loads(cartridge_info)
    CartridgeInfo(**cartridge_info_json)

    # check if cartridge runs
    test_replay_file = open(CoreSettings.test_tape_path,'rb')
    test_replay = test_replay_file.read()
    test_replay_file.close()

    verification_output = verify_log(cartridge_data,test_replay,'',b'',get_screenshot=True)
    screenshot = verification_output.get("screenshot")

    cartridge_cover = riv_get_cover(data_hash)
    if cartridge_cover is None or len(cartridge_cover) == 0:
        #cartridge_cover = riv_get_cartridge_screenshot(data_hash,0)
        cartridge_cover = screenshot

    if metadata.get('timestamp') is None: metadata['timestamp'] = 0

    user_address = metadata.get('msg_sender')
    if user_address is not None: user_address = user_address.lower()

    LOGGER.info(f"Creating cartridge {cartridge_info_json['name']} (id={data_hash})")

    new_cartridge = Cartridge(
        id = data_hash,
        name = cartridge_info_json['name'],
        user_address = user_address,
        created_at = metadata.get('timestamp') or 0,
        input_index = metadata.get('input_index') or -1, # genesis input index
        info = cartridge_info_json,
        cover = cartridge_cover
    )

    metadata['input_index'] = -1 # not created by an input
    # LOGGER.info(f"{new_cartridge=}")

    # create default rule with no arguments, incard, score
    create_default_rule(data_hash,verification_output.get("outcard"),**metadata)

    return data_hash

def delete_cartridge(cartridge_id,**metadata):
    cartridge = Cartridge.get(lambda c: c.id == cartridge_id)
    if cartridge is None:
        raise Exception(f"Cartridge doesn't exist")

    if cartridge.user_address != metadata['msg_sender'].lower():
        raise Exception(f"Sender not allowed")

    cartridge.delete()
    os.remove(f"{get_cartridges_path()}/{cartridge_id}")

