import os
from hashlib import sha256
from Crypto.Hash import keccak
import json

from cartesapp.storage import Storage
from cartesapp.utils import hex2bytes, str2bytes

###
# Settings

class CoreSettings:
    def __new__(cls):
        cls.cartridges_path = "cartridges"
        cls.scoreboard_ttl = 7776000 # 90 days
        cls.test_tape_path = 'misc/test.rivlog'
        cls.version = os.getenv('RIVES_VERSION') or '0'
        cls.rivemu_path = os.getenv('RIVEMU_PATH')
        cls.operator_address = (os.getenv('OPERATOR_ADDRESS') or "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266").lower()
        cls.admin_address = cls.operator_address
        cls.proxy_address = os.getenv('PROXY_ADDRESS').lower() if os.getenv('PROXY_ADDRESS') else None #"0x7d2c859FFA85E1165C0EC3fFEe14BB7B8A482777"
        cls.genesis_cartridges = list(map(lambda s: s.strip(), os.getenv('GENESIS_CARTRIDGES').split(','))) \
            if os.getenv('GENESIS_CARTRIDGES') is not None else \
                ['tetrix','antcopter','freedoom'] #['snake','freedoom','antcopter','monky','tetrix','particles']
        cls.genesis_rules = json.loads(os.getenv('GENESIS_RULES')) \
            if os.getenv('GENESIS_RULES') is not None else {}
        cls.internal_verify_lock = True
        cls.max_locked_cartridges = os.getenv('MAX_LOCKED_CARTRIDGES') or 100
        return cls

###
# Helpers

CARTRIDGE_ID_TRUNC_BYTES = 6
RULE_ID_TRUNC_BYTES = 8
TAPE_ID_TRUNC_BYTES = 12

def truncate_cartridge_id_from_bytes(id: bytes) -> str:
    return id[:CARTRIDGE_ID_TRUNC_BYTES]

def truncate_rule_id_from_bytes(id: bytes) -> str:
    return id[:(CARTRIDGE_ID_TRUNC_BYTES + CARTRIDGE_ID_TRUNC_BYTES + RULE_ID_TRUNC_BYTES)]

def truncate_tape_id_from_bytes(id: bytes) -> str:
    return id[:(CARTRIDGE_ID_TRUNC_BYTES + CARTRIDGE_ID_TRUNC_BYTES + RULE_ID_TRUNC_BYTES + TAPE_ID_TRUNC_BYTES)]


def format_cartridge_id_from_bytes(id: bytes) -> str:
    return truncate_cartridge_id_from_bytes(id).hex()

def format_rule_id_from_bytes(id: bytes) -> str:
    return truncate_rule_id_from_bytes(id).hex()

def format_tape_id_from_bytes(id: bytes) -> str:
    return truncate_tape_id_from_bytes(id).hex()


def generate_cartridge_id(bin_data: bytes) -> str:
    # return sha256(bin_data).hexdigest()
    return format_cartridge_id_from_bytes(keccak.new(digest_bits=256).update(bin_data).digest())

def generate_rule_id(cartridge_id: bytes,version_cartridge_id: bytes,bytes_name: bytes) -> str:
    # return sha256(cartridge_id + bytes_name).hexdigest()
    return format_rule_id_from_bytes((
            truncate_cartridge_id_from_bytes(cartridge_id) + 
            truncate_cartridge_id_from_bytes(version_cartridge_id) + 
            keccak.new(digest_bits=256).update(bytes_name).digest()[:RULE_ID_TRUNC_BYTES]))

def generate_tape_id(rule_id: bytes, bin_data: bytes) -> str:
    # return sha256(bin_data).hexdigest()
    return format_tape_id_from_bytes((truncate_rule_id_from_bytes(rule_id) + 
            keccak.new(digest_bits=256).update(bin_data).digest()[:TAPE_ID_TRUNC_BYTES]))


def get_version() -> bytes:
    version = str2bytes(CoreSettings().version)
    if len(version) > 32: version = version[-32:]
    return b'\0'*(32-len(version)) + version

def get_cartridges_path() -> str:
    return f"{Storage.STORAGE_PATH or '.'}/{CoreSettings().cartridges_path}"

def is_inside_cm() -> bool:
    uname = os.uname()
    return 'ctsi' in uname.release and uname.machine == 'riscv64'

def get_cartridge_tapes_filename() -> str:
    return f"{Storage.STORAGE_PATH}/cartridge_tapes.pkl"

def generate_entropy(user_address: str, rule_id: str) -> str:
    return sha256(hex2bytes(user_address) + hex2bytes(rule_id)).hexdigest()

def generate_rule_parameters_tag(args: str, in_card: bytes, score_function: str) -> str:
    return f"args: '{args}', score_function: '{score_function}', incard hash: {sha256(in_card).hexdigest()}"



