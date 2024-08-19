import logging
from pydantic import BaseModel

from cartesi.abi import Address, Bool, Bytes, UInt

from cartesapp.context import get_metadata
from cartesapp.input import query, mutation
from cartesapp.output import add_output

from .core_settings import CoreSettings
from .riv import install_riv_version
LOGGER = logging.getLogger(__name__)


###
# Models

class SetOperatorPayload(BaseModel):
    new_operator_address: Address

class SetLock(BaseModel):
    lock: Bool

class UpdateRivosPayload(BaseModel):
    data: Bytes

class SetMaxLockedCartridges(BaseModel):
    max_locked_cartridges: UInt


###
# Mutations

@mutation(msg_sender=CoreSettings().admin_address)
def set_operator_address(payload: SetOperatorPayload) -> bool:
    LOGGER.info(f"updating operator address to {payload.new_operator_address}...")
    CoreSettings().operator_address = payload.new_operator_address.lower()
    return True

@mutation(msg_sender=CoreSettings().admin_address)
def set_internal_verify_lock(payload: SetLock) -> bool:
    LOGGER.info(f"updating internal verify lock to {payload.lock}...")
    CoreSettings().internal_verify_lock = payload.lock
    return True

@mutation(msg_sender=CoreSettings().admin_address)
def set_cartridge_moderation_lock(payload: SetLock) -> bool:
    LOGGER.info(f"updating cartridge moderation lock to {payload.lock}...")
    CoreSettings().cartridge_moderation_lock = payload.lock
    return True

@mutation(msg_sender=CoreSettings().admin_address)
def set_max_locked_cartridges(payload: SetMaxLockedCartridges) -> bool:
    LOGGER.info(f"updating max locked cartridges to {payload.lock}...")
    CoreSettings().max_locked_cartridges = payload.max_locked_cartridges
    return True

@mutation(msg_sender=CoreSettings().admin_address)
def update_rivos(payload: UpdateRivosPayload) -> bool:

    LOGGER.info(f"updating riv...")
    try:
        install_riv_version(payload.data)
    except Exception as e:
        msg = f"Couldn't update riv: {e}"
        LOGGER.error(msg)
        add_output(msg)
        return False

    return True


###
# Queries

@query()
def operator_address() -> bool:
    add_output(CoreSettings().operator_address)
    return True

@query()
def admin_address() -> bool:
    add_output(CoreSettings().admin_address)
    return True

@query()
def proxy_address() -> bool:
    add_output(CoreSettings().proxy_address)
    return True

@query()
def config() -> bool:
    config = {
        "version": CoreSettings().version,
        "internal_verify_lock": CoreSettings().internal_verify_lock,
        "cartridge_moderation_lock": CoreSettings().cartridge_moderation_lock,
        "max_locked_cartridges": CoreSettings().max_locked_cartridges,
    }
    add_output(config)
    return True
