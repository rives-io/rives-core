from pydantic import BaseModel
import logging
from typing import Optional, List
import base64

from cartesi.abi import String, Bytes, Bytes32, UInt, Address

from cartesapp.storage import helpers
from cartesapp.context import get_metadata
from cartesapp.input import query, mutation
from cartesapp.output import event, output, add_output, emit_event, index_input

from .model import Cartridge, InfoCartridge, create_cartridge, delete_cartridge, change_cartridge_user_address, StringList, Bytes32List, format_bytes_list_to_incard
from .core_settings import get_cartridges_path

LOGGER = logging.getLogger(__name__)


# Inputs

class InsertCartridgePayload(BaseModel):
    data: Bytes
    tapes: Bytes32List

class RemoveCartridgePayload(BaseModel):
    id: Bytes32

class TransferCartridgePayload(BaseModel):
    id: Bytes32
    new_user_address: Address

class CartridgePayload(BaseModel):
    id: String

# TODO: TypeError: unhashable type: 'ABIType' allow python cartesi types
class CartridgesPayload(BaseModel):
    name:       Optional[str]
    authors:     Optional[List[str]]
    tags:       Optional[List[str]]
    page:       Optional[int]
    page_size:  Optional[int]
    get_cover:  Optional[bool]


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

@output()
class CartridgeInfo(BaseModel):
    id: String
    name: String
    user_address: String
    authors: StringList
    info: Optional[InfoCartridge]
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
def insert_cartridge(payload: InsertCartridgePayload) -> bool:
    metadata = get_metadata()
    
    incard = format_bytes_list_to_incard(payload.tapes,b'')

    LOGGER.info("Saving cartridge...")
    try:
        cartridge_id = create_cartridge(payload.data,incard,**metadata.dict())
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
    out_tags = ['cartridge',cartridge_id]
    index_input(tags=out_tags)
    # emit_event(cartridge_event,tags=out_tags)

    return True

@mutation()
def remove_cartridge(payload: RemoveCartridgePayload) -> bool:
    metadata = get_metadata()

    LOGGER.info("Removing cartridge...")
    try:
        delete_cartridge(payload.id.hex(),**metadata.dict())
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

@mutation()
def transfer_cartridge(payload: TransferCartridgePayload) -> bool:
    metadata = get_metadata()

    LOGGER.info("Transfering cartridge...")
    try:
        change_cartridge_user_address(payload.id.hex(),payload.new_user_address, **metadata.dict())
    except Exception as e:
        msg = f"Couldn't transfer cartridge: {e}"
        LOGGER.error(msg)
        add_output(msg)
        return False

    return True


###
# Queries

@query(splittable_output=True)
def cartridge(payload: CartridgePayload) -> bool:
    query = helpers.select(c for c in Cartridge if c.active and c.id == payload.id)

    cartridge_data = b''
    if query.count() > 0:
        with open(f"{get_cartridges_path()}/{payload.id}",'rb')as cartridge_file:
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
    cartridges_query = Cartridge.select(lambda c: c.active)

    if payload.name is not None:
        cartridges_query = cartridges_query.filter(lambda c: payload.name in c.name)

    if payload.authors is not None:
        cartridges_query = cartridges_query.filter(lambda c: payload.authors in c.authors)

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

    # TODO: allow order by
    

    dict_list_result = []
    for cartridge in cartridges:
        cartridge_dict = cartridge.to_dict()
        if payload.get_cover is not None and payload.get_cover:
            cartridge_dict['cover'] = base64.b64encode(cartridge.cover)
        dict_list_result.append(cartridge_dict)

    LOGGER.info(f"Returning {len(dict_list_result)} of {total} cartridges")
    
    out = CartridgesOutput.parse_obj({'data':dict_list_result,'total':total,'page':page})
    
    add_output(out)

    return True
