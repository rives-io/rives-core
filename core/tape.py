import os
from pydantic import BaseModel
import logging
from typing import Optional, List
from hashlib import sha256
import json
from py_expression_eval import Parser
import pickle

from cartesi.abi import String, Bytes, Bytes32, Int, UInt, Address

from cartesapp.storage import helpers
from cartesapp.context import get_metadata
from cartesapp.input import mutation, query
from cartesapp.output import output, add_output, event, emit_event, index_input
from cartesapp.utils import hex2bytes, str2bytes, bytes2str

from .model import insert_rule, Rule, RuleData, Cartridge, TapeHash
from .riv import verify_log
from .core_settings import CoreSettings, generate_tape_id, get_version

LOGGER = logging.getLogger(__name__)

# Inputs

RulePayload = RuleData

class VerifyPayload(BaseModel):
    rule_id:        Bytes32
    outcard_hash:   Bytes32
    tape:           Bytes
    claimed_score:  UInt

class GetRulesPayload(BaseModel):
    cartridge_id:   str
    name:           Optional[str]
    page:           Optional[int]
    page_size:      Optional[int]

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

class RuleInfo(BaseModel):
    id: String
    name: String
    description: String
    cartridge_id: String
    created_by: String
    created_at: UInt
    args: String
    in_card: Bytes
    score_function: String
    
@output()
class RulesOutput(BaseModel):
    data:   List[RuleInfo]
    total:  UInt
    page:   UInt


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

        verification_output = verify_log(payload.cartridge_id.hex(),test_replay,payload.args,payload.in_card)
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
    index_input(tags=['rule',rule_id,payload.cartridge_id.hex()])

    return True

@mutation()
def verify(payload: VerifyPayload) -> bool:
    metadata = get_metadata()

    # get Rule
    rule = Rule.get(lambda r: r.id == payload.rule_id.hex())
    if rule is None:
        msg = f"rule {payload.rule_id.hex()} doesn't exist"
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
        entropy_args = f"" # TODO: enable this f"-entropy {metadata.msg_sender}"
        # entropy_args = f"20 -entropy {metadata.msg_sender}" # ANTCOPTER
        args = f"{rule.args} {entropy_args}" if rule.args != "" else entropy_args
        # verification_output = verify_log(rule.cartridge_id,payload.tape,args,rule.in_card,get_screenshot=True)
        verification_output = verify_log(rule.cartridge_id,payload.tape,args,rule.in_card)
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

    outcard_str = bytes2str(outcard_raw[4:])

    LOGGER.info(f"==== BEGIN OUTCARD ({outcard_format}) ====")
    LOGGER.info(outcard_str)
    LOGGER.info("==== END OUTCARD ====")
    LOGGER.info(f"Expected Outcard Hash: {payload.outcard_hash.hex()}")
    LOGGER.info(f"Computed Outcard Hash: {outhash.hex()}")
    LOGGER.info(f"Valid Outcard Hash : {outcard_valid}")

    if not outcard_valid:
        msg = f"Out card hash doesn't match"
        LOGGER.error(msg)
        add_output(msg)
        return False

    score = 0
    if rule.score_function is not None:
        if outcard_format == b"JSON":
            try:
                outcard_json = json.loads(outcard_str)
                parser = Parser()
                score = parser.parse(rule.score_function).evaluate(outcard_json)
            except Exception as e:
                LOGGER.info(f"Couldn't load/parse score from json: {e}")

        # compare claimed score
        claimed_score = payload.claimed_score
        if claimed_score == 0:
            claimed_score = score

        score_valid = score == claimed_score

        LOGGER.info(f"Expected Score: {payload.claimed_score}")
        LOGGER.info(f"Computed Score: {score}")
        LOGGER.info(f"Valid Outcard Hash : {score_valid}")

        if not score_valid:
            msg = f"Score doesn't match"
            LOGGER.error(msg)
            add_output(msg)
            return False


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
        tape_input_index = metadata.input_index
    )

    index_input(tags=['tape',rule.cartridge_id,payload.rule_id.hex(),tape_id])
    emit_event(out_ev,tags=['score',rule.cartridge_id,payload.rule_id.hex(),tape_id],value=score)
    # add_output(screenshot,tags=['screenshot',rule.cartridge_id,payload.rule_id.hex(),tape_hash.hexdigest()])

    TapeHash.add(rule.cartridge_id,tape_id)

    return True

###
# Queries

@query()
def rules(payload: GetRulesPayload) -> bool:
    rules_query = Rule.select(lambda r: r.cartridge_id == payload.cartridge_id)

    if payload.name is not None:
        rules_query = rules_query.filter(lambda r: payload.name in r.name)

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
    

    dict_list_result = [s.to_dict() for s in rules]

    LOGGER.info(f"Returning {len(dict_list_result)} of {total} rules")
    
    out = RulesOutput.parse_obj({'data':dict_list_result,'total':total,'page':page})
    
    add_output(out)

    return True
