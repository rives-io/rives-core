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
from cartesapp.utils import hex2bytes, bytes2str, str2bytes

from .model import insert_rule, Rule, RuleTag, RuleData, Cartridge, Tape, \
    AddressList, Bytes32List, UInt256List, Int256List, BytesList, Bytes32ListList, format_incard

from .riv import verify_log
from .core_settings import CoreSettings, generate_tape_id, generate_rule_id, get_version, generate_entropy, get_cartridges_path, \
    format_cartridge_id_from_bytes, format_rule_id_from_bytes, format_tape_id_from_bytes

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

class DeactivateRulePayload(BaseModel):
    rule_id:        Bytes32

class VerifyPayload(BaseModel):
    # cartridge_id:   Bytes32
    rule_id:        Bytes32
    outcard_hash:   Bytes32
    tape:           Bytes
    claimed_score:  Int
    tapes:          Bytes32List
    in_card:        Bytes

class GetRulesPayload(BaseModel):
    cartridge_id:   Optional[str]
    id:             Optional[str]
    ids:            Optional[List[str]]
    active_ts:      Optional[int]
    has_start:      Optional[bool]
    has_end:        Optional[bool]
    created_by:     Optional[str]
    name:           Optional[str]
    page:           Optional[int]
    page_size:      Optional[int]
    order_by:       Optional[str]
    order_dir:      Optional[str]
    tags:           Optional[List[str]]
    tags_or:        Optional[bool]
    full:           Optional[bool]
    enable_deactivated:Optional[bool]

class GetTapesPayload(BaseModel):
    cartridge_id:   Optional[str]
    rule_id:        Optional[str]
    id:             Optional[str]
    ids:            Optional[List[str]]
    timestamp_lte:  Optional[int]
    timestamp_gte:  Optional[int]
    user_address:   Optional[str]
    page:           Optional[int]
    page_size:      Optional[int]
    order_by:       Optional[str]
    order_dir:      Optional[str]
    tags:           Optional[List[str]]
    tags_or:        Optional[bool]
    full:           Optional[bool]

class ExternalVerificationPayload(BaseModel):
    tape_ids:           Bytes32List
    scores:             Int256List
    error_codes:        UInt256List
    outcards:           BytesList

class AwardWinnerTapesPayload(BaseModel):
    rule_id:        Bytes32
    tapes_to_award: UInt

class CleanTapesPayload(BaseModel):
    rule_id:        Bytes32

class GetRuleTagsPayload(BaseModel):
    name:           Optional[str]
    cartridge_id:   Optional[str]

class GetTapesPayload(BaseModel):
    cartridge_id:   Optional[str]
    rule_id:        Optional[str]
    id:             Optional[str]
    user_address:   Optional[str]
    ids:            Optional[List[str]]
    timestamp_lte:  Optional[int]
    timestamp_gte:  Optional[int]
    rank_lte:       Optional[int]
    rank_gte:       Optional[int]
    page:           Optional[int]
    page_size:      Optional[int]
    order_by:       Optional[str]
    order_dir:      Optional[str]
    tags:           Optional[List[str]]
    tags_or:        Optional[bool]
    full:           Optional[bool]

class FormatInCardPayload(BaseModel):
    rule_id:        Optional[str]
    cartridge_id:   Optional[str]
    in_card:        Optional[str]
    tapes:          Optional[List[str]]

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
    cartridge_user_address: Address
    user_address:           Address
    timestamp:              UInt
    score:                  Int
    rule_id:                Bytes32
    rule_input_index:       Int
    tape_id:                Bytes32
    tape_input_index:       Int
    error_code:             UInt
    tapes:                  Bytes32List

@event()
class TapeAward(BaseModel):
    version:                Bytes32
    cartridge_id:           Bytes32
    cartridge_input_index:  Int
    cartridge_user_address: Address
    user_address:           Address
    timestamp:              UInt
    score:                  Int
    rule_id:                Bytes32
    rule_input_index:       Int
    tape_id:                Bytes32
    tape_input_index:       Int
    rank:                   UInt



class RuleInfo(BaseModel):
    id: str
    name: str
    description: str
    cartridge_id: str
    created_by: str
    created_at: int
    input_index: Optional[int]
    args: str
    in_card: bytes
    score_function: str
    # n_tapes: int
    # n_verified: int
    start: Optional[int]
    end: Optional[int]
    tags: List[str]
    allow_tapes: Optional[bool]
    allow_in_card: Optional[bool]
    allow_in_card: Optional[bool]
    save_tapes: Optional[bool]
    save_out_cards: Optional[bool]
    tapes: Optional[List[str]]
    deactivated: Optional[bool]
    
@output()
class RulesOutput(BaseModel):
    data:   List[RuleInfo]
    total:  int
    page:   int

@output()
class RuleTagsOutput(BaseModel):
    tags:   List[str]

class TapeInfo(BaseModel):
    id: str
    cartridge_id: str
    rule_id: str
    user_address: str
    timestamp: int
    input_index: Optional[int]
    score: Optional[int]
    rank: Optional[int]
    verified: Optional[bool]
    in_card: Optional[bytes]
    data: Optional[bytes]
    out_card: Optional[bytes]
    tapes: Optional[List[str]]
    
@output()
class TapesOutput(BaseModel):
    data:   List[TapeInfo]
    total:  int
    page:   int



###
# Mutations

@mutation(proxy=CoreSettings().proxy_address)
def create_rule(payload: RulePayload) -> bool:
    payload_cartridge = format_cartridge_id_from_bytes(payload.cartridge_id)

    # check if Cartridge exists
    cartridge = Cartridge.get(lambda r: r.active and r.unlocked and r.id == payload_cartridge)
    if cartridge is None:
        msg = f"Cartridge {payload_cartridge} doesn't exist"
        LOGGER.error(msg)
        add_output(msg)
        return False

    # check if rule already exists
    if helpers.count(r.id for r in Rule if r.name == payload.name and r.cartridge_id == payload_cartridge) > 0:
        msg = f"Rule {payload.name} already exists for this game"
        LOGGER.error(msg)
        add_output(msg)
        return False

    LOGGER.info(f"Running cartridge test")
    try:
        # run cartridge to test args, incard and get outcard
        test_replay_file = open(CoreSettings().test_tape_path,'rb')
        test_replay = test_replay_file.read()
        test_replay_file.close()

        with open(f"{get_cartridges_path()}/{payload_cartridge}",'rb') as cartridge_file:
            cartridge_data = cartridge_file.read()

        all_tapes = []
        if cartridge.tapes is not None and len(cartridge.tapes) > 0:
            all_tapes.extend(cartridge.tapes)
        all_tapes.extend(map(lambda x: format_tape_id_from_bytes(x), payload.tapes))
        incard = format_incard(all_tapes, [payload.in_card])

        verification_output = verify_log(cartridge_data,test_replay,payload.args,incard)

        rule_id = generate_rule_id(
            hex2bytes(cartridge.primary_id or cartridge.id),
            hex2bytes(cartridge.id),
            str2bytes(payload.name))
        rule = insert_rule(rule_id, payload, verification_output.get("outcard"), **get_metadata().dict())
    except Exception as e:
        msg = f"Couldn't create rule: {e}"
        LOGGER.error(msg)
        add_output(msg)
        return False

    # create_rule_event = RuleCreated(
    #     rule_id = rule_id,
    #     created_by = metadata.msg_sender,
    #     created_at = metadata.timestamp
    # )
    # emit_event(create_rule_event,tags=['rule','create_rule',format_rule_id_from_bytes(rule_id)])
    tags = ['rule',rule.id,payload_cartridge]
    tags.extend(payload.tags)
    index_input(tags=tags)

    return True

@mutation(proxy=CoreSettings().proxy_address)
def deactivate_rule(payload: DeactivateRulePayload) -> bool:
    metadata = get_metadata()

    payload_rule = format_rule_id_from_bytes(payload.rule_id)

    # get Rule
    rule = Rule.get(lambda r: r.id == payload_rule)
    if rule is None:
        msg = f"rule {payload_rule} doesn't exist"
        LOGGER.error(msg)
        add_output(msg)
        return False
    
    if rule.deactivated:
        msg = f"rule {payload_rule} already deactivated"
        LOGGER.error(msg)
        add_output(msg)
        return False
    
    if rule.name == CoreSettings().default_rule_name:
        msg = f"Can't deactivate default rule {payload_rule}"
        LOGGER.error(msg)
        add_output(msg)
        return False
    
    if rule.created_by != metadata['msg_sender'].lower() and \
            metadata['msg_sender'].lower() != CoreSettings().operator_address.lower():
        msg = f"Sender not allowed"
        LOGGER.error(msg)
        add_output(msg)
        return False
    
    rule.deactivated = True

    return True

@mutation(proxy=CoreSettings().proxy_address)
def verify(payload: VerifyPayload) -> bool:
    metadata = get_metadata()

    # Check internal verification lock
    if CoreSettings().internal_verify_lock:
        msg = f"Internal verification locked"
        LOGGER.error(msg)
        add_output(msg)
        return False

    payload_rule = format_rule_id_from_bytes(payload.rule_id)
    # payload_cartridge = format_cartridge_id_from_bytes(payload.cartridge_id)

    # get Rule
    rule = Rule.get(lambda r: r.id == payload_rule)
    if rule is None:
        msg = f"rule {payload_rule} doesn't exist"
        LOGGER.error(msg)
        add_output(msg)
        return False

    if rule.deactivated:
        msg = f"rule {payload_rule} deactivated"
        LOGGER.error(msg)
        add_output(msg)
        return False
    
    # if rule.cartridge_id != payload_cartridge:
    #     msg = f"rule and payload have different cartridge {rule.cartridge_id} != {payload_cartridge}"
    #     LOGGER.error(msg)
    #     add_output(msg)
    #     return False
    
    if not rule.allow_tapes and len(payload.tapes) > 0:
        msg = f"rule {payload_rule} doesn't allow tapes"
        LOGGER.error(msg)
        add_output(msg)
        return False
    
    if not rule.allow_in_card and len(payload.in_card) > 0:
        msg = f"rule {payload_rule} doesn't allow in cards"
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

    tape_id = generate_tape_id(hex2bytes(payload_rule),payload.tape)
    
    # if TapeHash.check_duplicate(tape_id):
    tape = Tape.get(lambda r: r.id == tape_id)
    if tape is not None:
        msg = f"Tape already submitted"
        LOGGER.error(msg)
        add_output(msg)
        return False

    cartridge = Cartridge.get(lambda c: c.active and c.unlocked and c.id == rule.cartridge_id)

    if cartridge is None:
        msg = f"Cartridge not found"
        LOGGER.error(msg)
        add_output(msg)
        return False

    # process tape
    LOGGER.info(f"Verifying tape...")
    try:
        entropy = generate_entropy(metadata.msg_sender, rule.id)

        with open(f"{get_cartridges_path()}/{rule.cartridge_id}",'rb') as cartridge_file:
            cartridge_data = cartridge_file.read()

        all_tapes = []
        if cartridge.tapes is not None and len(cartridge.tapes) > 0:
            all_tapes.extend(cartridge.tapes)
        all_tapes.extend(rule.tapes)
        if rule.allow_tapes and len(payload.tapes) > 0:
            all_tapes.extend(map(lambda x: format_tape_id_from_bytes(x), payload.tapes))

        all_incards = []
        if rule.in_card is not None and len(rule.in_card) > 0:
            all_incards.append(rule.in_card)
        if rule.allow_in_card and len(payload.in_card) > 0:
           all_incards.append(payload.in_card)
        incard = format_incard(all_tapes, all_incards)

        verification_output = verify_log(cartridge_data,payload.tape,rule.args,incard,entropy=entropy)
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

    LOGGER.info(f"Tape {tape_id} verified in input {metadata.input_index}")

    all_tapes = []
    if cartridge.tapes is not None and len(cartridge.tapes) > 0:
        all_tapes.extend([hex2bytes(t) for t in cartridge.tapes])
    if rule.tapes is not None and len(rule.tapes) > 0:
        all_tapes.extend([hex2bytes(t) for t in rule.tapes])
    if rule.allow_tapes and len(tape.tapes) > 0:
        all_tapes.extend([hex2bytes(t) for t in tape.tapes])

    out_ev = VerificationOutput(
        version=get_version(),
        cartridge_id = hex2bytes(cartridge.id),
        cartridge_input_index = cartridge.input_index,
        cartridge_user_address = cartridge.user_address,
        user_address = metadata.msg_sender,
        timestamp = metadata.timestamp,
        score = score,
        rule_id = hex2bytes(rule.id),
        rule_input_index = rule.input_index,
        tape_id = hex2bytes(tape_id),
        tape_input_index = metadata.input_index,
        error_code=0,
        tapes=all_tapes
    )
    common_tags = [rule.cartridge_id,payload_rule,tape_id]
    common_tags.extend(list(rule.tags.name.distinct().keys()))
    index_tags = ["tape"]
    index_tags.extend(common_tags)
    index_input(tags=index_tags,value=metadata.timestamp)
    event_tags = ["score"]
    event_tags.extend(common_tags)
    emit_event(out_ev,tags=event_tags,value=score)
    # add_output(screenshot,tags=['screenshot',rule.cartridge_id,payload_rule,tape_hash.hexdigest()])

    # outcard_to_save = outcard_raw if rule.save_out_cards else True

    t = Tape(
        id = tape_id,
        cartridge_id = cartridge.id,
        rule_id = rule.id,
        user_address = metadata.msg_sender,
        timestamp = metadata.timestamp,
        input_index = metadata.input_index,
        verified = True,
        score = score,
    )
    if rule.allow_tapes and len(payload.tapes) > 0:
        t.tapes = [t.hex() for t in payload.tapes]
    if rule.allow_in_card and len(payload.in_card) > 0:
        t.in_card = payload.in_card
    if rule.save_out_cards:
        t.out_card = outcard_raw
    if rule.save_tapes:
        t.data = payload.tape
    # TapeHash.set_verified(tape_id,outcard_to_save)

    return True

@mutation(proxy=CoreSettings().proxy_address)
def register_external_verification(payload: VerifyPayload) -> bool:
    metadata = get_metadata()
    payload_rule = format_rule_id_from_bytes(payload.rule_id)
    # payload_cartridge = format_cartridge_id_from_bytes(payload.cartridge_id)
    
    # get Rule
    rule = Rule.get(lambda r: r.id == payload_rule)
    if rule is None:
        msg = f"rule {payload_rule} doesn't exist"
        LOGGER.error(msg)
        add_output(msg)
        return False

    if rule.deactivated:
        msg = f"rule {payload_rule} deactivated"
        LOGGER.error(msg)
        add_output(msg)
        return False
    
    # if rule.cartridge_id != payload_cartridge:
    #     msg = f"rule and payload have different cartridge {rule.cartridge_id} != {payload_cartridge}"
    #     LOGGER.error(msg)
    #     add_output(msg)
    #     return False
    
    if not rule.allow_tapes and len(payload.tapes) > 0:
        msg = f"rule {payload_rule} doesn't allow tapes"
        LOGGER.error(msg)
        add_output(msg)
        return False
    
    if not rule.allow_in_card and len(payload.in_card) > 0:
        msg = f"rule {payload_rule} doesn't allow in cards"
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

    tape_id = generate_tape_id(hex2bytes(payload_rule),payload.tape)
    
    # if TapeHash.check_duplicate(tape_id):
    tape = Tape.get(lambda r: r.id == tape_id)
    if tape is not None:
        msg = f"Tape already submitted"
        LOGGER.error(msg)
        add_output(msg)
        return False

    cartridge = Cartridge.get(lambda c: c.active and c.unlocked and c.id == rule.cartridge_id)

    if cartridge is None:
        msg = f"Cartridge not found"
        LOGGER.error(msg)
        add_output(msg)
        return False

    LOGGER.info(f"Received new tape {tape_id} in input {metadata.input_index}")
    tags = ["tape",rule.cartridge_id,payload_rule,tape_id]
    tags.extend(list(rule.tags.name.distinct().keys()))
    index_input(tags=tags,value=metadata.timestamp)
    # TapeHash.add(tape_id)#(rule.cartridge_id,rule.id,tape_id)

    t = Tape(
        id = tape_id,
        cartridge_id = cartridge.id,
        rule_id = rule.id,
        user_address = metadata.msg_sender,
        timestamp = metadata.timestamp,
        input_index = metadata.input_index,
        verified = False,
    )
    if rule.allow_tapes and len(payload.tapes) > 0:
        t.tapes = [t.hex() for t in payload.tapes]
    if rule.allow_in_card and len(payload.in_card) > 0:
        t.in_card = payload.in_card
    if rule.save_tapes:
        t.data = payload.tape
    # TapeHash.set_verified(tape_id,outcard_to_save)

    return True

@mutation(proxy=CoreSettings().proxy_address)
def external_verification(payload: ExternalVerificationPayload) -> bool:
    metadata = get_metadata()
    # only operator
    if metadata.msg_sender.lower() != CoreSettings().operator_address:
        msg = f"sender not allowed"
        LOGGER.error(msg)
        add_output(msg)
        return False

    payload_lens = [
        len(payload.tape_ids),
        len(payload.scores),
        len(payload.error_codes),
        len(payload.outcards),
    ]
    if len(set(payload_lens)) != 1:
        msg = f"payload have distinct sizes"
        LOGGER.error(msg)
        add_output(msg)
        return False
    
    LOGGER.info(f"Received batch of tape verifications")
    for ind in range(len(payload.tape_ids)):

        tape_id = format_tape_id_from_bytes(payload.tape_ids[ind])

        # if not TapeHash.check_duplicate(tape_id):
        tape = Tape.get(lambda r: r.id == tape_id)
        if tape is None:
            msg = f"Tape not submitted"
            LOGGER.warning(msg)
            # add_output(msg)
            # return False
            continue

        # if TapeHash.check_verified(tape_id):
        if tape.verified:
            msg = f"Tape already verified"
            LOGGER.warning(msg)
            # add_output(msg)
            # return False
            continue

        # get Rule
        rule = Rule.get(lambda r: r.id == tape.rule_id)
        if rule is None:
            msg = f"rule {tape.rule_id} doesn't exist"
            LOGGER.warning(msg)
            # add_output(msg)
            # return False
            continue
        
        if rule.deactivated:
            msg = f"rule {tape.rule_id} deactivated"
            LOGGER.warning(msg)
            # add_output(msg)
            # return False
            continue
        
        cartridge = Cartridge.get(lambda c: c.active and c.unlocked and c.id == rule.cartridge_id)

        if cartridge is None:
            msg = f"Cartridge not found"
            LOGGER.error(msg)
            # add_output(msg)
            # return False
            continue

        all_tapes = []
        if cartridge.tapes is not None and len(cartridge.tapes) > 0:
            all_tapes.extend([hex2bytes(t) for t in cartridge.tapes])
        if rule.tapes is not None and len(rule.tapes) > 0:
            all_tapes.extend([hex2bytes(t) for t in rule.tapes])
        if rule.allow_tapes and len(tape.tapes) > 0:
            all_tapes.extend([hex2bytes(t) for t in tape.tapes])

        out_ev = VerificationOutput(
            version=get_version(),
            cartridge_id = hex2bytes(cartridge.id),
            cartridge_input_index = cartridge.input_index,
            cartridge_user_address = cartridge.user_address,
            user_address = tape.user_address,
            timestamp = tape.timestamp,
            score = payload.scores[ind],
            rule_id = hex2bytes(rule.id),
            rule_input_index = rule.input_index,
            tape_id = hex2bytes(tape_id),
            tape_input_index = tape.input_index,
            error_code = payload.error_codes[ind],
            tapes=all_tapes
        )

        LOGGER.info(f"Sending tape verification output")

        tags = ['score',cartridge.id,rule.id,tape.id]
        tags.extend(list(rule.tags.name.distinct().keys()))
        emit_event(out_ev,tags=tags,value=payload.scores[ind])

        # tape_to_save = payload.outcards[ind] if rule.save_tapes else True

        # TapeHash.set_verified(tape_id,tape_to_save)
        
        tape.verified = True
        tape.score = payload.scores[ind]
        if rule.save_out_cards and payload.error_codes[ind] == ErrorCode.NONE.value:
            tape.out_card = payload.outcards[ind]

    return True

@mutation(proxy=CoreSettings().proxy_address)
def award_winners(payload: AwardWinnerTapesPayload) -> bool:
    metadata = get_metadata()
    # only operator
    if metadata.msg_sender.lower() != CoreSettings().operator_address:
        msg = f"sender not allowed"
        LOGGER.error(msg)
        add_output(msg)
        return False

    if payload.tapes_to_award < 1:
        msg = f"Should award at least one tape"
        LOGGER.error(msg)
        add_output(msg)
        return False

    payload_rule = format_rule_id_from_bytes(payload.rule_id)
    # payload_cartridge = format_cartridge_id_from_bytes(payload.cartridge_id)
    
    # get Rule
    rule = Rule.get(lambda r: r.id == payload_rule)
    if rule is None:
        msg = f"rule {payload_rule} doesn't exist"
        LOGGER.error(msg)
        add_output(msg)
        return False

    cartridge = Cartridge.get(lambda c: c.id == rule.cartridge_id)

    if cartridge is None:
        msg = f"Cartridge not found"
        LOGGER.error(msg)
        add_output(msg)
        return False

    if rule.score_function is None or len(rule.score_function) == 0:
        msg = f"rule {payload_rule} doesn't have score"
        LOGGER.error(msg)
        add_output(msg)
        return False

    if rule.start is None or rule.end is None:
        msg = f"rule has no start/end"
        LOGGER.error(msg)
        add_output(msg)
        return False

    if metadata.timestamp < rule.start or metadata.timestamp < rule.end:
        msg = f"rule submission period not ended yet"
        LOGGER.error(msg)
        add_output(msg)
        return False
    
    total_tapes = Tape.select(lambda r: r.rule_id == rule.id).count()
    tapes_verified_query = Tape.select(lambda r: r.rule_id == rule.id and 
                                       r.verified and r.score is not None)
    total_verified = tapes_verified_query.count()

    if total_verified < total_tapes:
        msg = f"not all tapes verified"
        LOGGER.error(msg)
        add_output(msg)
        return False
    
    tapes_to_award = tapes_verified_query.order_by(helpers.desc(Tape.score)).page(1,payload.tapes_to_award)

    rank = 1
    tags = ['award',rule.cartridge_id,payload_rule]
    for tape in tapes_to_award:
        if tape.rank is not None: continue
        e = TapeAward(
            version=get_version(),
            cartridge_id = hex2bytes(cartridge.id),
            cartridge_input_index = cartridge.input_index,
            cartridge_user_address = cartridge.user_address,
            user_address = tape.user_address,
            timestamp = tape.timestamp,
            score = tape.score,
            rule_id = hex2bytes(rule.id),
            rule_input_index = rule.input_index,
            tape_id = hex2bytes(tape.id),
            tape_input_index = tape.input_index,
            rank=rank
        )
        tape.rank = rank
        rank += 1
        ev_tags = tags.copy()
        ev_tags.extend([tape.id,tape.user_address])
        emit_event(e,tags=ev_tags,value=rank)

    return True

@mutation(proxy=CoreSettings().proxy_address)
def clean_tapes(payload: CleanTapesPayload) -> bool:
    metadata = get_metadata()
    # only operator
    if metadata.msg_sender.lower() != CoreSettings().operator_address:
        msg = f"sender not allowed"
        LOGGER.error(msg)
        add_output(msg)
        return False

    payload_rule = format_rule_id_from_bytes(payload.rule_id)
    
    # get Rule
    rule = Rule.get(lambda r: r.id == payload_rule)
    if rule is None:
        msg = f"rule {payload_rule} doesn't exist"
        LOGGER.error(msg)
        add_output(msg)
        return False
    
    tapes = Tape.select(lambda r: r.rule_id == rule.id)
    for tape in tapes:
        if tape.out_card and len(tape.out_card) > 0:
            add_output(
                tape.out_card,
                tags=['outcard',rule.cartridge_id,rule.id,tape.id]
            )
            tape.out_card = None
        if tape.data and len(tape.data) > 0:
            tape.data = None
        if tape.in_card and len(tape.in_card) > 0:
            tape.in_card = None

    return True
###
# Queries

@query()
def rules(payload: GetRulesPayload) -> bool:
    rules_query = Rule.select()
    
    if payload.enable_deactivated is None or not payload.enable_deactivated:
        rules_query = rules_query.filter(lambda c: not c.deactivated)
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
    if payload.has_start is not None and payload.has_start:
        rules_query = rules_query.filter(lambda r: r.start is not None)
    if payload.has_end is not None and payload.has_end:
        rules_query = rules_query.filter(lambda r: r.end is not None)
    if payload.created_by is not None:
        rules_query = rules_query.filter(lambda r: payload.created_by.lower() == r.created_by)
    if payload.tags is not None and len(payload.tags) > 0:
        if payload.tags_or is not None and payload.tags_or:
            tags_fn = lambda t: t.name in payload.tags
        else:
            tags_fn = lambda t: t.name in payload.tags and helpers.count(t) == len(payload.tags)
        rules_query = helpers.distinct(
            r for r in rules_query for t in RuleTag if r in t.rules and tags_fn(t)
        )
    else:
        rules_query = helpers.distinct(
            o for o in rules_query
        )

    total = rules_query.count()

    if payload.order_by is not None:
        order_dict = {"asc":lambda d: d,"desc":helpers.desc}
        order_dir_list = []
        order_by_list = payload.order_by.split(',')
        if payload.order_dir is not None:
            order_dir_list = payload.order_dir.split(',')
        for idx,ord in enumerate(order_by_list):
            if idx < len(order_dir_list): dir_order = order_dict[order_dir_list[idx]]
            else: dir_order = order_dict["asc"]
            rules_query = rules_query.order_by(dir_order(getattr(Rule,ord)))

    page = 1
    if payload.page is not None:
        page = payload.page
        if payload.page_size is not None:
            rules = rules_query.page(payload.page,payload.page_size)
        else:
            rules = rules_query.page(payload.page)
    else:
        rules = rules_query
    
    full = payload.full is not None and payload.full
    dict_list_result = []
    for r in rules:
        dict_rule = r.to_dict(with_lazy=full)
        # summary = TapeHash.get_rule_tapes_summary(r.id)
        # dict_rule["n_tapes"] = summary["all"]
        # dict_rule["n_verified"] = summary["verified"]
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
    if payload.name is not None:
        tags_query = tags_query.filter(lambda r: payload.name in r.name)

    tag_names = helpers.select(r.name for r in tags_query).fetch()
    out = RuleTagsOutput.parse_obj({"tags":list(tag_names)})
    add_output(out)

    return True

@query()
def tapes(payload: GetTapesPayload) -> bool:
    tapes_query = Tape.select()
    
    if payload.id is not None:
        tapes_query = tapes_query.filter(lambda r: payload.id == r.id)
    if payload.ids is not None:
        tapes_query = tapes_query.filter(lambda r: r.id in payload.ids)
    if payload.cartridge_id is not None:
        tapes_query = tapes_query.filter(lambda r: r.cartridge_id == payload.cartridge_id)
    if payload.rule_id is not None:
        tapes_query = tapes_query.filter(lambda r: r.rule_id == payload.rule_id)
    if payload.rank_lte is not None:
        tapes_query = tapes_query.filter(lambda r: payload.rank_lte <= r.rank)
    if payload.rank_gte is not None:
        tapes_query = tapes_query.filter(lambda r: payload.rank_gte >= r.rank)
    if payload.timestamp_lte is not None:
        tapes_query = tapes_query.filter(lambda r: payload.timestamp_lte <= r.timestamp)
    if payload.timestamp_gte is not None:
        tapes_query = tapes_query.filter(lambda r: payload.timestamp_gte >= r.timestamp)
    if payload.user_address is not None:
        tapes_query = tapes_query.filter(lambda r: payload.user_address.lower() == r.user_address)

    if payload.tags is not None and len(payload.tags) > 0:
        if payload.tags_or is not None and payload.tags_or:
            tags_fn = lambda t: t.name in payload.tags
        else:
            tags_fn = lambda t: t.name in payload.tags and helpers.count(t) == len(payload.tags)
        tapes_query = helpers.distinct(
            i for i in tapes_query for r in Rule for t in RuleTag if i.rule_id == r.id and r in t.rules and tags_fn(t)
        )
    else:
        tapes_query = helpers.distinct(
            o for o in tapes_query
        )

    total = tapes_query.count()

    if payload.order_by is not None:
        order_dict = {"asc":lambda d: d,"desc":helpers.desc}
        order_dir_list = []
        order_by_list = payload.order_by.split(',')
        if payload.order_dir is not None:
            order_dir_list = payload.order_dir.split(',')
        for idx,ord in enumerate(order_by_list):
            if idx < len(order_dir_list): dir_order = order_dict[order_dir_list[idx]]
            else: dir_order = order_dict["asc"]
            tapes_query = tapes_query.order_by(dir_order(getattr(Tape,ord)))

    page = 1
    if payload.page is not None:
        page = payload.page
        if payload.page_size is not None:
            tapes = tapes_query.page(payload.page,payload.page_size)
        else:
            tapes = tapes_query.page(payload.page)
    else:
        tapes = tapes_query
    
    full = payload.full is not None and payload.full
    dict_list_result = []
    for r in tapes:
        dict_tapes = r.to_dict(with_lazy=full)
        dict_list_result.append(dict_tapes)

    LOGGER.info(f"Returning {len(dict_list_result)} of {total} tapes")
    
    out = TapesOutput.parse_obj({'data':dict_list_result,'total':total,'page':page})
    
    add_output(out)

    return True


@query()
def format_in_card(payload: FormatInCardPayload) -> bool:

    incard = b''
    all_tapes = []
    all_incards = []
    if payload.rule_id is not None:
        # get Rule
        rule = Rule.get(lambda r: r.id == payload.rule_id)
        if rule is None:
            msg = f"rule {payload.rule_id} doesn't exist"
            LOGGER.error(msg)
            add_output(msg)
            return False

        cartridge = Cartridge.get(lambda c: c.id == rule.cartridge_id)

        if cartridge is None:
            msg = f"Cartridge not found"
            LOGGER.error(msg)
            add_output(msg)
            return False

        if cartridge.tapes is not None and len(cartridge.tapes) > 0:
            all_tapes.extend(cartridge.tapes)
        all_tapes.extend(rule.tapes)
        if rule.allow_tapes and payload.tapes is not None and len(payload.tapes) > 0:
            all_tapes.extend(payload.tapes)

        if rule.in_card is not None and len(rule.in_card) > 0:
            all_incards.append(rule.in_card)
        if rule.allow_in_card and payload.in_card is not None and len(payload.in_card) > 0:
            all_incards.append(hex2bytes(payload.in_card))
    elif payload.cartridge_id is not None:

        cartridge = Cartridge.get(lambda c: c.id == payload.cartridge_id)

        if cartridge is None:
            msg = f"Cartridge not found"
            LOGGER.error(msg)
            add_output(msg)
            return False

        if cartridge.tapes is not None and len(cartridge.tapes) > 0:
            all_tapes.extend(cartridge.tapes)
        if payload.tapes is not None and len(payload.tapes) > 0:
            all_tapes.extend(payload.tapes)

        if payload.in_card is not None and len(payload.in_card) > 0:
            all_incards.append(hex2bytes(payload.in_card))

    else:
        if payload.tapes is not None and len(payload.tapes) > 0:
            all_tapes.extend(payload.tapes)

        if payload.in_card is not None and len(payload.in_card) > 0:
            all_incards.append(hex2bytes(payload.in_card))

    incard = format_incard(all_tapes, all_incards)

    LOGGER.info(f"Returning formatted in card with len {len(incard)}")
    add_output(incard)

    return True