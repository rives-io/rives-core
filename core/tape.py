from pydantic import BaseModel
import logging
from typing import Optional, List
import json
from py_expression_eval import Parser
from enum import Enum

from cartesi.abi import String, Bytes, Bytes32, Int, UInt, Address

from cartesapp.storage import helpers
from cartesapp.context import get_metadata
from cartesapp.input import mutation, query
from cartesapp.output import output, add_output, event, emit_event, index_input
from cartesapp.utils import hex2bytes, bytes2str

from .model import insert_rule, Rule, RuleTag, RuleData, Cartridge, TapeHash, AddressList, Bytes32List, UInt256List, Int256List
from .riv import verify_log
from .core_settings import CoreSettings, generate_tape_id, get_version, generate_entropy, get_cartridges_path

LOGGER = logging.getLogger(__name__)


# model

class ErrorCode(Enum):
    NONE = 0
    VERIFICATION_ERROR = 1
    OUTHASH_MATCH_ERROR = 2
    SCORE_MATCH_ERROR = 3
    SCORE_ERROR = 4

# Inputs

RulePayload = RuleData

class VerifyPayload(BaseModel):
    rule_id:        Bytes32
    outcard_hash:   Bytes32
    tape:           Bytes
    claimed_score:  Int

class GetRulesPayload(BaseModel):
    cartridge_id:   Optional[str]
    id:             Optional[str]
    ids:            Optional[List[str]]
    active_ts:      Optional[int]
    name:           Optional[str]
    page:           Optional[int]
    page_size:      Optional[int]

class ExternalVerificationPayload(BaseModel):
    user_addresses:     AddressList
    rule_ids:           Bytes32List
    tape_hashes:        Bytes32List
    tape_input_indexes: UInt256List
    tape_timestamps:    UInt256List
    scores:             Int256List
    error_codes:        UInt256List

class GetRuleTagsPayload(BaseModel):
    cartridge_id:   Optional[str]

# Outputs

@event()
class RuleCreated(BaseModel):
    rule_id:        Bytes32
    created_by:     String
    created_at:     UInt

@event()
class VerificationOutput(BaseModel):
    version:                Bytes32
    cartridge_id:           Bytes32
    cartridge_input_index:  Int
    user_address:           Address
    timestamp:              UInt
    score:                  Int
    rule_id:                String
    rule_input_index:       Int
    tape_hash:              Bytes32
    tape_input_index:       Int
    error_code:             UInt

class RuleInfo(BaseModel):
    id: str
    name: str
    description: str
    cartridge_id: str
    created_by: str
    created_at: int
    args: str
    in_card: bytes
    score_function: str
    n_tapes: int
    n_verified: int
    start: Optional[int]
    end: Optional[int]
    tags: List[str]
    
@output()
class RulesOutput(BaseModel):
    data:   List[RuleInfo]
    total:  int
    page:   int

@output()
class RuleTagsOutput(BaseModel):
    tags:   List[str]



###
# Mutations

@mutation(msg_sender=CoreSettings.operator_address)
def create_rule(payload: RulePayload) -> bool:

    # check if Cartridge exists
    cartridge = Cartridge.get(lambda r: r.id == payload.cartridge_id.hex())
    if cartridge is None:
        msg = f"Cartridge {payload.cartridge_id.hex()} doesn't exist"
        LOGGER.error(msg)
        add_output(msg)
        return False

    # check if rule already exists
    if helpers.count(r.id for r in Rule if r.name == payload.name and r.cartridge_id == payload.cartridge_id.hex()) > 0:
        msg = f"Rule {payload.name} already exists for this game"
        LOGGER.error(msg)
        add_output(msg)
        return False

    LOGGER.info(f"Running cartridge test")
    try:
        # run cartridge to test args, incard and get outcard
        test_replay_file = open(CoreSettings.test_tape_path,'rb')
        test_replay = test_replay_file.read()
        test_replay_file.close()

        with open(f"{get_cartridges_path()}/{payload.cartridge_id}",'rb')as cartridge_file:
            cartridge_data = cartridge_file.read()

        verification_output = verify_log(cartridge_data,test_replay,payload.args,payload.in_card)
        rule_id = insert_rule(payload,verification_output.get("outcard"),**get_metadata().dict())
    except Exception as e:
        msg = f"Couldn't run cartridge test: {e}"
        LOGGER.error(msg)
        add_output(msg)
        return False

    # create_rule_event = RuleCreated(
    #     rule_id = rule_id,
    #     created_by = metadata.msg_sender,
    #     created_at = metadata.timestamp
    # )
    # emit_event(create_rule_event,tags=['rule','create_rule',rule_id.hex()])
    tags = ['rule',rule_id,payload.cartridge_id.hex()]
    tags.extend(payload.tags)
    index_input(tags=tags)

    return True

@mutation(msg_sender=CoreSettings.operator_address)
def verify(payload: VerifyPayload) -> bool:
    metadata = get_metadata()

    # get Rule
    rule = Rule.get(lambda r: r.id == payload.rule_id.hex())
    if rule is None:
        msg = f"rule {payload.rule_id.hex()} doesn't exist"
        LOGGER.error(msg)
        add_output(msg)
        return False

    if rule.start is not None and rule.start > 0 and rule.start > metadata.timestamp:
        msg = f"timestamp earlier than rule start"
        LOGGER.error(msg)
        add_output(msg)
        return False

    if rule.end is not None and rule.end > 0 and rule.end < metadata.timestamp:
        msg = f"timestamp later than rule end"
        LOGGER.error(msg)
        add_output(msg)
        return False

    tape_id = generate_tape_id(payload.tape)
    
    if TapeHash.check_duplicate(rule.cartridge_id,tape_id):
        msg = f"Tape already submitted"
        LOGGER.error(msg)
        add_output(msg)
        return False

    cartridge = helpers.select(c for c in Cartridge if c.id == rule.cartridge_id).first()

    if cartridge is None:
        msg = f"Cartridge not found"
        LOGGER.error(msg)
        add_output(msg)
        return False

    # process tape
    LOGGER.info(f"Verifying tape...")
    try:
        entropy = generate_entropy(metadata.msg_sender, rule.id)

        with open(f"{get_cartridges_path()}/{rule.cartridge_id}",'rb')as cartridge_file:
            cartridge_data = cartridge_file.read()

        verification_output = verify_log(cartridge_data,payload.tape,rule.args,rule.in_card,entropy=entropy)
        outcard_raw = verification_output.get('outcard')
        outhash = verification_output.get('outhash')
        # screenshot = verification_output.get('screenshot')
    except Exception as e:
        msg = f"Couldn't verify tape: {e}"
        LOGGER.error(msg)
        add_output(msg)
        return False

    # compare outcard
    tape_outcard_hash = payload.outcard_hash 
    if tape_outcard_hash == b'\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0':
        tape_outcard_hash = outhash

    outcard_valid = outhash == tape_outcard_hash

    outcard_format = outcard_raw[:4]

    outcard_print = bytes2str(outcard_raw[4:]) if outcard_format in [b"JSON",b"TEXT"] else outcard_raw[4:]

    LOGGER.debug(f"==== BEGIN OUTCARD ({outcard_format}) ====")
    LOGGER.debug(outcard_print)
    LOGGER.debug("==== END OUTCARD ====")
    LOGGER.debug(f"Expected Outcard Hash: {payload.outcard_hash.hex()}")
    LOGGER.debug(f"Computed Outcard Hash: {outhash.hex()}")
    LOGGER.debug(f"Valid Outcard Hash: {outcard_valid}")

    if not outcard_valid:
        msg = f"Out card hash doesn't match"
        LOGGER.error(msg)
        add_output(msg)
        return False

    score = 0
    if rule.score_function is not None and len(rule.score_function) > 0 and outcard_format == b"JSON":
        try:
            outcard_json = json.loads(outcard_print)
            parser = Parser()
            score = parser.parse(rule.score_function).evaluate(outcard_json)
        except Exception as e:
            msg = f"Couldn't load/parse score from json: {e}"
            LOGGER.error(msg)
            add_output(msg)
            return False

        # compare claimed score
        claimed_score = payload.claimed_score
        if claimed_score == 0:
            claimed_score = score

        score_valid = score == claimed_score

        LOGGER.debug(f"Expected Score: {payload.claimed_score}")
        LOGGER.debug(f"Computed Score: {score}")
        LOGGER.debug(f"Valid Score: {score_valid}")

        if not score_valid:
            msg = f"Score doesn't match"
            LOGGER.error(msg)
            add_output(msg)
            return False

    LOGGER.info(f"Tape verified")

    out_ev = VerificationOutput(
        version=get_version(),
        cartridge_id = hex2bytes(cartridge.id),
        cartridge_input_index = cartridge.input_index,
        user_address = metadata.msg_sender,
        timestamp = metadata.timestamp,
        score = score,
        rule_id = rule.id,
        rule_input_index = rule.input_index,
        tape_hash = hex2bytes(tape_id),
        tape_input_index = metadata.input_index,
        error_code=0
    )
    common_tags = [rule.cartridge_id,payload.rule_id.hex(),tape_id]
    common_tags.extend(list(rule.tags.name.distinct().keys()))
    index_tags = ["tape"]
    index_tags.extend(common_tags)
    index_input(tags=index_tags,value=metadata.timestamp)
    event_tags = ["score"]
    event_tags.extend(common_tags)
    emit_event(out_ev,tags=event_tags,value=score)
    # add_output(screenshot,tags=['screenshot',rule.cartridge_id,payload.rule_id.hex(),tape_hash.hexdigest()])

    TapeHash.set_verified(rule.cartridge_id,rule.id,tape_id)

    return True

@mutation()
def register_external_verification(payload: VerifyPayload) -> bool:
    metadata = get_metadata()
    # get Rule
    rule = Rule.get(lambda r: r.id == payload.rule_id.hex())
    if rule is None:
        msg = f"rule {payload.rule_id.hex()} doesn't exist"
        LOGGER.error(msg)
        add_output(msg)
        return False

    if rule.start is not None and rule.start > 0 and rule.start > metadata.timestamp:
        msg = f"timestamp earlier than rule start"
        LOGGER.error(msg)
        add_output(msg)
        return False

    if rule.end is not None and rule.end > 0 and rule.end < metadata.timestamp:
        msg = f"timestamp later than rule end"
        LOGGER.error(msg)
        add_output(msg)
        return False

    tape_id = generate_tape_id(payload.tape)
    
    if TapeHash.check_duplicate(rule.cartridge_id,tape_id):
        msg = f"Tape already submitted"
        LOGGER.error(msg)
        add_output(msg)
        return False

    cartridge = helpers.select(c for c in Cartridge if c.id == rule.cartridge_id).first()

    if cartridge is None:
        msg = f"Cartridge not found"
        LOGGER.error(msg)
        add_output(msg)
        return False

    LOGGER.info(f"Received new tape")
    tags = ["tape",rule.cartridge_id,payload.rule_id.hex(),tape_id]
    tags.extend(list(rule.tags.name.distinct().keys()))
    index_input(tags=tags,value=metadata.timestamp)
    TapeHash.add(rule.cartridge_id,rule.id,tape_id)

    return True


@mutation(msg_sender=CoreSettings.operator_address)
def external_verification(payload: ExternalVerificationPayload) -> bool:

    payload_lens = [
        len(payload.user_addresses),
        len(payload.rule_ids),
        len(payload.tape_hashes),
        len(payload.tape_input_indexes),
        len(payload.tape_timestamps),
        len(payload.scores),
        len(payload.error_codes),
    ]

    if len(set(payload_lens)) != 1:
        msg = f"payload have distinct sizes"
        LOGGER.error(msg)
        add_output(msg)
        return False
    
    LOGGER.info(f"Received batch of tape verifications")
    for ind in range(len(payload.tape_hashes)):

        tape_id = payload.tape_hashes[ind]

        # get Rule
        rule = Rule.get(lambda r: r.id == payload.rule_ids[ind].hex())
        if rule is None:
            msg = f"rule {payload.rule_ids[ind].hex()} doesn't exist"
            LOGGER.warning(msg)
            # add_output(msg)
            # return False
            continue
        
        if not TapeHash.check_duplicate(rule.cartridge_id,tape_id.hex()):
            msg = f"Tape not submitted"
            LOGGER.warning(msg)
            # add_output(msg)
            # return False
            continue

        if TapeHash.check_verified(rule.cartridge_id,tape_id.hex()):
            msg = f"Tape already verified"
            LOGGER.warning(msg)
            # add_output(msg)
            # return False
            continue

        cartridge = helpers.select(c for c in Cartridge if c.id == rule.cartridge_id).first()

        if cartridge is None:
            msg = f"Cartridge not found"
            LOGGER.error(msg)
            # add_output(msg)
            # return False
            continue

        out_ev = VerificationOutput(
            version=get_version(),
            cartridge_id = hex2bytes(cartridge.id),
            cartridge_input_index = cartridge.input_index,
            user_address = payload.user_addresses[ind],
            timestamp = payload.tape_timestamps[ind],
            score = payload.scores[ind],
            rule_id = rule.id,
            rule_input_index = rule.input_index,
            tape_hash = tape_id,
            tape_input_index = payload.tape_input_indexes[ind],
            error_code = payload.error_codes[ind]
        )

        LOGGER.info(f"Sending tape verification output")

        tags = ['score',rule.cartridge_id,payload.rule_ids[ind].hex(),tape_id.hex()]
        tags.extend(list(rule.tags.name.distinct().keys()))
        emit_event(out_ev,tags=tags,value=payload.scores[ind])
        TapeHash.set_verified(rule.cartridge_id,rule.id,tape_id.hex())

    return True

###
# Queries

@query()
def rules(payload: GetRulesPayload) -> bool:
    rules_query = Rule.select()
    
    if payload.id is not None:
        rules_query = rules_query.filter(lambda r: payload.id == r.id)
    if payload.ids is not None:
        rules_query = rules_query.filter(lambda r: r.id in payload.ids)
    if payload.cartridge_id is not None:
        rules_query = rules_query.filter(lambda r: r.cartridge_id == payload.cartridge_id)
    if payload.name is not None:
        rules_query = rules_query.filter(lambda r: payload.name in r.name)
    if payload.active_ts is not None:
        rules_query = rules_query.filter(lambda r: r.start is not None and r.end is not None and payload.active_ts >= r.start and payload.active_ts <= r.end)

    total = rules_query.count()

    page = 1
    if payload.page is not None:
        page = payload.page
        if payload.page_size is not None:
            rules = rules_query.page(payload.page,payload.page_size)
        else:
            rules = rules_query.page(payload.page)
    else:
        rules = rules_query.fetch()
    
    dict_list_result = []
    for r in rules:
        dict_rule = r.to_dict()
        summary = TapeHash.get_rule_tapes_summary(r.id)
        dict_rule["n_tapes"] = summary["all"]
        dict_rule["n_verified"] = summary["verified"]
        dict_rule["tags"] = list(r.tags.name.distinct().keys())
        dict_list_result.append(dict_rule)

    LOGGER.info(f"Returning {len(dict_list_result)} of {total} rules")
    
    out = RulesOutput.parse_obj({'data':dict_list_result,'total':total,'page':page})
    
    add_output(out)

    return True

@query()
def rule_tags(payload: GetRuleTagsPayload) -> bool:
    tags_query = RuleTag.select()
    if payload.cartridge_id is not None:
        tags_query = tags_query.filter(lambda r: r.cartridge_id == payload.cartridge_id)

    tag_names = helpers.select(r.name for r in tags_query).fetch()
    out = RuleTagsOutput.parse_obj({"tags":tag_names})
    add_output(out)

    return True
