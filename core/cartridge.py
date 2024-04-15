from pydantic import BaseModel
import logging
from typing import Optional, List
import base64

from cartesi.abi import String, Bytes, Bytes32, UInt

from cartesapp.storage import helpers
from cartesapp.context import get_metadata
from cartesapp.input import query, mutation
from cartesapp.output import event, output, add_output, emit_event, index_input

from .model import Cartridge, CartridgeInfo, create_cartridge, delete_cartridge
from .core_settings import get_cartridges_path

LOGGER = logging.getLogger(__name__)


# Inputs

class InserCartridgePayload(BaseModel):
    data: Bytes

class RemoveCartridgePayload(BaseModel):
    id: Bytes32

class CartridgePayload(BaseModel):
    id: String

# TODO: TypeError: unhashable type: 'ABIType' allow python cartesi types
class CartridgesPayload(BaseModel):
    name:       Optional[str]
    tags:       Optional[List[str]]
    page:       Optional[int]
    page_size:  Optional[int]


# Outputs

@event()
class CartridgeInserted(BaseModel):
    cartridge_id:   String
    user_address:   String
    timestamp:      UInt

@event()
class CartridgeRemoved(BaseModel):
    cartridge_id:   String
    timestamp:      UInt

Info = CartridgeInfo

@output()
class CartridgeInfo(BaseModel):
    id: String
    name: String
    user_address: String
    info: Optional[Info]
    created_at: UInt
    cover: Optional[str] # encode to base64

@output()
class CartridgesOutput(BaseModel):
    data:   List[CartridgeInfo]
    total:  UInt
    page:   UInt

###
# Mutations

@mutation()
def insert_cartridge(payload: InserCartridgePayload) -> bool:
    metadata = get_metadata()
    
    LOGGER.info("Saving cartridge...")
    try:
        cartridge_id = create_cartridge(payload.data,**get_metadata().dict())
    except Exception as e:
        msg = f"Couldn't insert cartridge: {e}"
        LOGGER.error(msg)
        add_output(msg)
        return False

    # cartridge_event = CartridgeInserted(
    #     cartridge_id = cartridge_id,
    #     user_address = metadata.msg_sender,
    #     timestamp = metadata.timestamp
    # )
    # out_tags = ['cartridge','insert_cartridge',cartridge_id]
    # add_output(payload.data,tags=out_tags)
    # emit_event(cartridge_event,tags=out_tags)
    index_input(tags=['cartridge',cartridge_id])

    return True

@mutation()
def remove_cartridge(payload: RemoveCartridgePayload) -> bool:
    metadata = get_metadata()

    LOGGER.info("Removing cartridge...")
    try:
        delete_cartridge(payload.id.hex(),**get_metadata().dict())
    except Exception as e:
        msg = f"Couldn't remove cartridge: {e}"
        LOGGER.error(msg)
        add_output(msg)
        return False

    # cartridge_event = CartridgeRemoved(
    #     cartridge_id = payload.id.hex(),
    #     timestamp = metadata.timestamp
    # )
    # emit_event(cartridge_event,tags=['cartridge','remove_cartridge',payload.id.hex()])

    return True


###
# Queries

@query(splittable_output=True)
def cartridge(payload: CartridgePayload) -> bool:
    query = helpers.select(c for c in Cartridge if c.id == payload.id)

    cartridge_data = b''
    if query.count() > 0:
        cartridge_file = open(f"{get_cartridges_path()}/{payload.id}",'rb')
        cartridge_data = cartridge_file.read()

    add_output(cartridge_data)

    LOGGER.info(f"Returning cartridge {payload.id} with {len(cartridge_data)} bytes")

    return True

@query()
def cartridge_info(payload: CartridgePayload) -> bool:
    cartridge = helpers.select(c for c in Cartridge if c.id == payload.id).first()

    if cartridge is not None:
        cartridge_dict = cartridge.to_dict(with_lazy=True)
        cartridge_dict['cover'] = base64.b64encode(cartridge_dict['cover'])
        out = CartridgeInfo.parse_obj(cartridge_dict)
        add_output(out)
    else:
        add_output("null")

    LOGGER.info(f"Returning cartridge {payload.id} info")

    return True

@query()
def cartridges(payload: CartridgesPayload) -> bool:
    cartridges_query = Cartridge.select()

    if payload.name is not None:
        cartridges_query = cartridges_query.filter(lambda c: payload.name in c.name)

    if payload.tags is not None and len(payload.tags) > 0:
        for tag in payload.tags:
            cartridges_query = cartridges_query.filter(lambda c: tag in c.info['tags'])
    
    total = cartridges_query.count()

    page = 1
    if payload.page is not None:
        page = payload.page
        if payload.page_size is not None:
            cartridges = cartridges_query.page(payload.page,payload.page_size)
        else:
            cartridges = cartridges_query.page(payload.page)
    else:
        cartridges = cartridges_query.fetch()
    

    dict_list_result = []
    for cartridge in cartridges:
        cartridge_dict = cartridge.to_dict()
        # cartridge_dict['cover'] = base64.b64encode(cartridge_dict['cover'])
        dict_list_result.append(cartridge_dict)

    LOGGER.info(f"Returning {len(dict_list_result)} of {total} cartridges")
    
    out = CartridgesOutput.parse_obj({'data':dict_list_result,'total':total,'page':page})
    
    add_output(out)

    return True
