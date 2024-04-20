import os
import sys
import json
from web3 import Web3
import redis
import time
import typer
from typing import Optional, List, Annotated
from multiprocessing import Process, Pool, Manager, Event
import logging
from pydantic import BaseModel
from eth_abi import encode, decode
from py_expression_eval import Parser
import math
from enum import Enum
import traceback
from dotenv import load_dotenv

from cartesi import abi
from cartesi.models import ABIFunctionSelectorHeader
from cartesapp.utils import hex2bytes, str2bytes, bytes2hex, bytes2str



sys.path.append("..")

from core.cartridge import InserCartridgePayload
from core.tape import VerifyPayload, RulePayload, ExternalVerificationPayload
from core.riv import verify_log
from core.core_settings import  generate_entropy, generate_cartridge_id, generate_rule_id, generate_tape_id, setup_settings


LOGGER = logging.getLogger("external_verifier")

load_dotenv() 

###
# Conf

# required
RIVEMU_PATH = os.getenv('RIVEMU_PATH') or ''
OPERATOR_ADDRESS = os.getenv('OPERATOR_ADDRESS') or ""
CRAPP_ADDRESS = os.getenv('CRAPP_ADDRESS') or ""
PRIVATE_KEY = os.getenv('PRIVATE_KEY') or ''

# recommended
CRAPP_DEPLOY_BLOCK = os.getenv('DAPP_DEPLOY_BLOCK') or 0
RIVES_VERSION = os.getenv('RIVES_VERSION') or '0'

REDIS_HOST = os.getenv('REDIS_HOST') or "localhost"
REDIS_PORT = os.getenv('REDIS_PORT') or 6379
RPC_URL = os.getenv('RPC_URL') or "http://localhost:8545"

# checklikely
INPUT_BOX_ADDRESS = os.getenv('INPUTBOX_ADDRESS') or "0x59b22D57D4f067708AB0c00552767405926dc768"
INPUT_BOX_ABI_FILE = 'external_verifier/InputBox.json'
TEST_TAPE_PATH = os.getenv('TEST_TAPE_PATH') or 'misc/test.rivlog'

# consts
SERIALIZED_INPUT_DATA_TYPES = ['address','uint','uint','bytes']

REDIS_VERIFY_QUEUE_KEY = f"rives_verify_queue_{RIVES_VERSION}"
REDIS_VERIFY_PROCESSING_QUEUE_KEY = f"rives_verify_processing_queue_{RIVES_VERSION}"
REDIS_CARTRIDGES_KEY = f"rives_cartridges_{RIVES_VERSION}"
REDIS_RULES_KEY = f"rives_rules_{RIVES_VERSION}"
REDIS_VERIFY_OUTPUT_QUEUE_KEY = f"rives_verify_output_queue_{RIVES_VERSION}"
REDIS_VERIFY_OUTPUT_TEMP_QUEUE_KEY = f"rives_verify_output_temp_queue_{RIVES_VERSION}"
REDIS_ERROR_VERIFICATION_KEY = f"rives_error_verification_{RIVES_VERSION}"
REDIS_BLOCK_KEY = f"rives_processed_block_{RIVES_VERSION}"

###
# Model

class DbType(str, Enum):
    mem = "mem"
    redis = "redis"

class Rule(BaseModel):
    cartridge_id:       str
    args:               str
    in_card:            bytes
    score_function:     str

class ExternalVerificationOutput(BaseModel):
    user_address:       str
    rule_id:            str
    tape_hash:          str
    tape_input_index:   int
    tape_timestamp:     int
    score:              int

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
    def get_processed_block(cls) -> Rule:
        return cls.store.get(REDIS_BLOCK_KEY)

    @classmethod
    def set_processed_block(cls, block: int) -> Rule:
        return cls.store.set(REDIS_BLOCK_KEY, block)

    @classmethod
    def get_rule(cls,rule_id: str) -> Rule:
        json_rule = cls.store.hget(REDIS_RULES_KEY,rule_id)
        return Rule.parse_raw(json_rule) if json_rule is not None else None

    @classmethod
    def get_cartridge_data(cls,cartridge_id: str) -> bytes:
        return cls.store.hget(REDIS_CARTRIDGES_KEY,cartridge_id)

    @classmethod
    def add_error(cls,input_index: int, error_msg: str) -> bytes:
        cls.store.hset(REDIS_ERROR_VERIFICATION_KEY,input_index,error_msg)

    # @classmethod
    # def exist_rule(cls,rule_id):
    #     return cls.store.hexists(REDIS_RULES_KEY,rule_id)
    
    @classmethod
    def add_rule(cls,rule_id,rule):
        if not cls.store.hexists(REDIS_RULES_KEY,rule_id):
            cls.store.hset(REDIS_RULES_KEY,rule_id,rule)

    # @classmethod
    # def exist_cartridge(cls,cartridge_id):
    #     return cls.store.hexists(REDIS_CARTRIDGES_KEY,cartridge_id)
    
    @classmethod
    def add_cartridge(cls,cartridge_id,cartridge_data):
        if not cls.store.hexists(REDIS_CARTRIDGES_KEY,cartridge_id):
            cls.store.hset(REDIS_CARTRIDGES_KEY,cartridge_id,cartridge_data)
    
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


###
# Verification/sender functions

def rule_verification(cartridge_data:bytes, rule: Rule):
    out = cartridge_verification(cartridge_data,rule.args,rule.in_card)

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

def cartridge_verification(cartridge_data:bytes,args:str,in_card:bytes):
    with open(TEST_TAPE_PATH,'rb') as test_replay_file:
        test_replay = test_replay_file.read()
    try:
        verification_output = verify_log(cartridge_data,test_replay,args,in_card)
    except Exception as e:
        LOGGER.warning(e)
        traceback.print_exc()
        return None
    return verification_output


def tape_verification(sender: str, timestamp: int, input_index: int, payload: VerifyPayload) -> ExternalVerificationOutput:

    rule = Storage.get_rule(payload.rule_id.hex())
    if rule is None:
        msg = f"Couldn't find rule"
        LOGGER.error(msg)
        Storage.add_error(input_index,msg)
        return None

    cartridge_data = Storage.get_cartridge_data(rule.cartridge_id)
    if cartridge_data is None or len(cartridge_data) == 0:
        msg = f"Couldn't find cartridge"
        LOGGER.error(msg)
        Storage.add_error(input_index,msg)
        return None

    entropy = generate_entropy(sender, payload.rule_id.hex())

    # process tape
    LOGGER.info(f"Verifying tape...")
    try:
        verification_output = verify_log(cartridge_data,payload.tape,rule.args,rule.in_card,entropy=entropy)
    except Exception as e:
        msg = f"Couldn't verify tape: {e}"
        LOGGER.error(msg)
        Storage.add_error(input_index,msg)
        return None

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
        return None

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
            return None

        # compare claimed score
        claimed_score = payload.claimed_score
        if claimed_score == 0:
            claimed_score = score

        score_valid = score == claimed_score

        if not score_valid:
            msg = f"Score doesn't match"
            LOGGER.error(msg)
            Storage.add_error(input_index,msg)
            return None

    out = ExternalVerificationOutput(
        user_address = sender,
        rule_id = payload.rule_id.hex(),
        tape_hash = generate_tape_id(payload.tape),
        tape_input_index = input_index,
        tape_timestamp = timestamp,
        score = score
    )
    return out

class VerificationSender:
    input_box_abi = []
    w3 = None
    acct = None
    input_box_contract = None

    def __init__(self):
        super().__init__()
        with open(INPUT_BOX_ABI_FILE) as f:
            j = json.load(f)
            if j.get('abi') is None:
                raise Exception(f"Input box abi file doesn't have contract abi")
            self.input_box_abi = j['abi']
        self.w3 = Web3(Web3.HTTPProvider(RPC_URL))
        self.acct = self.w3.eth.account.from_key(PRIVATE_KEY)
        self.input_box_contract = self.w3.eth.contract(address=INPUT_BOX_ADDRESS, abi=json.dumps(self.input_box_abi))

    def submit_external_outputs(self,all_data: List[bytes]):
        payload = {
            "user_addresses":[],
            "rule_ids":[],
            "tape_hashes":[],
            "tape_input_indexes":[],
            "tape_timestamps":[],
            "scores":[],
        }
        for data in all_data:
            out = ExternalVerificationOutput.parse_raw(data)
            payload['user_addresses'].append(out.user_address)
            payload['rule_ids'].append(hex2bytes(out.rule_id))
            payload['tape_hashes'].append(hex2bytes(out.tape_hash))
            payload['tape_input_indexes'].append(out.tape_input_index)
            payload['tape_timestamps'].append(out.tape_timestamp)
            payload['scores'].append(out.score)

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
        tx = self.input_box_contract.functions.addInput(self.w3.to_checksum_address(CRAPP_ADDRESS),input_box_payload).build_transaction(tx_parameters)
        tx_signed = self.w3.eth.account.sign_transaction(tx, private_key=self.acct.key)
        
        tx_hash = self.w3.eth.send_raw_transaction(tx_signed.rawTransaction)
        tx_receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        LOGGER.info("tx receipt",tx_receipt)

###
# Verification storage manipulation

def verify_payload(serialized_data: bytes) -> bool:
    decoded = decode(SERIALIZED_INPUT_DATA_TYPES,serialized_data)

    sender = decoded[0]
    timestamp = decoded[1]
    input_index = decoded[2]
    inputbox_payload = decoded[3]
    payload = abi.decode_to_model(data=inputbox_payload, model=VerifyPayload)

    out = tape_verification(sender,timestamp,input_index,payload)

    status = False
    if out is not None:
        Storage.push_output(out.json())
        status = True
    Storage.remove_processing_verification(serialized_data)

    return status

def add_cartridge(cartridge_id: str,cartridge_data: bytes):
    # TODO: fix not evaluated: no info.json and not i format
    # TODO: fix not evaluated: nor cover or can't generate
    # TODO: fix not evaluated: insufficient space

    if Storage.get_cartridge_data(cartridge_id) is not None:
        LOGGER.warning(f"Cartridge already exists")
        return

    args = ""
    in_card = b''
    out = cartridge_verification(cartridge_data,args,in_card)
    if out is not None and out.get("outcard") is not None:
        Storage.add_cartridge(cartridge_id,cartridge_data)
        rule_name = "default"
        rule_id = generate_rule_id(hex2bytes(cartridge_id),str2bytes(rule_name))

        score_function = ""

        if out['outcard'][:4] == b"JSON":
            try:
                if json.loads(out['outcard'][4:]).get('score') is not None:
                    score_function = "score"
            except Exception as e:
                LOGGER.info(f"Couldn't parse json outcard: {e}, ignoring score function")

        rule_dict = {
            "cartridge_id":cartridge_id,
            "args":args,
            "in_card":in_card,
            "score_function":score_function
        }
        rule = Rule.parse_obj(rule_dict)
        Storage.add_rule(rule_id,rule.json())
    else:
        LOGGER.warning(f"Error validating cartridge")

def add_rule(sender: str, rule_id: str, rule: Rule):
    if sender.lower() != OPERATOR_ADDRESS.lower():
        LOGGER.warning(f"Sender has no permission to add rule")
        return
    cartridge_data = Storage.get_cartridge_data(rule.cartridge_id)
    if cartridge_data is None:
        LOGGER.warning(f"Couldn't find cartridge to verify rule")
        return
    if Storage.get_rule(rule_id) is not None:
        LOGGER.warning(f"Rule already exists")
        return
    out = rule_verification(cartridge_data,rule)
    if out is not None:
       Storage.add_rule(rule_id,rule.json())
    else:
        LOGGER.warning(f"Error validating rule")


###
# Setup functions

def initialize_redis_with_genesis_data():
    genesis_cartridges = ['snake','freedoom','antcopter','monky','tetrix','particles']
    for cartridge_name in genesis_cartridges:
        try:
            with open(f"misc/{cartridge_name}.sqfs",'rb') as f:
                cartridge_data = f.read()
            cartridge_id = generate_cartridge_id(cartridge_data)
            add_cartridge(cartridge_id,cartridge_data)

        except Exception as e:
            LOGGER.warning(e)


def set_envs():
    os.environ["RIVES_VERSION"] = RIVES_VERSION
    os.environ["RIVEMU_PATH"] = RIVEMU_PATH
    os.environ["OPERATOR_ADDRESS"] = OPERATOR_ADDRESS


###
# Processes

class Enqueuer(Process):
    input_box_abi = []
    timeout = None
    cancel_event = None

    def __init__(self, cancel_event = None, timeout = 10):
        super().__init__()
        if not os.path.exists(INPUT_BOX_ABI_FILE):
            raise Exception(f"Couldn't find input box json file")

        with open(INPUT_BOX_ABI_FILE) as f:
            j = json.load(f)
            if j.get('abi') is None:
                raise Exception(f"Input box abi file doesn't have contract abi")
            self.input_box_abi = j['abi']
        self.timeout = timeout
        self.cancel_event = cancel_event

    def run(self):
        w3 = Web3(Web3.HTTPProvider(RPC_URL))
        input_box_contract = w3.eth.contract(address=INPUT_BOX_ADDRESS, abi=json.dumps(self.input_box_abi))

        starting_block = CRAPP_DEPLOY_BLOCK
        processed_block = Storage.get_processed_block()
        if processed_block is not None: starting_block = int(processed_block) + 1

        input_added_filter = input_box_contract.events.InputAdded.create_filter(
            fromBlock=starting_block, argument_filters={'dapp':w3.to_checksum_address(CRAPP_ADDRESS)})

        verify_abi_types = abi.get_abi_types_from_model(VerifyPayload)
        verify_header = ABIFunctionSelectorHeader(
            function=f"core.register_external_verification",
            argument_types=verify_abi_types
        )
        verify_selector = verify_header.to_bytes()

        rule_abi_types = abi.get_abi_types_from_model(RulePayload)
        rule_header = ABIFunctionSelectorHeader(
            function=f"core.create_rule",
            argument_types=rule_abi_types
        )
        rule_selector = rule_header.to_bytes()

        cartridge_abi_types = abi.get_abi_types_from_model(InserCartridgePayload)
        cartridge_header = ABIFunctionSelectorHeader(
            function=f"core.insert_cartridge",
            argument_types=cartridge_abi_types
        )
        cartridge_selector = cartridge_header.to_bytes()

        while True:
            if self.cancel_event.is_set(): break
            try:
                LOGGER.info(f"looking for new entries in input box")
                while not (new_entries := input_added_filter.get_new_entries()): 
                    if self.cancel_event.is_set(): break
                    time.sleep(self.timeout)

                LOGGER.info(f"got {len(new_entries)} new entries")
                while len(new_entries) > 0:
                    # TODO: check already processed
                    tx_event = new_entries.pop()

                    header = tx_event['args']['input'][:4]
                    if header == verify_selector:
                        LOGGER.info(f"verify entry")
                        ts = w3.eth.get_block(tx_event['blockNumber'])['timestamp']
                        data = encode(
                            SERIALIZED_INPUT_DATA_TYPES,
                            [tx_event['args']['sender'],ts,tx_event['args']['inputIndex'],tx_event['args']['input'][4:]]
                        )
                        Storage.push_verification(data)
                    elif header == rule_selector:
                        LOGGER.info(f"rule entry")
                        payload = abi.decode_to_model(data=tx_event['args']['input'][4:], model=RulePayload)
                        
                        rule_id = generate_rule_id(payload.cartridge_id,str2bytes(payload.name))

                        rule_dict = {
                            "cartridge_id":bytes2hex(payload.cartridge_id),
                            "args":payload.args,
                            "in_card":payload.in_card,
                            "score_function":payload.score_function
                        }
                        rule = Rule.parse_obj(rule_dict)
                        add_rule(tx_event['args']['sender'],rule_id,rule)
                    elif header == cartridge_selector:
                        LOGGER.info(f"cartridge entry")
                        payload = abi.decode_to_model(data=tx_event['args']['input'][4:], model=InserCartridgePayload)
                    
                        cartridge_id = generate_cartridge_id(payload.data)
                        add_cartridge(cartridge_id,payload.data)
                    else:
                        LOGGER.info(f"non processed entry")
                Storage.set_processed_block(tx_event['blockNumber'])
            except Exception as e:
                LOGGER.error(e)
                traceback.print_exc()
                self.cancel_event.set()

class Verifier(Process):
    timeout = None
    pool_size = None
    cancel_event = None

    def __init__(self, cancel_event = None, pool_size = 5, timeout = 30):
        super().__init__()
        self.pool_size = pool_size
        self.timeout = timeout
        self.cancel_event = cancel_event

    def run(self):
        while True:
            if self.cancel_event.is_set(): break
            try:
                t0 = time.time()
                Storage.reset_processing_verification()
                all_data = []
                LOGGER.info(f"looking for tapes to verify")
                while time.time() - t0 < self.timeout and len(all_data) < self.pool_size:
                    t_left = math.ceil(time.time() - t0)
                    data = Storage.pop_verification(t_left)
                    if data is not None:
                        LOGGER.info(f"found tape")
                        all_data.append(data)
                if len(all_data) > 0:
                    LOGGER.info(f"verfiying {len(all_data)} tapes")
                    with Pool(len(all_data)) as pool:
                        # result = pool.map_async(verify_payload, all_data)
                        # result.wait()
                        all_status = pool.map(verify_payload,all_data)
                        LOGGER.info(f"batch processing status {all_status}")
            except Exception as e:
                LOGGER.error(e)
                traceback.print_exc()
                self.cancel_event.set()


class Submitter(Process):
    max_batch_size = None
    timeout = None
    sender = None
    cancel_event = None

    def __init__(self, cancel_event = None, max_batch_size = 10,timeout = 300):
        super().__init__()
        self.max_batch_size = max_batch_size
        self.timeout = timeout
        self.sender = VerificationSender()
        self.cancel_event = cancel_event

    def run(self):
        while True:
            if self.cancel_event.is_set(): break
            try:
                t0 = time.time()
                Storage.reset_temp_output()
                all_data = []
                LOGGER.info(f"looking for verification outputs to send")
                while time.time() - t0 < self.timeout and len(all_data) < self.max_batch_size:
                    t_left = math.ceil(time.time() - t0)
                    data = Storage.pop_output(t_left)
                    if data is not None:
                        all_data.append(data)
                if len(all_data) > 0:
                    LOGGER.info(f"sending {len(all_data)} tape verifications")
                    self.sender.submit_external_outputs(all_data)
                    LOGGER.info(f"verification for {len(all_data)} outputs sent")
                    for data in all_data:
                        Storage.remove_temp_output(data)
            except Exception as e:
                LOGGER.error(e)
                traceback.print_exc()
                self.cancel_event.set()


###
# CLI

app = typer.Typer(help="Rives External Verifier: Verify Tapes directly from the chain")

@app.command()
def run(db: Optional[DbType] = DbType.mem, log_level: Optional[str] = None, config: Annotated[List[str], typer.Option(help="args config in the [ key=value ] format")] = None, 
disable_enqueuer: Optional[bool] = False, disable_verifier: Optional[bool] = False, disable_submitter: Optional[bool] = False):

    config_dict = {}
    if config is not None:
        import re
        for c in config:
            k,v = re.split('=',c,1)
            config_dict[k] = v

    Storage(db)
    os.chdir('..')
    set_envs()
    setup_settings()
    initialize_redis_with_genesis_data()

    if log_level is not None:
        logging.basicConfig(level=getattr(logging,log_level.upper()))
    cancel_event = Event()
    services = []
    if not disable_enqueuer:
        service_conf = {"cancel_event":cancel_event}
        if config_dict.get('enqueuer_timeout') is not None:
            service_conf['timeout'] = int(config_dict.get('enqueuer_timeout'))
        services.append(Enqueuer(**service_conf))
    if not disable_verifier:
        service_conf = {"cancel_event":cancel_event}
        if config_dict.get('verifier_timeout') is not None:
            service_conf['timeout'] = int(config_dict.get('verifier_timeout'))
        services.append(Verifier(**service_conf))
    if not disable_submitter:
        service_conf = {"cancel_event":cancel_event}
        if config_dict.get('submitter_timeout') is not None:
            service_conf['timeout'] = int(config_dict.get('submitter_timeout'))
        services.append(Submitter(**service_conf))

    try:
        for s in services:
            LOGGER.info(f"starting service {s.__class__.__name__}")
            s.start()
        for s in services: s.join()
    except KeyboardInterrupt:
        LOGGER.info(f"canceling")
        for s in services: s.terminate()
    finally:
        for s in services: s.join()

if __name__ == '__main__':
    app()
    