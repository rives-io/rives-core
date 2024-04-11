import os
from hashlib import sha256

from cartesapp.storage import Storage
from cartesapp.setup import setup
from cartesapp.utils import str2bytes

###
# Settings

class CoreSettings:
    cartridges_path = "cartridges"
    scoreboard_ttl = 7776000 # 90 days
    test_tape_path = 'misc/test.rivlog'
    version = ''
    rivemu_path = os.getenv('RIVEMU_PATH')
    operator_address = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
    insert_genesis_cartridges = True

@setup()
def setup_settings():
    CoreSettings.version = os.getenv('RIVES_VERSION') or CoreSettings.version
    CoreSettings.rivemu_path = os.getenv('RIVEMU_PATH') or CoreSettings.rivemu_path
    CoreSettings.operator_address = os.getenv('OPERATOR_ADDRESS') or CoreSettings.operator_address
    CoreSettings.insert_genesis_cartridges = bool(int(os.getenv('INSERT_GENESIS_CARTRIDGES'))) \
        if os.getenv('INSERT_GENESIS_CARTRIDGES') else CoreSettings.insert_genesis_cartridges

###
# Helpers

def get_version() -> bytes:
    version = bytes.fromhex(CoreSettings.version)
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