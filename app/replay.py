import os
from pydantic import BaseModel
import logging
from typing import Optional
from hashlib import sha256
import json

from cartesi.abi import String, Bytes, Bytes32, Int, UInt

from cartesapp.storage import helpers # TODO: create repo to avoid this relative import hassle
from cartesapp.manager import mutation, get_metadata, add_output, event, emit_event, contract_call # TODO: create repo to avoid this relative import hassle
from cartesapp.utils import bytes2str

from .setup import AppSettings, ScoreType
from .riv import replay_log

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
    cartridge_id:   Bytes32
    user_address:   String
    timestamp:      UInt
    score:          Int # default score
    score_type:     Int = ScoreType.default.value # default, socoreboard, tournaments
    extra_score:    Int = 0
    extra:          String = '' # extra field to maintain compatibility with socoreboard, tournaments...


###
# Mutations

@mutation()
def replay(replay: Replay) -> bool:
    
    metadata = get_metadata()
    
    # process replay
    LOGGER.info("Replaying cartridge...")
    try:
        outcard_raw = replay_log(replay.cartridge_id.hex(),replay.log,replay.args,replay.in_card)
    except Exception as e:
        msg = f"Couldn't replay log: {e}"
        LOGGER.error(msg)
        add_output(msg,tags=['error'])
        return False

    # process outcard
    outcard_hash = sha256(outcard_raw.replace(b'\r',b"").replace(b'\t',b"").replace(b'\n',b"").replace(b' ',b"")).digest()
    outcard_valid = outcard_hash == replay.outcard_hash

    outcard_format = outcard_raw[:4]
    LOGGER.info(f"==== BEGIN OUTCARD ({outcard_format}) ====")
    if outcard_format == b"JSON" or outcard_format == b"TEXT":
        outcard_str = bytes2str(outcard_raw[4:])
    else:
        outcard_str = outcard_raw[4:].hex()
    
    LOGGER.info(outcard_str)
    
    LOGGER.info("==== END OUTCARD ====")
    LOGGER.info(f"Expected Outcard Hash: {replay.outcard_hash.hex()}")
    LOGGER.info(f"Computed Outcard Hash: {outcard_hash.hex()}")
    LOGGER.info(f"Valid Outcard Hash : {outcard_valid}")

    if not outcard_valid:
        msg = f"Out card hash doesn't match"
        LOGGER.error(msg)
        add_output(msg,tags=['error'])
        return False

    score = 0
    if outcard_format == b"JSON":
        try:
            score = int(json.loads(outcard_str).get('score')) or 0
        except Exception as e:
            LOGGER.info(f"Couldn't load score from json: {e}")

    replay_score = ReplayScore(
        cartridge_id = replay.cartridge_id,
        user_address = metadata.msg_sender,
        timestamp = metadata.timestamp,
        score = score
    )

    add_output(replay.log,tags=['replay',replay.cartridge_id.hex()])
    emit_event(replay_score,tags=['score','general',replay.cartridge_id.hex()])

    return True
