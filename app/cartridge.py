from pydantic import BaseModel
import logging
from hashlib import sha256
from typing import Optional, List
import tempfile
import json
import base64

from cartesi.abi import String, Bytes, UInt, encode_model

from cartesapp.storage import Entity, helpers, seed
from cartesapp.manager import query, mutation, get_metadata, event, output, add_output, emit_event, contract_call, hex2bytes, str2bytes, bytes2str

from .riv import riv_get_cartridge_info, riv_get_cartridge_screenshot, riv_get_cartridges_path
from .setup import AppSettings

LOGGER = logging.getLogger(__name__)



###
# Model

# TODO: TypeError: unhashable type: 'ABIType' allow python cartesi types
class Cartridge(Entity):
    id              = helpers.PrimaryKey(str)
    name            = helpers.Required(str, index=True, unique=True)
    user_address    = helpers.Required(str)
    info            = helpers.Optional(helpers.Json)
    created_at      = helpers.Required(int)
    cover           = helpers.Optional(bytes)

@seed()
def initialize_data():
    cartridge_example_file = open('misc/snake.sqfs','rb')
    cartridge_example_data = cartridge_example_file.read()
    cartridge_example_file.close()
    create_cartridge(cartridge_example_data,msg_sender="0x")


# Inputs

class SaveCartridgePayload(BaseModel):
    data: Bytes

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
class AddCartridge(BaseModel):
    cartridge_id:   String
    user_address:   String
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
    user_address: String
    info: Info
    created_at: UInt
    cover: String # encode to base64

@output()
class CartridgesOutput(BaseModel):
    data:   List[CartridgeInfo]
    total:  UInt
    page:   UInt

class Test(BaseModel):
    cover: String

###
# Mutations

@mutation(chunk=True,compress=True)
def save_cartridge(payload: SaveCartridgePayload) -> bool:
    
    LOGGER.info("Saving Cartridge...")

    try:
        cartridge_id = create_cartridge(payload.data,**get_metadata().dict())
    except Exception as e:
        add_output(f"Could create cartridge: {e}",tags=['error'])
        return False

    add_cartridge_event = AddCartridge(
        cartridge_id = cartridge_id,
        user_address = metadata.msg_sender,
        timestamp = metadata.timestamp
    )
    out_tags = ['cartridge',cartridge_id]
    add_output(payload.data,tags=out_tags)
    emit_event(add_cartridge_event,tags=out_tags)

    return True


###
# Queries

@query()
def cartridge_info(payload: CartridgePayload) -> bool:
    LOGGER.info(payload)

    cartridge = helpers.select(c for c in Cartridge if c.id == payload.id).first()
    # cartridges = Cartridge.select(lambda c: c.id == payload.id)[:1]

    LOGGER.info(cartridge)

    if cartridge is not None:
        cartridge_dict = cartridge.to_dict()
        cartridge_dict['cover'] = base64.b64encode(cartridge_dict['cover'])
        out = CartridgeInfo.parse_obj(cartridge_dict)
        add_output(out)
    else:
        add_output("null")

    return True

@query()
def cartridge(payload: CartridgePayload) -> bool:
    LOGGER.info(payload)

    query = helpers.select(c for c in Cartridge if c.id == payload.id)

    if query.count() > 0:
        cartridge_file = open(f"{riv_get_cartridges_path()}/{payload.id}",'rb')
        cartridge_data = cartridge_file.read()

        add_output(cartridge_data)
    else:
        add_output(b'')

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
        cartridge_dict['cover'] = base64.b64encode(cartridge_dict['cover'])
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
