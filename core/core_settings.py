import os
from hashlib import sha256
import json

from cartesapp.storage import Storage
from cartesapp.utils import hex2bytes, str2bytes

###
# Settings

class CoreSettings:
    cartridges_path = "cartridges"
    scoreboard_ttl = 7776000 # 90 days
    test_tape_path = 'misc/test.rivlog'
    version = os.getenv('RIVES_VERSION') or '0'
    rivemu_path = os.getenv('RIVEMU_PATH')
    operator_address = os.getenv('OPERATOR_ADDRESS') or "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
    genesis_cartridges = list(map(lambda s: s.strip(), os.getenv('GENESIS_CARTRIDGES').split(','))) \
        if os.getenv('GENESIS_CARTRIDGES') is not None else \
            ['tetrix','antcopter','freedoom'] #['snake','freedoom','antcopter','monky','tetrix','particles']
    genesis_rules = json.loads(os.getenv('GENESIS_RULES')) \
        if os.getenv('GENESIS_RULES') is not None else \
            {"tetrix":{"name":"Easy till it isn't","description":"Oh, this is so easy, wait, help! Get ready to prove your worth on a classic, sharpest mind scores the most!","score_function":"score","start":1715569200,"end":1716174000}}

###
# Helpers

def get_version() -> bytes:
    version = str2bytes(CoreSettings.version)
    if len(version) > 32: version = version[-32:]
    return b'\0'*(32-len(version)) + version

def get_cartridges_path() -> str:
    return f"{Storage.STORAGE_PATH or '.'}/{CoreSettings.cartridges_path}"

def generate_cartridge_id(bin_data: bytes) -> str:
    return sha256(bin_data).hexdigest()

def generate_tape_id(bin_data: bytes) -> str:
    return sha256(bin_data).hexdigest()

def is_inside_cm() -> bool:
    uname = os.uname()
    return 'ctsi' in uname.release and uname.machine == 'riscv64'

def get_cartridge_tapes_filename() -> str:
    return f"{Storage.STORAGE_PATH}/cartridge_tapes.pkl"

def generate_rule_id(cartridge_id: bytes,bytes_name: bytes) -> str:
    return sha256(cartridge_id + bytes_name).hexdigest()

def generate_entropy(user_address: str, rule_id: str) -> str:
    return sha256(hex2bytes(user_address) + hex2bytes(rule_id)).hexdigest()

def generate_rule_parameters_tag(args: str, in_card: bytes, score_function: str) -> str:
    return sha256(str2bytes(args) + in_card + str2bytes(score_function)).hexdigest()