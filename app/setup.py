import os
from enum import Enum
from cartesapp.manager import setup, setting

# TODO: use settings file instead of init
@setting()
class FrameworkSettings:
    index_outputs = True

class AppSettings:
    rivemu_path = None
    cartridges_path = "cartridges"
    scoreboard_ttl = 7776000 # 90 days

@setup()
def setup_rivemu():
    AppSettings.rivemu_path = os.getenv('RIVEMU_PATH')


class ScoreType(Enum):
    default = 0
    scoreboard = 1
    tournament = 2


class GameplayHash:
    cartridge_replays = {}
    def __new__(cls):
        return cls
    
    @classmethod
    def add(cls, cartridge_id, replay_hash):
        if cls.cartridge_replays.get(cartridge_id) is None: cls.cartridge_replays[cartridge_id] = {}
        cls.cartridge_replays[cartridge_id][replay_hash] = True

    @classmethod
    def check(cls, cartridge_id, replay_hash):
        return cls.cartridge_replays.get(cartridge_id) is None \
            or cls.cartridge_replays[cartridge_id].get(replay_hash) is None \
            or cls.cartridge_replays[cartridge_id][replay_hash] == False
