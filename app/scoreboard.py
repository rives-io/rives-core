import os
from pydantic import BaseModel
import logging
from typing import Optional, List
from hashlib import sha256
from Crypto.Hash import keccak
import json
from py_expression_eval import Parser
import re

from cartesi.abi import String, Bytes, Bytes32, Int, UInt

from cartesapp.storage import Entity, helpers, seed
from cartesapp.manager import mutation, query, get_metadata, output, add_output, event, emit_event, contract_call
from cartesapp.utils import hex2bytes, str2bytes, bytes2str

from .setup import AppSettings, ScoreType, GameplayHash
from .riv import replay_log, riv_get_cartridge_outcard
from .cartridge import Cartridge

LOGGER = logging.getLogger(__name__)



###
# Model

class Scoreboard(Entity):
    id              = helpers.PrimaryKey(str, 64)
    name            = helpers.Required(str, index=True, unique=True)
    cartridge_id    = helpers.Required(str, 64, index=True)
    created_by      = helpers.Required(str, 66)
    created_at      = helpers.Required(int)
    args            = helpers.Optional(str)
    in_card         = helpers.Optional(bytes)
    score_function  = helpers.Required(str)
    # config          = helpers.Optional(helpers.Json) # TODO: e.g. max scores...
    scores          = helpers.Set("Score")

class Score(Entity):
    id              = helpers.PrimaryKey(int, auto=True)
    user_address    = helpers.Required(str, 66, index=True)
    timestamp       = helpers.Required(int)
    score           = helpers.Required(int)
    scoreboard      = helpers.Required(Scoreboard, index=True)

@seed()
def initialize_data():
    name = "simple"
    s = Scoreboard(
        id = sha256(str2bytes(name)).hexdigest(),
        cartridge_id = "907ab088197625939b2137998b0efd59f30b3683093733c1ca4e0a62d638e09f",
        name = name,
        created_by = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
        created_at = 1704078000,
        args = "",
        in_card = b'',
        score_function = "score"
    )
    name = "apple 2 seconds"
    s = Scoreboard(
        id = sha256(str2bytes(name)).hexdigest(),
        cartridge_id = "907ab088197625939b2137998b0efd59f30b3683093733c1ca4e0a62d638e09f",
        name = name,
        created_by = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
        created_at = 0,
        args = "",
        in_card = b'',
        score_function = "1000 * apples - 50*frame"
    )

# Inputs

class CreateScoreboardPayload(BaseModel):
    cartridge_id:       Bytes32
    name:               String
    args:               String
    in_card:            Bytes
    score_function:     String
    # config:             String # json

class ScoreboardReplayPayload(BaseModel):
    scoreboard_id:  Bytes32
    outcard_hash:   Bytes32
    log:            Bytes

class ScoreboardsPayload(BaseModel):
    cartridge_id:   str
    name:           Optional[str]
    page:           Optional[int]
    page_size:      Optional[int]

class ScoresPayload(BaseModel):
    scoreboard_id:  str
    page:           Optional[int]
    page_size:      Optional[int]

# Outputs

@event()
class ScoreboardCreated(BaseModel):
    scoreboard_id:  Bytes32
    created_by:     String
    created_at:     UInt

@event()
class ScoreboardRemoved(BaseModel):
    scoreboard_id:  Bytes32
    timestamp:      UInt

@event()
class ScoreboardReplayScore(BaseModel):
    cartridge_id:   Bytes32
    user_address:   String
    timestamp:      UInt
    score:          Int # default score
    score_type:     Int = ScoreType.scoreboard.value
    extra_score:    Int
    scoreboard_id:  String

class ScoreboardInfo(BaseModel):
    id: String
    name: String
    cartridge_id: String
    created_by: String
    created_at: UInt
    args: String
    in_card: Bytes
    score_function: String

class ScoreInfo(BaseModel):
    user_address: String
    timestamp: UInt
    score: Int
    
@output()
class ScoreboardsOutput(BaseModel):
    data:   List[ScoreboardInfo]
    total:  UInt
    page:   UInt

@output()
class ScoresOutput(BaseModel):
    data:   List[ScoreInfo]
    total:  UInt
    page:   UInt

###
# Mutations

@mutation()
def create_scoreboard(payload: CreateScoreboardPayload) -> bool:
    metadata = get_metadata()

    cartridge = Cartridge.get(lambda r: r.id == payload.cartridge_id.hex())

    if cartridge is None:
        msg = f"Cartridge {payload.cartridge_id.hex()} doesn't exist"
        LOGGER.error(msg)
        add_output(msg,tags=['error'])
        return False

    if helpers.count(s.id for s in Scoreboard if s.name == payload.name) > 0:
        msg = f"Scoreboard {payload.name} already exists"
        LOGGER.error(msg)
        add_output(msg,tags=['error'])
        return False

    # run cartridge to test args, incard and get outcard
    LOGGER.info(f"Running cartridge test")
    try:
        outcard_raw = riv_get_cartridge_outcard(payload.cartridge_id.hex(),0,payload.args,payload.in_card)
    except Exception as e:
        msg = f"Couldn't run cartridge test: {e}"
        LOGGER.error(msg)
        add_output(msg,tags=['error'])
        return False

    # process outcard
    outcard_hash = sha256(outcard_raw).digest()
    outcard_format = outcard_raw[:4]
    if outcard_format != b"JSON":
        msg = f"Outcard format is not json"
        LOGGER.error(msg)
        add_output(msg,tags=['error'])
        return False

    outcard_str = bytes2str(outcard_raw[4:])

    LOGGER.info(f"==== BEGIN OUTCARD ({outcard_format}) ====")
    LOGGER.info(outcard_str)
    LOGGER.info("==== END OUTCARD ====")

    try:
        outcard_json = json.loads(outcard_str)
    except Exception as e:
        msg = f"Couldn't parse json outcard: {e}"
        LOGGER.error(msg)
        add_output(msg,tags=['error'])
        return False

    try:
        parser = Parser()
        score = parser.parse(payload.score_function).evaluate(outcard_json)
    except Exception as e:
        msg = f"Couldn't parse score: {e}"
        LOGGER.error(msg)
        add_output(msg,tags=['error'])
        return False

    # str2bytes(metadata.msg_sender) + metadata.timestamp.to_bytes(32, byteorder='big')
    scoreboard_id = sha256(str2bytes(payload.name)).digest()

    LOGGER.info(f"Creating scoreboard {payload.name} (id={scoreboard_id.hex()}) with function {payload.score_function}")

    s = Scoreboard(
        id = scoreboard_id.hex(),
        cartridge_id = cartridge.id,
        name = payload.name,
        created_by = metadata.msg_sender,
        created_at = metadata.timestamp,
        args = payload.args,
        in_card = payload.in_card,
        score_function = payload.score_function
    )

    create_scoreboard_event = ScoreboardCreated(
        scoreboard_id = scoreboard_id,
        created_by = metadata.msg_sender,
        created_at = metadata.timestamp
    )
    emit_event(create_scoreboard_event,tags=['scoreboard','create_scoreboard',scoreboard_id.hex()])

    return True

@mutation()
def clean_scoreboards() -> bool:
    metadata = get_metadata()
    scoreboard_query = Scoreboard.select(lambda s: metadata.timestamp > s.created_at + AppSettings.scoreboard_ttl)
    for r in scoreboard_query.fetch():
        remove_scoreboard_event = ScoreboardRemoved(
            scoreboard_id = r.id,
            timestamp = metadata.timestamp
        )
        emit_event(remove_scoreboard_event,tags=['scoreboard','clean_scoreboard',r.id])

    scoreboard_query.delete(bulk=True)
    return True

@mutation()
def scoreboard_replay(replay: ScoreboardReplayPayload) -> bool:
    metadata = get_metadata()

    # get scoreboard
    scoreboard = Scoreboard.get(lambda s: s.id == replay.scoreboard_id.hex())
    if scoreboard is None:
        msg = f"Scoreboard {replay.scoreboard_id.hex()} doesn't exist"
        LOGGER.error(msg)
        add_output(msg,tags=['error'])
        return False

    if not GameplayHash.check(scoreboard.cartridge_id,sha256(replay.log).hexdigest()):
        msg = f"Gameplay already submitted"
        LOGGER.error(msg)
        add_output(msg,tags=['error'])
        return False

    # process replay
    LOGGER.info(f"Processing scoreboard replay...")
    try:
        outcard_raw = replay_log(scoreboard.cartridge_id,replay.log,scoreboard.args,scoreboard.in_card)
    except Exception as e:
        msg = f"Couldn't replay log: {e}"
        LOGGER.error(msg)
        add_output(msg,tags=['error'])
        return False

    # process outcard
    k = keccak.new(digest_bits=256)
    # outcard_hash = k.update(outcard_raw.replace(b'\r',b"").replace(b'\t',b"").replace(b'\n',b"").replace(b' ',b"")).digest()
    outcard_hash = k.update(outcard_raw).digest()
    outcard_valid = outcard_hash == replay.outcard_hash

    outcard_format = outcard_raw[:4]
    if outcard_format != b"JSON":
        msg = f"Outcard format is not json"
        LOGGER.error(msg)
        add_output(msg,tags=['error'])
        return False

    outcard_str = bytes2str(outcard_raw[4:])

    LOGGER.info(f"==== BEGIN OUTCARD ({outcard_format}) ====")
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

    try:
        outcard_json = json.loads(re.sub(r'\,(?!\s*?[\{\[\"\'\w])', '', outcard_str))
        parser = Parser()
        default_score = outcard_json['scores']
        score = parser.parse(scoreboard.score_function).evaluate(outcard_json)
    except Exception as e:
        msg = f"Couldn't parse score: {e}"
        LOGGER.error(msg)
        add_output(msg,tags=['error'])
        return False

    s = Score(
        user_address = metadata.msg_sender,
        timestamp = metadata.timestamp,
        score = score,
        scoreboard = scoreboard
    )

    replay_score = ScoreboardReplayScore(
        cartridge_id = hex2bytes(scoreboard.cartridge_id),
        user_address = metadata.msg_sender,
        timestamp = metadata.timestamp,
        score = default_score,
        extra_score = score,
        scoreboard_id = replay.scoreboard_id.hex(),
    )

    add_output(replay.log,tags=['replay',scoreboard.cartridge_id,replay.scoreboard_id.hex()])
    emit_event(replay_score,tags=['score',scoreboard.cartridge_id,replay.scoreboard_id.hex()])

    GameplayHash.add(scoreboard.cartridge_id,sha256(replay.log).hexdigest())

    return True

###
# Queries

@query()
def scoreboards(payload: ScoreboardsPayload) -> bool:
    scoreboards_query = Scoreboard.select(lambda r: r.cartridge_id == payload.cartridge_id)

    if payload.name is not None:
        scoreboards_query = scoreboards_query.filter(lambda r: payload.name in r.name)

    total = scoreboards_query.count()

    page = 1
    if payload.page is not None:
        page = payload.page
        if payload.page_size is not None:
            scoreboards = scoreboards_query.page(payload.page,payload.page_size)
        else:
            scoreboards = scoreboards_query.page(payload.page)
    else:
        scoreboards = scoreboards_query.fetch()
    

    dict_list_result = [s.to_dict() for s in scoreboards]

    LOGGER.info(f"Returning {len(dict_list_result)} of {total} scoreboards")
    
    out = ScoreboardsOutput.parse_obj({'data':dict_list_result,'total':total,'page':page})
    
    add_output(out)

    return True

@query()
def scores(payload: ScoresPayload) -> bool:
    scoreboard = Scoreboard.get(lambda r: r.id == payload.scoreboard_id)

    if scoreboard is None:
        msg = f"Scoreboard {payload.scoreboard_id} doesn't exist"
        LOGGER.error(msg)
        add_output(msg,tags=['error'])
        return False

    scores_query = Score. \
        select(lambda r: r.scoreboard == scoreboard). \
        order_by(helpers.desc(Score.score))

    total = scores_query.count()

    page = 1
    if payload.page is not None:
        page = payload.page
        if payload.page_size is not None:
            scores = scores_query.page(payload.page,payload.page_size)
        else:
            scores = scores_query.page(payload.page)
    else:
        scores = scores_query.fetch()
    

    dict_list_result = [s.to_dict() for s in scores]
    
    LOGGER.info(f"Returning {len(dict_list_result)} of {total} scores")
    
    out = ScoresOutput.parse_obj({'data':dict_list_result,'total':total,'page':page})
    
    add_output(out)

    return True

