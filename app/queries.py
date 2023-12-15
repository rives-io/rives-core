
from pydantic import BaseModel
import logging
from typing import List
import json

from cartesi import URLParameters

from storage import helpers # TODO: create repo to avoid this relative import hassle
from dapp_manager import query, output, add_output, str2bytes # TODO: create repo to avoid this relative import hassle

from .model import *

LOGGER = logging.getLogger(__name__)

###
# Inputs
class CartridgesPayload(BaseModel):
    id: str

###
# Outputs
@output()
class CartridgeInfo(BaseModel):
    id: str

@output()
class CartridgesOutput(BaseModel):
    cartridges: List[CartridgeInfo]


###
# Queries
@query()
def cartridge_info(payload: CartridgesPayload) -> bool:
    LOGGER.info(payload)

    cartridges = helpers.select(c for c in Cartridge if c.id == payload.id)[:1]
    # cartridges = Cartridge.select(lambda c: c.id == payload.id)[:1]

    LOGGER.info(cartridges)

    # TODO: convert to json output
    if len(cartridges) > 0:
        out = CartridgeInfo.parse_obj(cartridges[0].to_dict())
        # add_output(ctg_out) # TODO: allow objs, str, hex and bytes. obj would create decoder
        add_output(str2bytes(out.json()))
    else:
        add_output(str2bytes("null"))

    return True

@query()
def all_cartridges() -> bool:
    cartridges = Cartridge.select()[:]
    
    LOGGER.info(cartridges)

    dict_list_result = [r.to_dict() for r in cartridges]
    out = CartridgesOutput.parse_obj({'cartridges':dict_list_result})
    
    add_output(str2bytes(out.json()))

    return True
