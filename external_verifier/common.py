import os
import sys
import json
from web3 import Web3
import redis
import time
from typing import Optional, List, Generator
from multiprocessing import Manager
import logging
from pydantic import BaseModel
from py_expression_eval import Parser
from enum import Enum
import tempfile
import traceback
# from dotenv import load_dotenv

from cartesi import abi
from cartesi.models import ABIFunctionSelectorHeader
from cartesapp.utils import hex2bytes, str2bytes, bytes2hex, bytes2str

if os.path.isdir('../core'):
    sys.path.append("..")

from core.model import Bytes32List, format_bytes_list_to_incard
from core.admin import SetOperatorPayload
from core.cartridge import InsertCartridgePayload, RemoveCartridgePayload
from core.tape import VerifyPayload, RulePayload, ExternalVerificationPayload, ErrorCode
from core.riv import verify_log, riv_get_cartridge_info
from core.core_settings import CoreSettings, generate_entropy, generate_rule_id, \
    generate_tape_id, generate_cartridge_id, generate_cartridge_id as core_generate_cartridge_id, \
    format_rule_id_from_bytes, format_cartridge_id_from_bytes, format_tape_id_from_bytes
LOGGER = logging.getLogger("external_verifier.common")

# load_dotenv() 


###
# Conf

# required
RIVEMU_PATH = os.getenv('RIVEMU_PATH') or ''
OPERATOR_ADDRESS = os.getenv('OPERATOR_ADDRESS') or ""
DAPP_ADDRESS = os.getenv('DAPP_ADDRESS') or ""
PRIVATE_KEY = os.getenv('PRIVATE_KEY') or ''

# recommended
DAPP_DEPLOY_BLOCK = os.getenv('DAPP_DEPLOY_BLOCK') or 0
RIVES_VERSION = os.getenv('RIVES_VERSION') or '0'

REDIS_HOST = os.getenv('REDIS_HOST') or "localhost"
REDIS_PORT = os.getenv('REDIS_PORT') or 6379
RPC_URL = os.getenv('RPC_URL') or "http://localhost:8545"
WSS_URL = os.getenv('WSS_URL')
PROXY_ADDRESS = os.getenv('PROXY_ADDRESS')
WORLD_ADDRESS = os.getenv('WORLD_ADDRESS')

# check likely
INPUT_BOX_ADDRESS = os.getenv('INPUT_BOX_ADDRESS') or "0x59b22D57D4f067708AB0c00552767405926dc768"
INPUT_BOX_ABI_FILE = os.getenv('INPUT_BOX_ABI_FILE') or 'InputBox.json'
TEST_TAPE_PATH = os.getenv('TEST_TAPE_PATH') or '../misc/test.rivlog'
GENESIS_CARTRIDGES_PATH = os.getenv('GENESIS_CARTRIDGES_PATH') or '../misc'
GENESIS_CARTRIDGES = os.getenv('GENESIS_CARTRIDGES')
VERIFICATIONS_BATCH_SIZE = os.getenv('VERIFICATIONS_BATCH_SIZE') or 10

# consts
REDIS_VERIFY_QUEUE_KEY = f"rives_verify_queue_{RIVES_VERSION}"
REDIS_VERIFY_PROCESSING_QUEUE_KEY = f"rives_verify_processing_queue_{RIVES_VERSION}"
REDIS_CARTRIDGES_KEY = f"rives_cartridges_{RIVES_VERSION}"
REDIS_CARTRIDGE_INFOS_KEY = f"rives_cartridge_infos_{RIVES_VERSION}"
REDIS_CARTRIDGE_NAMES_MAP_KEY = f"rives_cartridge_names_id_map_{RIVES_VERSION}"
REDIS_CARTRIDGE_VERSIONS_KEY = f"rives_cartridge_versions_{RIVES_VERSION}"
REDIS_TAPES_KEY = f"rives_tapes_{RIVES_VERSION}"
REDIS_RULES_KEY = f"rives_rules_{RIVES_VERSION}"
REDIS_VERIFY_OUTPUT_QUEUE_KEY = f"rives_verify_output_queue_{RIVES_VERSION}"
REDIS_VERIFY_OUTPUT_TEMP_QUEUE_KEY = f"rives_verify_output_temp_queue_{RIVES_VERSION}"
REDIS_ERROR_VERIFICATION_KEY = f"rives_error_verification_{RIVES_VERSION}"
REDIS_BLOCK_KEY = f"rives_processed_block_{RIVES_VERSION}"
REDIS_OPERATOR_KEY = f"rives_operator_address_{RIVES_VERSION}"
MAX_BLOCK_RANGE = 5000

###
# Model

class DbType(str, Enum):
    mem = "mem"
    redis = "redis"

class InputType(str, Enum):
    rule = "rule"
    cartridge = "cartridge"
    verification = "verification"
    remove_cartridge = "remove_cartridge"
    set_operator = "set_operator"
    unknown = "unknown"
    error = "error"
    none = "none"

class Rule(BaseModel):
    # id:                 str
    name:               str
    cartridge_id:       str
    args:               str
    in_card:            bytes
    score_function:     str
    sender:             Optional[str]
    start:              int
    end:                int
    tapes:              List[bytes]
    allow_tapes:        bool
    allow_in_card:      bool
    save_tapes:         bool
    save_out_cards:     bool

class ExtendedVerifyPayload(BaseModel):
    rule_id:        abi.Bytes32
    outcard_hash:   abi.Bytes32
    tape:           abi.Bytes
    claimed_score:  abi.Int
    tapes:          Bytes32List
    in_card:        abi.Bytes
    sender:         abi.Address
    timestamp:      abi.Int
    input_index:    abi.Int

class ExtendedInsertCartridgePayload(BaseModel):
    data:           abi.Bytes
    sender:         abi.Address

class ExtendedRemoveCartridgePayload(BaseModel):
    id:             abi.Bytes32
    sender:         abi.Address

class ExtendedSetOperatorPayload(BaseModel):
    new_operator_address:   abi.Address
    sender:                 abi.Address

class ExternalVerificationOutput(BaseModel):
    tape_id:            str
    score:              int
    error_code:         int
    outcard:            bytes

class InputData(BaseModel):
    type: InputType
    last_input_block: int
    data: BaseModel | None

class Error(BaseModel):
    msg: str

generate_cartridge_id = core_generate_cartridge_id


###
# Storage models

class HashMap:
    db = None
    manager = None
    def __new__(cls):
        cls.manager = Manager()
        cls.db = cls.manager.dict()
        return cls
    @classmethod
    def set(cls,k1,val):
        cls.db[k1] = val
    @classmethod
    def get(cls,k1):
        return cls.db.get(k1)
    @classmethod
    def delete(cls,k1):
        del(cls.db[k1])
    @classmethod
    def hset(cls,k1,k2,val):
        if cls.db.get(k1) is None: cls.db[k1] = cls.manager.dict()
        cls.db[k1][k2] = val
    @classmethod
    def hget(cls,k1,k2):
        if cls.db.get(k1) is None: return None
        return cls.db[k1].get(k2)
    @classmethod
    def hexists(cls,k1,k2):
        return cls.db.get(k1) is not None and cls.db[k1].get(k2)
    @classmethod
    def lpush(cls,k1,val):
        if cls.db.get(k1) is None: cls.db[k1] = cls.manager.list()
        cls.db[k1].insert(0,val)
    @classmethod
    def rpoplpush(cls,k1,k2):
        if cls.db.get(k1) is None or len(cls.db[k1]) == 0: return None
        if cls.db.get(k2) is None: cls.db[k2] = cls.manager.list()
        cls.db[k2].insert(0,val := cls.db[k1].pop())
        return val
    @classmethod
    def brpoplpush(cls,k1,k2,t = 0):
        if t > 0:
            slept = 0
            t0 = time.time()
            while slept < t:
                if cls.db.get(k1) is not None and len(cls.db[k1]) > 0:
                    break
                time.sleep(1)
                slept = time.time() - t0
        else:
            while True:
                if cls.db.get(k1) is not None and len(cls.db[k1]) > 0:
                    break
                time.sleep(1)
        return cls.rpoplpush(k1,k2)
    @classmethod
    def lrem(cls,k1,n,val):
        if cls.db.get(k1) is None or len(cls.db[k1]) == 0: return None
        for i in range(abs(n)):
            if val in cls.db[k1]:
                cls.db[k1].remove(val)

class Storage:
    store = None
    def __new__(cls, db = DbType):
        if db == DbType.redis:
            cls.store = redis.Redis(host=REDIS_HOST, port=REDIS_PORT)
        elif db == DbType.mem:
            cls.store = HashMap()
        else:
            raise Exception(f"Unrecognized db {db}")
        return cls

    @classmethod
    def get_operator_address(cls) -> Rule:
        op_addr = cls.store.get(REDIS_OPERATOR_KEY)
        return op_addr.decode('utf-8') if op_addr is not None else None

    @classmethod
    def set_operator_address(cls, addr: str) -> Rule:
        return cls.store.set(REDIS_OPERATOR_KEY, addr.lower())

    @classmethod
    def get_processed_block(cls) -> Rule:
        return cls.store.get(REDIS_BLOCK_KEY)

    @classmethod
    def set_processed_block(cls, block: int) -> Rule:
        return cls.store.set(REDIS_BLOCK_KEY, block)

    @classmethod
    def add_error(cls,input_index: int, error_msg: str) -> int:
        cls.store.hset(REDIS_ERROR_VERIFICATION_KEY,input_index,error_msg)

    @classmethod
    def add_cartridge(cls,cartridge_id,cartridge_data):
        if not cls.store.hexists(REDIS_CARTRIDGES_KEY,cartridge_id):
            cls.store.hset(REDIS_CARTRIDGES_KEY,cartridge_id,cartridge_data)
    
    @classmethod
    def get_cartridge_data(cls,cartridge_id: str) -> bytes:
        return cls.store.hget(REDIS_CARTRIDGES_KEY,cartridge_id)

    @classmethod
    def remove_cartridge_data(cls,cartridge_id: str) -> bytes:
        return cls.store.hdel(REDIS_CARTRIDGES_KEY,cartridge_id)

    @classmethod
    def add_cartridge_info(cls,cartridge_id,cartridge_info):
        if not cls.store.hexists(REDIS_CARTRIDGE_INFOS_KEY,cartridge_id):
            cls.store.hset(REDIS_CARTRIDGE_INFOS_KEY,cartridge_id,json.dumps(cartridge_info))
            primary = cls.get_primary_cartridge_id(cartridge_id)
            if primary is None:
                if cartridge_info.get('name') is not None:
                    cls.store.hset(REDIS_CARTRIDGE_NAMES_MAP_KEY,cartridge_info['name'],cartridge_id)
                cls.store.hset(REDIS_CARTRIDGE_VERSIONS_KEY,cartridge_id,json.dumps([]))
            else:
                versions = json.loads(cls.store.hget(REDIS_CARTRIDGE_VERSIONS_KEY,primary))
                versions.append(cartridge_id)
                cls.store.hset(REDIS_CARTRIDGE_VERSIONS_KEY,primary,json.dumps(versions))

    @classmethod
    def get_cartridge_info(cls,cartridge_id: str) -> bytes:
        info = cls.store.hget(REDIS_CARTRIDGE_INFOS_KEY,cartridge_id)
        return json.loads(info) if info is not None else None

    @classmethod
    def get_primary_cartridge_id(cls,cartridge_id: str) -> bytes:
        info = cls.store.hget(REDIS_CARTRIDGE_INFOS_KEY,cartridge_id)
        if info is None: return None
        info = json.loads(info)
        if info.get('name') is None: return None
        primary = cls.store.hget(REDIS_CARTRIDGE_NAMES_MAP_KEY,info.get('name'))
        return primary.decode('utf-8') if primary is not None else None

    @classmethod
    def get_cartridge_versions(cls,cartridge_id: str) -> bytes:
        versions = cls.store.hget(REDIS_CARTRIDGE_VERSIONS_KEY,cartridge_id)
        if versions is None: return None
        return json.loads(versions)

    # @classmethod
    # def exist_rule(cls,rule_id):
    #     return cls.store.hexists(REDIS_RULES_KEY,rule_id)
    
    @classmethod
    def get_rule(cls,rule_id: str) -> Rule:
        json_rule = cls.store.hget(REDIS_RULES_KEY,rule_id)
        if json_rule is None: return None
        rule_dict = json.loads(json_rule)
        rule_dict.update({
            "in_card": hex2bytes(rule_dict['in_card']),
            "tapes":[hex2bytes(t) for t in rule_dict['tapes']]
        })
        return Rule.parse_obj(rule_dict)

    @classmethod
    def add_rule(cls,rule_id,rule):
        if not cls.store.hexists(REDIS_RULES_KEY,rule_id):
            rule_dict = rule.dict()
            rule_dict.update({
                "in_card":rule.in_card.hex(),
                "tapes":[t.hex() for t in rule.tapes]
            })
            cls.store.hset(REDIS_RULES_KEY,rule_id,json.dumps(rule_dict))

    # @classmethod
    # def exist_cartridge(cls,cartridge_id):
    #     return cls.store.hexists(REDIS_CARTRIDGES_KEY,cartridge_id)
    
    @classmethod
    def add_tape(cls,tape_id,outcard):
        if not cls.store.hexists(REDIS_TAPES_KEY,tape_id):
            cls.store.hset(REDIS_TAPES_KEY,tape_id,outcard)
    
    @classmethod
    def get_tape(cls,tape_id: str) -> bytes:
        return cls.store.hget(REDIS_TAPES_KEY,tape_id)

    @classmethod
    def push_verification(cls,data):
        return cls.store.lpush(REDIS_VERIFY_QUEUE_KEY, data)

    @classmethod
    def pop_verification(cls, timeout = 0):
        return cls.store.brpoplpush(REDIS_VERIFY_QUEUE_KEY,REDIS_VERIFY_PROCESSING_QUEUE_KEY,timeout)

    @classmethod
    def reset_processing_verification(cls):
        while True:
            if cls.store.rpoplpush(REDIS_VERIFY_PROCESSING_QUEUE_KEY,REDIS_VERIFY_QUEUE_KEY) is None:
                break

    @classmethod
    def remove_processing_verification(cls,serialized_data: str) -> bytes:
        return cls.store.lrem(REDIS_VERIFY_PROCESSING_QUEUE_KEY,1,serialized_data)

    @classmethod
    def push_output(cls,data):
        return cls.store.lpush(REDIS_VERIFY_OUTPUT_QUEUE_KEY, data)

    @classmethod
    def pop_output(cls, timeout = 0):
        return cls.store.brpoplpush(REDIS_VERIFY_OUTPUT_QUEUE_KEY,REDIS_VERIFY_OUTPUT_TEMP_QUEUE_KEY,timeout)

    @classmethod
    def reset_temp_output(cls, timeout = 0):
        while True:
            if cls.store.rpoplpush(REDIS_VERIFY_OUTPUT_TEMP_QUEUE_KEY,REDIS_VERIFY_OUTPUT_QUEUE_KEY) is None:
                break

    @classmethod
    def remove_temp_output(cls,serialized_data: str) -> bytes:
        return cls.store.lrem(REDIS_VERIFY_OUTPUT_TEMP_QUEUE_KEY,1,serialized_data)


def deserialize_verification(serialized_data: bytes) -> ExtendedVerifyPayload:
    return abi.decode_to_model(data=serialized_data, model=ExtendedVerifyPayload)

def deserialize_output(serialized_data: bytes) -> ExternalVerificationOutput:
    return ExternalVerificationOutput.parse_raw(serialized_data)

###
# Verification/sender functions

def riv_verification(cartridge_data:bytes,args:str,in_card:bytes):
    with open(TEST_TAPE_PATH,'rb') as test_replay_file:
        test_replay = test_replay_file.read()
    try:
        verification_output = verify_log(cartridge_data,test_replay,args,in_card)
    except Exception as e:
        LOGGER.warning(e)
        traceback.print_exc()
        return None
    return verification_output

def rule_verification(cartridge_data:bytes, rule: Rule, formatted_in_card: bytes):

    out = riv_verification(cartridge_data,rule.args,formatted_in_card)

    if out is None:
        LOGGER.error(f"Error verifying log")
        return None
    
    outcard_raw = out.get('outcard')

    if rule.score_function is not None and len(rule.score_function) > 0:
        outcard_format = outcard_raw[:4]
        if outcard_format != b"JSON":
            LOGGER.error(f"Outcard format is not json")
            return None

        outcard_str = bytes2str(outcard_raw[4:])

        try:
            outcard_json = json.loads(outcard_str)
        except Exception as e:
            LOGGER.erro(f"Couldn't parse json outcard: {e}")
            return None

        try:
            parser = Parser()
            score = parser.parse(rule.score_function).evaluate(outcard_json)
        except Exception as e:
            LOGGER.error(f"Couldn't parse score: {e}")
            return None

    return rule

def tape_verification(payload: ExtendedVerifyPayload) -> ExternalVerificationOutput:
    sender = payload.sender
    timestamp = payload.timestamp
    input_index = payload.input_index

    payload_rule = format_rule_id_from_bytes(payload.rule_id)
    rule = Storage.get_rule(payload_rule)
    if rule is None:
        msg = f"Couldn't find rule"
        LOGGER.error(msg)
        Storage.add_error(input_index,msg)
        return None

    cartridge_id = _normalize_hex(rule.cartridge_id)
    
    if not rule.allow_tapes and len(payload.tapes) > 0:
        msg = f"rule {payload_rule} doesn't allow tapes"
        LOGGER.error(msg)
        Storage.add_error(input_index,msg)
        return None
    
    if not rule.allow_in_card and len(payload.in_card) > 0:
        msg = f"rule {payload_rule} doesn't allow in cards"
        LOGGER.error(msg)
        Storage.add_error(input_index,msg)
        return None
    
    cartridge_data = Storage.get_cartridge_data(cartridge_id)
    if cartridge_data is None or len(cartridge_data) == 0:
        msg = f"Couldn't find cartridge"
        LOGGER.error(msg)
        Storage.add_error(input_index,msg)
        return None
    
    if rule.start > 0 and rule.start > timestamp:
        msg = f"Timestamp earlier than rule start"
        LOGGER.error(msg)
        Storage.add_error(input_index,msg)
        return None

    if rule.end > 0 and rule.end < timestamp:
        msg = f"Timestamp later than rule end"
        LOGGER.error(msg)
        Storage.add_error(input_index,msg)
        return None

    entropy = generate_entropy(sender, payload.rule_id.hex())

    tape_id = generate_tape_id(payload.rule_id,payload.tape)
    out_params = {
        "tape_id": tape_id,
        "score": 0,
        "error_code": 0,
        "outcard":b''
    }

    # process tape
    LOGGER.info(f"Verifying tape...")
    try:

        cartridge_info_json = Storage.get_cartridge_info(cartridge_id)

        all_tapes = []
        cartridge_tapes = cartridge_info_json.get("tapes")
        if cartridge_tapes is not None and len(cartridge_tapes) > 0:
            all_tapes.extend(cartridge_tapes)
        if rule.tapes is not None and len(rule.tapes) > 0:
            all_tapes.extend(map(lambda x: format_tape_id_from_bytes(x), rule.tapes))
        if rule.allow_tapes and len(payload.tapes) > 0:
            all_tapes.extend(map(lambda x: format_tape_id_from_bytes(x), payload.tapes))

        all_incards = []
        if rule.in_card is not None and len(rule.in_card) > 0:
            all_incards.append(rule.in_card)
        if rule.allow_in_card and len(payload.in_card) > 0:
           all_incards.append(payload.in_card)
        incard = format_incard(all_tapes, all_incards)

        verification_output = verify_log(cartridge_data,payload.tape,rule.args,incard,entropy=entropy)
    except Exception as e:
        msg = f"Couldn't verify tape: {e}"
        LOGGER.error(msg)
        Storage.add_error(input_index,msg)
        out_params["error_code"] = ErrorCode.VERIFICATION_ERROR
        return ExternalVerificationOutput.parse_obj(out_params)

    outcard_raw = verification_output.get('outcard')
    outhash = verification_output.get('outhash')

    # compare outcard
    tape_outcard_hash = payload.outcard_hash 
    if tape_outcard_hash == b'\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0':
        tape_outcard_hash = outhash

    outcard_valid = outhash == tape_outcard_hash
    outcard_format = outcard_raw[:4]

    if not outcard_valid:
        msg = f"Out card hash doesn't match"
        LOGGER.error(msg)
        Storage.add_error(input_index,msg)
        out_params["error_code"] = ErrorCode.OUTHASH_MATCH_ERROR
        return ExternalVerificationOutput.parse_obj(out_params)

    score = 0
    if rule.score_function is not None and len(rule.score_function) > 0 and outcard_format == b"JSON":
        try:
            outcard_json = json.loads(bytes2str(outcard_raw[4:]))
            parser = Parser()
            score = parser.parse(rule.score_function).evaluate(outcard_json)
        except Exception as e:
            msg = f"Couldn't load/parse score from json: {e}"
            LOGGER.error(msg)
            Storage.add_error(input_index,msg)
            out_params["error_code"] = ErrorCode.SCORE_ERROR
            return ExternalVerificationOutput.parse_obj(out_params)

        # compare claimed score
        claimed_score = payload.claimed_score
        if claimed_score == 0:
            claimed_score = score

        score_valid = score == claimed_score

        if not score_valid:
            msg = f"Score doesn't match"
            LOGGER.error(msg)
            Storage.add_error(input_index,msg)
            out_params["error_code"] = ErrorCode.SCORE_MATCH_ERROR
            return ExternalVerificationOutput.parse_obj(out_params)

    out_params['outcard'] = outcard_raw if rule.save_out_cards else b''
    out_params['score'] = score
    Storage.add_tape(tape_id,outcard_raw)
    return ExternalVerificationOutput.parse_obj(out_params)

class VerificationSender:
    input_box_abi = []
    w3 = None
    acct = None
    input_box_contract = None

    def __init__(self):
        if not os.path.exists(INPUT_BOX_ABI_FILE):
            raise Exception(f"Couldn't find input box json file")

        with open(INPUT_BOX_ABI_FILE) as f:
            j = json.load(f)
            if j.get('abi') is None:
                raise Exception(f"Input box abi file doesn't have contract abi")
            self.input_box_abi = j['abi']
        provider = Web3.WebsocketProvider(WSS_URL) if WSS_URL else Web3.HTTPProvider(RPC_URL)
        self.w3 = Web3(provider)
        self.acct = self.w3.eth.account.from_key(PRIVATE_KEY)
        if WORLD_ADDRESS is None:
            self.input_box_contract = self.w3.eth.contract(address=INPUT_BOX_ADDRESS, abi=json.dumps(self.input_box_abi))
        else:
            self.input_box_contract = self.w3.eth.contract(address=WORLD_ADDRESS, abi=json.dumps(self.input_box_abi))

    def submit_external_outputs(self,all_data: List[ExternalVerificationOutput]):
        payload = {
            "tape_ids":[],
            "scores":[],
            "error_codes":[],
            "outcards":[],
        }
        for out in all_data:
            payload['tape_ids'].append(hex2bytes(out.tape_id))
            payload['scores'].append(out.score)
            payload['error_codes'].append(out.error_code)
            payload['outcards'].append(out.outcard)

        model = ExternalVerificationPayload

        header = ABIFunctionSelectorHeader(
            function="core.external_verification",
            argument_types=abi.get_abi_types_from_model(model)
        ).to_bytes()

        input_box_payload = header + abi.encode_model(model.parse_obj(payload))
        
        tx_parameters = {
            "from": self.acct.address,
            "nonce": self.w3.eth.get_transaction_count(self.acct.address),
        }
        tx = self.input_box_contract.functions.addInput(self.w3.to_checksum_address(DAPP_ADDRESS),input_box_payload).build_transaction(tx_parameters)
        tx_signed = self.w3.eth.account.sign_transaction(tx, private_key=self.acct.key)
        
        tx_hash = self.w3.eth.send_raw_transaction(tx_signed.rawTransaction)
        tx_receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        # LOGGER.info("tx receipt",tx_receipt)

class InputFinder:
    input_box_abi = []
    w3 = None
    input_box_contract = None
    starting_block = None
    verify_selector = None
    rule_selector = None
    cartridge_selector = None
    remove_cartridge_selector = None
    timeout = None
    poll_interval = None

    def __init__(self, timeout = 5, poll_interval = 1):
        if not os.path.exists(INPUT_BOX_ABI_FILE):
            raise Exception(f"Couldn't find input box json file")

        with open(INPUT_BOX_ABI_FILE) as f:
            j = json.load(f)
            if j.get('abi') is None:
                raise Exception(f"Input box abi file doesn't have contract abi")
            self.input_box_abi = j['abi']
        conn_timeout = 60
        provider = Web3.WebsocketProvider(WSS_URL, websocket_timeout=conn_timeout) if WSS_URL else Web3.HTTPProvider(RPC_URL, request_kwargs={'timeout': conn_timeout})
        self.w3 = Web3(provider)
        self.input_box_contract = self.w3.eth.contract(address=INPUT_BOX_ADDRESS, abi=json.dumps(self.input_box_abi))
        self.starting_block = DAPP_DEPLOY_BLOCK

        verify_abi_types = abi.get_abi_types_from_model(VerifyPayload)
        verify_header = ABIFunctionSelectorHeader(
            function=f"core.register_external_verification",
            argument_types=verify_abi_types
        )
        self.verify_selector = verify_header.to_bytes()

        rule_abi_types = abi.get_abi_types_from_model(RulePayload)
        rule_header = ABIFunctionSelectorHeader(
            function=f"core.create_rule",
            argument_types=rule_abi_types
        )
        self.rule_selector = rule_header.to_bytes()

        cartridge_abi_types = abi.get_abi_types_from_model(InsertCartridgePayload)
        cartridge_header = ABIFunctionSelectorHeader(
            function=f"core.insert_cartridge",
            argument_types=cartridge_abi_types
        )
        self.cartridge_selector = cartridge_header.to_bytes()

        remove_cartridge_abi_types = abi.get_abi_types_from_model(RemoveCartridgePayload)
        remove_cartridge_header = ABIFunctionSelectorHeader(
            function=f"core.remove_cartridge",
            argument_types=remove_cartridge_abi_types
        )
        self.remove_cartridge_selector = remove_cartridge_header.to_bytes()

        set_operator_abi_types = abi.get_abi_types_from_model(SetOperatorPayload)
        set_operator_header = ABIFunctionSelectorHeader(
            function=f"core.set_operator_address",
            argument_types=set_operator_abi_types
        )
        self.set_operator_header = set_operator_header.to_bytes()

        self.timeout = timeout
        self.poll_interval = poll_interval

    def get_input(self, block: int | None, max_time_wait: int = -1) -> Generator[InputData,None,None]:
        if block is None: block = self.starting_block

        start_ts = time.time()
        last_input_block = int(block)
        while True:
            try:
                # LOGGER.info(f"looking for new entries in input box")
                t0 = time.time()

                params = {
                    "fromBlock":int(last_input_block), 
                    "argument_filters":{'dapp':self.w3.to_checksum_address(DAPP_ADDRESS)}
                }
                last_eth_block = self.w3.eth.block_number
                if params['fromBlock'] > last_eth_block:
                    time.sleep(self.poll_interval)
                    if max_time_wait >= 0 and time.time() - start_ts > max_time_wait:
                        yield InputData(type=InputType.none,data=None,last_input_block=last_eth_block)
                    continue
                to_block = int(last_input_block)+MAX_BLOCK_RANGE-1
                if to_block < last_eth_block:
                    params['toBlock'] = to_block

                input_added_filter = self.input_box_contract.events.InputAdded.create_filter(**params)

                while not (new_entries := input_added_filter.get_all_entries()) and time.time() - t0 < self.timeout:
                    time.sleep(self.poll_interval)
                # LOGGER.info(f"got {len(new_entries)} new entries")
                while len(new_entries) > 0:
                    tx_event = new_entries.pop()
                    last_input_block = tx_event['blockNumber']

                    header = tx_event['args']['input'][:4]

                    if PROXY_ADDRESS is None:
                        input_payload = tx_event['args']['input'][4:]
                        sender = tx_event['args']['sender'].lower()
                    else:
                        if tx_event['args']['sender'].lower() != PROXY_ADDRESS.lower():
                            LOGGER.warning(f"Proxy sender doesn't match {tx_event['args']['sender'].lower()=} != {PROXY_ADDRESS.lower()=}")
                            continue
                        sender = f"0x{tx_event['args']['input'][4:24].hex().lower()}"
                        input_payload = tx_event['args']['input'][24:]

                    if header == self.verify_selector:
                        # LOGGER.info(f"verify entry")
                        ts = self.w3.eth.get_block(tx_event['blockNumber'])['timestamp']

                        payload = abi.decode_to_model(data=input_payload, model=VerifyPayload)

                        dict_payload = payload.dict()
                        dict_payload.update({"sender":sender,"timestamp":ts,"input_index":tx_event['args']['inputIndex']})
                        extended_payload = ExtendedVerifyPayload.parse_obj(dict_payload)

                        yield InputData(type=InputType.verification,data=extended_payload,last_input_block=last_input_block)
                    elif header == self.rule_selector:
                        # LOGGER.info(f"rule entry")
                        payload: RulePayload = abi.decode_to_model(data=input_payload, model=RulePayload)
                        
                        # rule_id = generate_rule_id(
                        #     payload.cartridge_id,str2bytes(payload.name))
                        # rule_id = generate_rule_id(
                        #     hex2bytes(cartridge_ids[genesis_rule_cartridge]),
                        #     hex2bytes(cartridge_ids[genesis_rule_cartridge]),
                        #     str2bytes(payload.name)
                        # )
                        rule_dict = {
                            # "id": rule_id,
                            "name": payload.name,
                            "cartridge_id":format_cartridge_id_from_bytes(payload.cartridge_id),
                            "args":payload.args,
                            "in_card":payload.in_card,
                            "score_function":payload.score_function,
                            "sender":sender,
                            "start":payload.start,
                            "end":payload.end,
                            "tapes": payload.tapes,
                            "allow_tapes": payload.allow_tapes,
                            "allow_in_card": payload.allow_in_card,
                            "save_tapes": payload.save_tapes,
                            "save_out_cards": payload.save_out_cards,
                        }
                        rule = Rule.parse_obj(rule_dict)
                        yield InputData(type=InputType.rule,data=rule,last_input_block=last_input_block)
                    elif header == self.cartridge_selector:
                        # LOGGER.info(f"cartridge entry")
                        payload_dict = abi.decode_to_model(data=input_payload, model=InsertCartridgePayload).dict()
                        payload_dict['sender'] = sender

                        extended_payload = ExtendedInsertCartridgePayload.parse_obj(payload_dict)
                    
                        yield InputData(type=InputType.cartridge,data=extended_payload,last_input_block=last_input_block)
                    elif header == self.remove_cartridge_selector:
                        # LOGGER.info(f"cartridge entry")
                        payload_dict = abi.decode_to_model(data=input_payload, model=RemoveCartridgePayload).dict()
                        payload_dict['sender'] = sender

                        extended_payload = ExtendedRemoveCartridgePayload.parse_obj(payload_dict)
                    
                        yield InputData(type=InputType.remove_cartridge,data=extended_payload,last_input_block=last_input_block)
                    elif header == self.set_operator_header:
                        # LOGGER.info(f"cartridge entry")
                        payload_dict = abi.decode_to_model(data=input_payload, model=SetOperatorPayload).dict()
                        payload_dict['sender'] = sender

                        extended_payload = ExtendedSetOperatorPayload.parse_obj(payload_dict)
                    
                        yield InputData(type=InputType.set_operator,data=extended_payload,last_input_block=last_input_block)
                    else:
                        # LOGGER.info(f"non processed entry")
                        yield InputData(type=InputType.unknown,data=None,last_input_block=last_input_block)

                filter_to_block = input_added_filter.filter_params.get('toBlock')
                last_input_block = self.w3.eth.block_number if filter_to_block is None or filter_to_block == 'latest' else filter_to_block
                yield InputData(type=InputType.none,data=None,last_input_block=last_input_block)
                last_input_block += 1
            except Exception as e:
                LOGGER.error(e)
                traceback.print_exc()

                yield InputData(type=InputType.error,data=Error(msg=str(e)),last_input_block=last_input_block)


###
# Setup functions

def set_envs():
    if RIVES_VERSION is not None: os.environ["RIVES_VERSION"] = RIVES_VERSION
    if RIVEMU_PATH is not None: os.environ["RIVEMU_PATH"] = RIVEMU_PATH
    if OPERATOR_ADDRESS is not None: os.environ["OPERATOR_ADDRESS"] = OPERATOR_ADDRESS
    if PROXY_ADDRESS is not None: os.environ["PROXY_ADDRESS"] = PROXY_ADDRESS
    if GENESIS_CARTRIDGES is not None: os.environ["GENESIS_CARTRIDGES"] = GENESIS_CARTRIDGES
    if INPUT_BOX_ADDRESS is not None: os.environ["INPUT_BOX_ADDRESS"] = INPUT_BOX_ADDRESS
    

def initialize_storage_with_genesis_data():
    # Set operator address
    Storage.set_operator_address(OPERATOR_ADDRESS.lower())

    # Add genesis cartridges
    cartridge_ids = {}
    LOGGER.info(f" 0 initialize_storage_with_genesis_data")
    for cartridge_name in CoreSettings().genesis_cartridges:
        try:
            with open(f"{GENESIS_CARTRIDGES_PATH}/{cartridge_name}.sqfs",'rb') as f:
                cartridge_data = f.read()
            cartridge_id = generate_cartridge_id(cartridge_data)
            cartridge_ids[cartridge_name] = cartridge_id
            add_cartridge(cartridge_id,cartridge_data,Storage.get_operator_address())

        except Exception as e:
            LOGGER.warning(e)
            traceback.print_exc()

    LOGGER.info(f"{cartridge_ids=}")

    # Add genesis rules
    LOGGER.info(f" 1 initialize_storage_with_genesis_data")
    for genesis_rule_cartridge in CoreSettings().genesis_rules:
        if cartridge_ids.get(genesis_rule_cartridge) is not None:
            try:
                rule_name = CoreSettings().genesis_rules[genesis_rule_cartridge].get('name')
                # rule_id = generate_rule_id(
                #     hex2bytes(cartridge_ids[genesis_rule_cartridge]),
                #     hex2bytes(cartridge_ids[genesis_rule_cartridge]),
                #     str2bytes(rule_name)
                # )

                rule_conf_dict = {
                    # "id": rule_id,
                    "name":rule_name,
                    "cartridge_id":cartridge_ids[genesis_rule_cartridge],
                    "args":str(CoreSettings().genesis_rules[genesis_rule_cartridge].get("args")),
                    "in_card":bytes.fromhex(str(CoreSettings().genesis_rules[genesis_rule_cartridge].get('in_card') or "")),
                    "score_function":str(CoreSettings().genesis_rules[genesis_rule_cartridge].get("score_function")),
                    "start":int(CoreSettings().genesis_rules[genesis_rule_cartridge].get("start") or 0),
                    "end":  int(CoreSettings().genesis_rules[genesis_rule_cartridge].get("end") or 0),
                    "sender":OPERATOR_ADDRESS,
                    "tapes": [],
                    "allow_tapes": False,
                    "allow_in_card": False,
                    "save_tapes": False,
                    "save_out_cards": False,
                }
                rule = Rule.parse_obj(rule_conf_dict)
                add_rule(rule)
            except Exception as e:
                LOGGER.warning(e)

###
# Verification storage manipulation

def verify_payload(payload: ExtendedVerifyPayload) -> bool:
    out = tape_verification(payload)

    status = False
    if out is not None:
        Storage.push_output(out.json())
        status = True

    return status

def add_cartridge(cartridge_id: str,cartridge_data: bytes, sender: str):
    # TODO: fix not evaluated: nor cover or can't generate
    # TODO: fix not evaluated: insufficient space

    if Storage.get_cartridge_data(cartridge_id) is not None:
        LOGGER.warning(f"Cartridge already exists")
        return

    info = Storage.get_cartridge_info(cartridge_id)
    if info is not None:
        user_address = info.get('user_address')
        if sender != user_address:
            LOGGER.warning(f"Sender not allowed")
            return

    cartridge_temp = tempfile.NamedTemporaryFile()
    cartridge_file = cartridge_temp.file

    cartridge_file.write(cartridge_data)
    cartridge_file.flush()

    cartridge_info = riv_get_cartridge_info(cartridge_temp.name)
    
    cartridge_temp.close()

    # process in card
    cartridge_info_json = json.loads(cartridge_info)
    cartridge_info_json['user_address'] = f"{sender}"

    args = ""
    in_card = b''
    cartridge_tapes = cartridge_info_json.get("tapes")
    if cartridge_tapes is not None and len(cartridge_tapes) > 0:
        in_card = format_incard(map(lambda x: format_tape_id_from_bytes(hex2bytes(x)), cartridge_tapes),[b''])

    # validate info
    out = riv_verification(cartridge_data,args,in_card)
    if out is not None and out.get("outcard") is not None:
        Storage.add_cartridge(cartridge_id,cartridge_data)
        Storage.add_cartridge_info(cartridge_id,cartridge_info_json)
        primary_id = Storage.get_primary_cartridge_id(cartridge_id)

        rule_name = "default"
        rule_id = generate_rule_id(hex2bytes(primary_id),hex2bytes(cartridge_id),str2bytes(rule_name))

        score_function = ""

        if out['outcard'][:4] == b"JSON":
            try:
                if json.loads(out['outcard'][4:]).get('score') is not None:
                    score_function = "score"
            except Exception as e:
                LOGGER.info(f"Couldn't parse json outcard: {e}, ignoring score function")

        rule_dict = {
            # "id":rule_id,
            "name":rule_name,
            "cartridge_id":cartridge_id,
            "args":args,
            "in_card":in_card,
            "score_function":score_function,
            "start":0,
            "end":  0,
            "tapes": [],
            "allow_tapes": False,
            "allow_in_card": False,
            "save_tapes": False,
            "save_out_cards": False,
        }
        rule = Rule.parse_obj(rule_dict)
        Storage.add_rule(rule_id,rule)
    else:
        LOGGER.warning(f"Error validating cartridge")

def remove_cartridge(cartridge_id: str, sender: str):

    info = Storage.get_cartridge_info(cartridge_id)
    if info is None:
        LOGGER.warning(f"Couldn't find cartridge info {cartridge_id}")
        return
    
    # user_address = info.get('user_address')
    # if sender != user_address and sender != Storage.get_operator_address():
    if sender != Storage.get_operator_address():
        LOGGER.warning(f"Sender not allowed")
        return

    if Storage.remove_cartridge_data(cartridge_id) == 0:
        LOGGER.warning(f"Couldn't find cartridge {cartridge_id}")
    versions = Storage.get_cartridge_versions(cartridge_id)
    if versions is not None:
        for version in versions:
            if Storage.remove_cartridge_data(version) == 0:
                LOGGER.warning(f"Couldn't find version {version}")

def add_rule(rule: Rule):
    # if rule.sender.lower() != Storage.get_operator_address():
    #     LOGGER.warning(f"Sender has no permission to add rule")
    #     return

    # revert hex conversion
    # if len(rule.in_card) > 0: rule.in_card = hex2bytes(rule.in_card)
    # rule.cartridge_id = hex2bytes(rule.cartridge_id)
    # rule_dict.update({"in_card":rule.in_card.hex()})

    cartridge_id = _normalize_hex(rule.cartridge_id)
    cartridge_data = Storage.get_cartridge_data(cartridge_id)

    if cartridge_data is None:
        LOGGER.warning(f"Couldn't find cartridge to verify rule")
        return
    
    primary_id = Storage.get_primary_cartridge_id(cartridge_id)

    rule_id = generate_rule_id(
        hex2bytes(primary_id),
        hex2bytes(cartridge_id),
        str2bytes(rule.name))

    if Storage.get_rule(rule_id) is not None:
        LOGGER.warning(f"Rule already exists")
        return
    if rule.start > 0 and rule.end > 0 and rule.start > rule.end:
        LOGGER.warning(f"Inconsistent start and end time")
        return
    

    # process in card
    cartridge_info_json = Storage.get_cartridge_info(cartridge_id)

    all_tapes = []
    cartridge_tapes = cartridge_info_json.get("tapes")
    if cartridge_tapes is not None and len(cartridge_tapes) > 0:
        all_tapes.extend(cartridge_tapes)
    all_tapes.extend(map(lambda x: format_tape_id_from_bytes(x), rule.tapes))
    in_card = format_incard(all_tapes, [rule.in_card])

    out = rule_verification(cartridge_data,rule,in_card)
    if out is not None:
       Storage.add_rule(rule_id,rule)
    else:
        LOGGER.warning(f"Error validating rule")

def set_operator(new_addr: str, sender:str):
    if sender != Storage.get_operator_address():
        LOGGER.warning(f"Sender not allowe")
        return
    Storage.set_operator_address(new_addr)

def push_verification(extended_verification: ExtendedVerifyPayload):
    Storage.push_verification(abi.encode_model(extended_verification))


def _normalize_hex(orig: str) -> str:
    """Remove leading 0x and ensure lowercase"""
    result = orig.lower()
    if result.startswith('0x'):
        result = result[2:]
    return result

def format_incard(tape_ids: List[str],incards: List[bytes]) -> bytes:
    incard_data_list = []
    print(f"=== debug === {tape_ids=} {incards=}")
    for incard in incards:
        if len(incard) > 0: incard_data_list.append(incard)
    incard_data_list.extend(format_tapes_to_byte_list(tape_ids))
    return format_bytes_list_to_incard(incard_data_list)
    
def format_tapes_to_byte_list(tape_ids: List[str]) -> List[bytes]:
    tapes_data_list = []
    for t in tape_ids:
        print(f"=== debug === {t=}")
        tape_id = t[2:] if t.startswith('0x') else t
        outcard = Storage.get_tape(tape_id)
        if outcard is None or len(outcard) == 0: continue
        tapes_data_list.append(outcard)
        # outcard = TapeHash.get_outcard(tape_id)
        # if outcard is None or len(outcard) == 0: continue
        # tapes_data_list.append(outcard)
    return tapes_data_list
