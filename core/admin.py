import logging
from pydantic import BaseModel

from cartesi.abi import Address

from cartesapp.context import get_metadata
from cartesapp.input import query, mutation
from cartesapp.output import add_output

from .core_settings import CoreSettings

LOGGER = logging.getLogger(__name__)


class SetOperatorPayload(BaseModel):
    new_operator_address: Address


@mutation()
def set_operator_address(payload: SetOperatorPayload) -> bool:
    metadata = get_metadata()
    # only operator
    if metadata.msg_sender.lower() != CoreSettings().operator_address:
        msg = f"sender not allowed"
        LOGGER.error(msg)
        add_output(msg)
        return False

    CoreSettings().operator_address = payload.new_operator_address
    return True


@query()
def operator_address() -> bool:
    add_output(CoreSettings().operator_address)
    return True

@query()
def proxy_address() -> bool:
    add_output(CoreSettings().proxy_address)
    return True
