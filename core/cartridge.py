from pydantic import BaseModel
import logging
from typing import Optional, List
import base64

import traceback

from cartesi.abi import String, Int, Bytes, Bytes32, UInt, Address, Bool

from cartesapp.storage import helpers
from cartesapp.context import get_metadata
from cartesapp.input import query, mutation
from cartesapp.output import event, output, add_output, emit_event, index_input
from cartesapp.utils import hex2bytes

from .model import Cartridge, CartridgeTag, CartridgeAuthor, InfoCartridge, Bytes32List, BoolList, \
    create_cartridge, delete_cartridge, change_cartridge_user_address, StringList, unlock_and_test_cartridge, create_and_unlock_cartridge
from .core_settings import CoreSettings, get_cartridges_path, get_version, format_cartridge_id_from_bytes

LOGGER = logging.getLogger(__name__)


# Inputs

class InsertCartridgePayload(BaseModel):
    data: Bytes

class SetUnlockedCartridgePayload(BaseModel):
    ids: Bytes32List
    unlocks: BoolList

class RemoveCartridgePayload(BaseModel):
    id: Bytes32

class TransferCartridgePayload(BaseModel):
    id: Bytes32
    new_user_address: Address

class CartridgePayload(BaseModel):
    id: String

# TODO: TypeError: unhashable type: 'ABIType' allow python cartesi types
class CartridgesPayload(BaseModel):
    name:           Optional[str]
    author:         Optional[str]
    tags:           Optional[List[str]]
    ids:            Optional[List[str]]
    user_address:   Optional[str]
    page:           Optional[int]
    page_size:      Optional[int]
    order_by:       Optional[str]
    order_dir:      Optional[str]
    get_cover:      Optional[bool]
    tags_or:        Optional[bool]
    full:           Optional[bool]
    enable_inactive:Optional[bool]
    enable_non_primary:Optional[bool]
    locked:         Optional[bool]

class GetCartridgeTagsPayload(BaseModel):
    name:           Optional[str]

class GetCartridgeAuthorsPayload(BaseModel):
    name:           Optional[str]


# Outputs

@event()
class CartridgeEvent(BaseModel):
    version:                Bytes32
    cartridge_id:           Bytes32
    cartridge_input_index:  Int
    cartridge_user_address: Address
    timestamp:              UInt

@event()
class CartridgeRemoved(BaseModel):
    cartridge_id:   Bytes32
    timestamp:      UInt

@output()
class CartridgeInfo(BaseModel):
    id: String
    name: String
    user_address: String
    input_index: Optional[UInt]
    authors: Optional[StringList]
    info: Optional[InfoCartridge]
    original_info: Optional[InfoCartridge]
    created_at: UInt
    updated_at: UInt
    cover: Optional[str] # encode to base64
    active: Optional[Bool]
    unlocked: Optional[Bool]
    primary: Optional[Bool]
    primary_id: Optional[String]
    last_version: Optional[String]
    versions: Optional[StringList]
    tapes: Optional[StringList]
    tags:  Optional[StringList]

@output()
class CartridgesOutput(BaseModel):
    data:   List[CartridgeInfo]
    total:  UInt
    page:   UInt

@output()
class CartridgeTagsOutput(BaseModel):
    tags:   List[str]

@output()
class CartridgeAuthorsOutput(BaseModel):
    authors:   List[str]

###
# Mutations

@mutation(proxy=CoreSettings().proxy_address)
def insert_cartridge(payload: InsertCartridgePayload) -> bool:
    metadata = get_metadata()
    
    LOGGER.info("Saving cartridge...")
    try:
        cartridge = create_cartridge(payload.data,**metadata.dict())
    except Exception as e:
        msg = f"Couldn't insert cartridge: {e}"
        LOGGER.error(msg)
        traceback.print_exc()
        add_output(msg)
        return False

    # cartridge_event = CartridgeEvent(
    #     version=get_version(),
    #     cartridge_id = hex2bytes(cartridge.id),
    #     cartridge_user_address = metadata.msg_sender,
    #     cartridge_input_index = metadata.input_index,
    #     timestamp = metadata.timestamp
    # )
    tags = ['cartridge','cartridge_inserted',cartridge.id]
    index_input(tags=tags)
    # emit_event(cartridge_event,tags=tags)

    return True

@mutation(proxy=CoreSettings().proxy_address)
def set_unlock_cartridge(payload: SetUnlockedCartridgePayload) -> bool:
    metadata = get_metadata()

    if metadata.msg_sender.lower() != CoreSettings().operator_address:
        msg = f"sender not allowed"
        LOGGER.error(msg)
        add_output(msg)
        return False

    payload_lens = [
        len(payload.ids),
        len(payload.unlocks),
    ]
    if len(set(payload_lens)) != 1:
        msg = f"payload have distinct sizes"
        LOGGER.error(msg)
        add_output(msg)
        return False
    
    LOGGER.info(f"Received batch of cartridge unlocks")
    for ind in range(len(payload.ids)):
        payload_id = format_cartridge_id_from_bytes(payload.ids[ind])

        LOGGER.info("Unlocking cartridge...")
        
        try:
            if payload.unlocks[ind]:
                cartridge = unlock_and_test_cartridge(payload_id,**metadata.dict())

                if cartridge is not None:
                    cartridge_event = CartridgeEvent(
                        version=get_version(),
                        cartridge_id = hex2bytes(cartridge.id),
                        cartridge_user_address = cartridge.user_address,
                        cartridge_input_index = cartridge.input_index,
                        timestamp = cartridge.created_at
                    )
                    tags = ['cartridge','cartridge_inserted',cartridge.id]
                    emit_event(cartridge_event,tags=tags)
            else:
                cartridges_deleted = delete_cartridge(payload_id,**metadata.dict())
                for cart in cartridges_deleted:
                    cartridge = cart[0]
                    cartridge.unlocked = False
                    cartridge.name = f"rejected_{payload_id}"
        except Exception as e:
            msg = f"Error while trying to unlock cartridge: {e}"
            LOGGER.error(msg)
            add_output(msg)
            LOGGER.info("Removing cartridge...")
            try:
                cartridges_deleted = delete_cartridge(payload_id,**metadata.dict())
                for cart in cartridges_deleted:
                    cartridge = cart[0]
                    cartridge.unlocked = False
                    cartridge.name = f"rejected_{payload_id}"
            except Exception as e:
                msg = f"Couldn't remove cartridge (id={payload_id}): {e}"
                LOGGER.error(msg)
                add_output(msg)

    return True

@mutation(proxy=CoreSettings().proxy_address)
def insert_and_unlock_cartridge(payload: InsertCartridgePayload) -> bool:
    metadata = get_metadata()
    
    # Check internal verification lock
    if CoreSettings().cartridge_moderation_lock:
        msg = f"Direct cartridge insertion locked"
        LOGGER.error(msg)
        add_output(msg)
        return False

    LOGGER.info("Saving cartridge...")
    try:
        cartridge = create_and_unlock_cartridge(payload.data,**metadata.dict())
    except Exception as e:
        msg = f"Couldn't insert cartridge: {e}"
        LOGGER.error(msg)
        traceback.print_exc()
        add_output(msg)
        return False

    cartridge_event = CartridgeEvent(
        version=get_version(),
        cartridge_id = hex2bytes(cartridge.id),
        cartridge_user_address = metadata.msg_sender,
        cartridge_input_index = metadata.input_index,
        timestamp = metadata.timestamp
    )
    tags = ['cartridge','cartridge_inserted',cartridge.id]
    index_input(tags=tags)
    emit_event(cartridge_event,tags=tags)

    return True

@mutation(proxy=CoreSettings().proxy_address)
def remove_cartridge(payload: RemoveCartridgePayload) -> bool:
    metadata = get_metadata()
    payload_id = format_cartridge_id_from_bytes(payload.id)

    LOGGER.info("Removing cartridge...")
    try:
        cartridges_deleted = delete_cartridge(payload_id,**metadata.dict())
    except Exception as e:
        msg = f"Couldn't remove cartridge: {e}"
        LOGGER.error(msg)
        add_output(msg)
        return False

    for cart in cartridges_deleted:
        cartridge = cart[0]
        cartridge_data = cart[1]
        cartridge_event = CartridgeRemoved(
            cartridge_id = cartridge.id,
            timestamp = metadata.timestamp
        )
        emit_event(cartridge_event,tags=['cartridge','cartridge_removed',cartridge.id])
        add_output(
            cartridge_data,
            tags=['cartridge','cartridge_data',cartridge.id]
        )

    return True

@mutation(proxy=CoreSettings().proxy_address)
def transfer_cartridge(payload: TransferCartridgePayload) -> bool:
    metadata = get_metadata()
    payload_id = format_cartridge_id_from_bytes(payload.id)

    LOGGER.info("Transfering cartridge...")
    try:
        cartridge = change_cartridge_user_address(payload_id,payload.new_user_address, **metadata.dict())
    except Exception as e:
        msg = f"Couldn't transfer cartridge: {e}"
        LOGGER.error(msg)
        add_output(msg)
        return False

    cartridge_event = CartridgeEvent(
        version=get_version(),
        cartridge_id = payload.id,
        cartridge_user_address = payload.new_user_address,
        cartridge_input_index = cartridge.input_index,
        timestamp = metadata.timestamp
    )
    emit_event(cartridge_event,tags=['cartridge','cartridge_transfered',payload_id])

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
    cartridge = Cartridge.get(lambda c: c.id == payload.id)

    if cartridge is not None:
        cartridge_dict = cartridge.to_dict(with_lazy=True, with_collections=True)
        if cartridge.cover is not None and len(cartridge.cover) > 0:
            cartridge_dict['cover'] = base64.b64encode(cartridge_dict['cover'])
        if len(cartridge.original_info.keys()) == 0:
            del cartridge_dict['original_info']
        out = CartridgeInfo.parse_obj(cartridge_dict)
        add_output(out)
    else:
        add_output("null")

    LOGGER.info(f"Returning cartridge {payload.id} info")

    return True

@query()
def cartridges(payload: CartridgesPayload) -> bool:
    cartridges_query = Cartridge.select() # lambda c: c.active and c.primary)

    if payload.enable_inactive is None or not payload.enable_inactive:
        cartridges_query = cartridges_query.filter(lambda c: c.active)

    if payload.enable_non_primary is None or not payload.enable_non_primary:
        cartridges_query = cartridges_query.filter(lambda c: c.primary)

    if payload.locked is not None:
        if payload.locked:
            cartridges_query = cartridges_query.filter(lambda c: not c.unlocked)
        else:
            cartridges_query = cartridges_query.filter(lambda c: c.unlocked)
    else:
        cartridges_query = cartridges_query.filter(lambda c: c.unlocked)

    if payload.name is not None:
        cartridges_query = cartridges_query.filter(lambda c: payload.name in c.name)

    if payload.user_address is not None:
        cartridges_query = cartridges_query.filter(lambda c: payload.user_address.lower() == c.user_address)

    if payload.author is not None:
        cartridges_query = helpers.select(c for c in cartridges_query for a in c.authors if payload.author in a.name)

    # if payload.tags is not None and len(payload.tags) > 0:
    #     for tag in payload.tags:
    #         cartridges_query = cartridges_query.filter(lambda c: tag in c.info['tags'])
    
    if payload.ids is not None and len(payload.ids) > 0:
        cartridges_query = cartridges_query.filter(lambda c: c.id in payload.ids)

    # TAGS
    if payload.tags is not None and len(payload.tags) > 0:
        if payload.tags_or is not None and payload.tags_or:
            tags_fn = lambda t: t.name in payload.tags
        else:
            tags_fn = lambda t: t.name in payload.tags and helpers.count(t) == len(payload.tags)
        cartridges_query = helpers.distinct(
            r for r in cartridges_query for t in CartridgeTag if r in t.cartridges and tags_fn(t)
        )
    else:
        cartridges_query = helpers.distinct(
            o for o in cartridges_query
        )

    total = cartridges_query.count()

    if payload.order_by is not None:
        order_dict = {"asc":lambda d: d,"desc":helpers.desc}
        order_dir_list = []
        order_by_list = payload.order_by.split(',')
        if payload.order_dir is not None:
            order_dir_list = payload.order_dir.split(',')
        for idx,ord in enumerate(order_by_list):
            if idx < len(order_dir_list): dir_order = order_dict[order_dir_list[idx]]
            else: dir_order = order_dict["asc"]
            cartridges_query = cartridges_query.order_by(dir_order(getattr(Cartridge,ord)))

    page = 1
    if payload.page is not None:
        page = payload.page
        if payload.page_size is not None:
            cartridges = cartridges_query.page(payload.page,payload.page_size)
        else:
            cartridges = cartridges_query.page(payload.page)
    else:
        cartridges = cartridges_query.fetch()

    full = payload.full is not None and payload.full
    dict_list_result = []
    for cartridge in cartridges:
        cartridge_dict = cartridge.to_dict(with_lazy=full, with_collections=full)
        if (full or payload.get_cover is not None and payload.get_cover) and \
                cartridge.cover is not None and len(cartridge.cover) > 0:
            cartridge_dict['cover'] = base64.b64encode(cartridge.cover)
        dict_list_result.append(cartridge_dict)

    LOGGER.info(f"Returning {len(dict_list_result)} of {total} cartridges")
    
    out = CartridgesOutput.parse_obj({'data':dict_list_result,'total':total,'page':page})
    
    add_output(out)

    return True

@query()
def cartridge_tags(payload: GetCartridgeTagsPayload) -> bool:
    tags_query = CartridgeTag.select()
    if payload.name is not None:
        tags_query = tags_query.filter(lambda r: payload.name in r.name)

    tag_names = helpers.select(r.name for r in tags_query).fetch()
    out = CartridgeTagsOutput.parse_obj({"tags":list(tag_names)})
    add_output(out)

    return True

@query()
def cartridge_authors(payload: GetCartridgeAuthorsPayload) -> bool:
    authors_query = CartridgeAuthor.select()
    if payload.name is not None:
        authors_query = authors_query.filter(lambda r: payload.name in r.name)

    names = helpers.select(r.name for r in authors_query).fetch()
    out = CartridgeAuthorsOutput.parse_obj({"authors":list(names)})
    add_output(out)

    return True
