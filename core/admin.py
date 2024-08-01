import logging
from pydantic import BaseModel

from cartesi.abi import Address, Bool

from cartesapp.context import get_metadata
from cartesapp.input import query, mutation
from cartesapp.output import add_output

from .core_settings import CoreSettings

LOGGER = logging.getLogger(__name__)


###
# Models

class SetOperatorPayload(BaseModel):
    new_operator_address: Address

class SetInternalVerifyLock(BaseModel):
    lock: Bool


###
# Mutations

@mutation(proxy=CoreSettings().proxy_address)
def set_operator_address(payload: SetOperatorPayload) -> bool:
    metadata = get_metadata()
    # only operator
    if metadata.msg_sender.lower() != CoreSettings().operator_address:
        msg = f"sender not allowed"
        LOGGER.error(msg)
        add_output(msg)
        return False

    CoreSettings().operator_address = payload.new_operator_address.lower()
    return True

@mutation(proxy=CoreSettings().proxy_address)
def set_internal_verify_lock(payload: SetInternalVerifyLock) -> bool:
    metadata = get_metadata()
    # only operator
    if metadata.msg_sender.lower() != CoreSettings().operator_address:
        msg = f"sender not allowed"
        LOGGER.error(msg)
        add_output(msg)
        return False

    CoreSettings().internal_verify_lock = payload.lock
    return True


###
# Queries

@query()
def operator_address() -> bool:
    add_output(CoreSettings().operator_address)
    return True

@query()
def proxy_address() -> bool:
    add_output(CoreSettings().proxy_address)
    return True
