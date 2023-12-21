from pydantic import BaseModel
import logging
import datetime
import tempfile
from hashlib import sha256
from typing import Optional, List

from cartesi.abi import String, Bytes, UInt, encode_model

from pytesi.storage import Entity, helpers, seed # TODO: create repo to avoid this relative import hassle
from pytesi.manager import query, mutation, get_metadata, event, output, add_output, emit_event, contract_call, hex2bytes, str2bytes, bytes2str # TODO: create repo to avoid this relative import hassle

from .riv import riv_get_cartridge_info, riv_get_cartridge_screenshot
from .setup import AppSettings

LOGGER = logging.getLogger(__name__)



###
# Model

# TODO: define cartridge class
class Cartridge(Entity):
    id              = helpers.PrimaryKey(str)
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

# Outputs

@event()
class AddCartridge(BaseModel):
    cartridge_id:   String
    user_address:   String
    timestamp:      UInt

@output()
class CartridgeInfo(BaseModel):
    id: String
    user_address: String
    info: String
    created_at: UInt
    cover: Bytes

@output()
class CartridgesOutput(BaseModel):
    cartridges: List[CartridgeInfo]


###
# Mutations

# @chunked # TODO: decorator to allow chunked and compressed mutations
@mutation(chunk=True,compress=True)
def save_cartridge(payload: SaveCartridgePayload) -> bool:
    LOGGER.info(get_metadata())

    if helpers.count(c for c in Cartridge if c.id == payload.id) > 0:
        add_output(f"Cartridge already added",tags=['error'])
        return False

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

    # TODO: convert to json output
    if cartridge is not None:
        out = CartridgeInfo.parse_obj(cartridge.to_dict())
        # add_output(ctg_out) # TODO: allow objs, str, hex and bytes. obj would create decoder
        add_output(out)
    else:
        add_output("null")

    return True

@query()
def cartridge(payload: CartridgePayload) -> bool:
    LOGGER.info(payload)

    qry = helpers.select(c for c in Cartridge if c.id == payload.id)

    if qry.count() > 0:
        cartridge_file = open(f"{AppSettings.cartridges_path}/{payload.id}",'rb')
        cartridge_data = cartridge_file.read()

        add_output(cartridge_data)
    else:
        add_output(b'')

    return True

@query()
def all_cartridges() -> bool:
    cartridges = Cartridge.select()[:]
    
    LOGGER.info(cartridges)

    dict_list_result = [r.to_dict() for r in cartridges]
    out = CartridgesOutput.parse_obj({'cartridges':dict_list_result})
    
    add_output(out)

    return True


###
# Helpers

def generate_cartridge_id(bin_data: bytes) -> str:
    return sha256(bin_data).hexdigest()

def create_cartridge(cartridge_data,**metadata):
    data_hash = generate_cartridge_id(cartridge_data)
    LOGGER.info(data_hash)

    cartridge_path = f"{AppSettings.cartridges_path}/{data_hash}"
    cartridge_file = open(cartridge_path,'wb')
    cartridge_file.write(cartridge_data)
    cartridge_file.close()

    result = riv_get_cartridge_info(cartridge_path)
    if result.returncode > 0:
        raise Exception("Error getting info")

    cartridge_info = result.stdout

    screenshot_temp = tempfile.NamedTemporaryFile()
    screenshot_file = screenshot_temp.file

    result = riv_get_cartridge_screenshot(cartridge_path,screenshot_file.name,0)
    # print("*** DEBUG PRINT ***",result)
    if result.returncode != 0:
        raise Exception("Error getting cover")

    cartridge_cover = open(screenshot_file.name,'rb').read()
    screenshot_temp.close()

    ts = metadata.get('timestamp') or 0
    c = Cartridge(
        id = data_hash,
        user_address = metadata.get('msg_sender'),
        created_at = metadata.get('timestamp') or 0,
        info = cartridge_info,
        cover = cartridge_cover
    )

    LOGGER.info(c)

    return data_hash

