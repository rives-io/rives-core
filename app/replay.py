import os
from pydantic import BaseModel
import logging
import datetime
from typing import Optional
import tempfile
from hashlib import sha256

from cartesi.abi import String, Bytes, Bytes32, Int, UInt

from pytesi.storage import helpers # TODO: create repo to avoid this relative import hassle
from pytesi.manager import mutation, get_metadata, add_output, event, emit_event, contract_call, hex2bytes, str2bytes, bytes2str # TODO: create repo to avoid this relative import hassle

from .setup import AppSettings
from .riv import riv_process_replay

LOGGER = logging.getLogger(__name__)



###
# Model

# Inputs

# TODO: make abi abstract (it is on import)
class Replay(BaseModel):
    cartridge_id:   Bytes32
    outcard_hash:   Bytes32
    args:           String
    in_card:        Bytes
    log:            Bytes


# Outputs

@event()
class ReplayScore(BaseModel):
    cartridge_id:   String
    user_address:   String
    timestamp:      UInt
    score:          Int # default score
    score_struct:   String # json, but as it could be used onchain


###
# Mutations

# @chunked # TODO: decorator to allow chunked and compressed mutations
@mutation(chunk=True,compress=True)
def replay(replay: Replay) -> bool:
    
    metadata = get_metadata()

    LOGGER.info(metadata)
    
    cartridge_id = replay.cartridge_id.hex()

    replay_temp = tempfile.NamedTemporaryFile(delete=False)
    replay_file = replay_temp.file
    incard_temp = tempfile.NamedTemporaryFile()
    incard_file = incard_temp.file
    outcard_temp = tempfile.NamedTemporaryFile(delete=False)
    outcard_file = outcard_temp.file

    replay_file.write(replay.log)
    replay_file.flush()
    
    incard_file.write(replay.in_card)
    incard_file.flush()

    incard_path = len(replay.in_card) > 0 and incard_temp.name or None

    LOGGER.info("ProcesReplay: replaying cartridge...")
    cartridge_path = f"{AppSettings.cartridges_path}/{cartridge_id}"
    result = riv_process_replay(cartridge_path,replay_temp.name,outcard_temp.name,incard_path)

    if result.returncode != 0:
        add_output(str2bytes(f"Error processing replay: {result.stderr}"),tags=['error'])
        return False

    outcard_raw = outcard_file.read()
    outcard_hash = sha256(outcard_raw).digest()
    outcard_valid = outcard_hash == replay.outcard_hash

    outcard_format = outcard_raw[:4]
    LOGGER.info(f"==== BEGIN OUTCARD ({outcard_format}) ====")
    if outcard_format == "JSON" or outcard_format == "TEXT":
        outcard_str = outcard_raw[4:]
    else:
        outcard_str = outcard_raw[4:].hex()
    
    LOGGER.info(outcard_str)
    
    LOGGER.info("==== END OUTCARD ====")
    LOGGER.info(f"Expected Outcard Hash: {outcard_hash.hex()}")
    LOGGER.info(f"Computed Outcard Hash: {replay.outcard_hash.hex()}")
    LOGGER.info(f"Valid Outcard Hash : {outcard_valid}")

    # replay_temp.close()
    # outcard_temp.close()
    # incard_temp.close()

    if not outcard_valid:
        add_output(str2bytes(f"Out card hash doesn't match"),tags=['error'])
        return False

    score = 0
    if outcard_format == "JSON":
        try:
            score = int(json.loads(outcard_str).get('score')) or 0
        except Exception as e:
            LOGGER.info(f"COuldn't load score from json: {e}")
        
        
    replay_score = ReplayScore(
        cartridge_id = cartridge_id,
        user_address = metadata.msg_sender,
        timestamp = metadata.timestamp,
        score = score,
        score_struct = outcard_str
    )

    add_output(replay.log,tags=['replay',cartridge_id])
    emit_event(replay_score,tags=['score',cartridge_id])

    return True
