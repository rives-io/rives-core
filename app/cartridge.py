import os
from pydantic import BaseModel
import logging
from hashlib import sha256
from typing import Optional, List
import tempfile
import json
import base64

from cartesi.abi import String, Bytes, Bytes32, UInt

from cartesapp.storage import Entity, helpers, seed
from cartesapp.manager import query, mutation, get_metadata, event, output, add_output, emit_event, contract_call

from .riv import riv_get_cartridge_info, riv_get_cartridge_screenshot, riv_get_cartridges_path, riv_get_cover
from .setup import AppSettings

LOGGER = logging.getLogger(__name__)



###
# Model

# TODO: TypeError: unhashable type: 'ABIType' allow python cartesi types
class Cartridge(Entity):
    id              = helpers.PrimaryKey(str, 64)
    name            = helpers.Required(str, index=True, unique=True)
    user_address    = helpers.Required(str, 66)
    info            = helpers.Optional(helpers.Json, lazy=True)
    created_at      = helpers.Required(int)
    cover           = helpers.Optional(bytes, lazy=True)

@seed()
def initialize_data():
    cartridge_example_file = open('misc/snake.sqfs','rb')
    cartridge_example_data = cartridge_example_file.read()
    cartridge_example_file.close()
    create_cartridge(cartridge_example_data,msg_sender="0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266")
    if AppSettings.rivemu_path is None: os.remove('misc/snake.sqfs')

    cartridge_example_file = open('misc/doom.sqfs','rb')
    cartridge_example_data = cartridge_example_file.read()
    cartridge_example_file.close()
    create_cartridge(cartridge_example_data,msg_sender="0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266")
    if AppSettings.rivemu_path is None: os.remove('misc/doom.sqfs')

    cartridge_example_file = open('misc/antcopter.sqfs','rb')
    cartridge_example_data = cartridge_example_file.read()
    cartridge_example_file.close()
    create_cartridge(cartridge_example_data,msg_sender="0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266")
    if AppSettings.rivemu_path is None: os.remove('misc/antcopter.sqfs')

    cartridge_example_file = open('misc/freedoom.sqfs','rb')
    cartridge_example_data = cartridge_example_file.read()
    cartridge_example_file.close()
    create_cartridge(cartridge_example_data,msg_sender="0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266")
    if AppSettings.rivemu_path is None: os.remove('misc/freedoom.sqfs')


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

class Author(BaseModel):
    name:           str
    link:           str

class Info(BaseModel):
    name:           str
    summary:        Optional[str]
    description:    Optional[str]
    version:        Optional[str]
    status:         Optional[str]
    tags:           List[str]
    authors:        Optional[List[Author]]
    url:            Optional[str]

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
        add_output(msg,tags=['error'])
        return False

    cartridge_event = CartridgeInserted(
        cartridge_id = cartridge_id,
        user_address = metadata.msg_sender,
        timestamp = metadata.timestamp
    )
    out_tags = ['cartridge','insert_cartridge',cartridge_id]
    # add_output(payload.data,tags=out_tags)
    emit_event(cartridge_event,tags=out_tags)

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
        add_output(msg,tags=['error'])
        return False

    cartridge_event = CartridgeRemoved(
        cartridge_id = payload.id.hex(),
        timestamp = metadata.timestamp
    )
    emit_event(cartridge_event,tags=['cartridge','remove_cartridge',payload.id.hex()])

    return True


###
# Queries

@query(splittable_output=True)
def cartridge(payload: CartridgePayload) -> bool:
    query = helpers.select(c for c in Cartridge if c.id == payload.id)

    cartridge_data = b''
    if query.count() > 0:
        cartridge_file = open(f"{riv_get_cartridges_path()}/{payload.id}",'rb')
        cartridge_data = cartridge_file.read()

    add_output(cartridge_data)

    LOGGER.info(f"Returning cartridge {payload.id} with {len(cartridge_data)} bytes")

    return True

@query()
def cartridge_info(payload: CartridgePayload) -> bool:
    cartridge = helpers.select(c for c in Cartridge if c.id == payload.id).first()

    LOGGER.info(cartridge)

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


###
# Helpers

def generate_cartridge_id(bin_data: bytes) -> str:
    return sha256(bin_data).hexdigest()

def create_cartridge(cartridge_data,**metadata):
    data_hash = generate_cartridge_id(cartridge_data)
    
    if helpers.count(c for c in Cartridge if c.id == data_hash) > 0:
        raise Exception(f"Cartridge already exists")

    cartridge_file = open(f"{riv_get_cartridges_path()}/{data_hash}",'wb')
    cartridge_file.write(cartridge_data)
    cartridge_file.close()

    cartridge_info = riv_get_cartridge_info(data_hash)
    
    # validate info
    cartridge_info_json = json.loads(cartridge_info)
    Info(**cartridge_info_json)

    cartridge_cover = riv_get_cover(data_hash)
    if cartridge_cover is None or len(cartridge_cover) == 0:
        cartridge_cover = riv_get_cartridge_screenshot(data_hash,0)

    c = Cartridge(
        id = data_hash,
        name = cartridge_info_json['name'],
        user_address = metadata.get('msg_sender'),
        created_at = metadata.get('timestamp') or 0,
        info = cartridge_info_json,
        cover = cartridge_cover
    )

    LOGGER.info(c)

    return data_hash

def delete_cartridge(cartridge_id,**metadata):
    cartridge = Cartridge.get(lambda c: c.id == cartridge_id)
    if cartridge is None:
        raise Exception(f"Cartridge doesn't exist")

    if cartridge.user_address != metadata['msg_sender']:
        raise Exception(f"Sender not allowed")

    cartridge.delete()
    os.remove(f"{riv_get_cartridges_path()}/{cartridge_id}")
