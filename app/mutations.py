from pydantic import BaseModel
import logging

from cartesi.abi import String, Bytes

from storage import helpers # TODO: create repo to avoid this relative import hassle
from dapp_manager import mutation, metadata, add_output, emit_event, contract_call, hex2bytes, str2bytes, bytes2str # TODO: create repo to avoid this relative import hassle

from .model import Cartridge, generate_cartridge_id

LOGGER = logging.getLogger(__name__)



###
# Inputs

# TODO: make abi abstract (it is on import)
class SaveCartridgePayload(BaseModel):
    data: Bytes


###
# Mutations

# @chunked # TODO: decorator to allow chunked mutation
@mutation()
def save_cartridge(payload: SaveCartridgePayload) -> bool:
    LOGGER.info(payload)
    LOGGER.info(metadata())

    data_hash = generate_cartridge_id(payload.data)
    LOGGER.info(data_hash)

    c = Cartridge(id=data_hash)

    LOGGER.info(c)

    add_output(payload.data)
    emit_event(hex2bytes(data_hash))

    return True


@mutation()
def empty_mutation() -> bool:
    LOGGER.info(metadata())

    return True
