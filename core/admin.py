import logging
from pydantic import BaseModel

from cartesi.abi import Address, Bool, Bytes

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

class SetInternalVerifyLock(BaseModel):
    lock: Bool

class UpdateRivosPayload(BaseModel):
    data: Bytes


###
# Mutations

@mutation(msg_sender=CoreSettings().admin_address)
def set_operator_address(payload: SetOperatorPayload) -> bool:
    CoreSettings().operator_address = payload.new_operator_address.lower()
    return True

@mutation(msg_sender=CoreSettings().admin_address)
def set_internal_verify_lock(payload: SetInternalVerifyLock) -> bool:
    CoreSettings().internal_verify_lock = payload.lock
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
