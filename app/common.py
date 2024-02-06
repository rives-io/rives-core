import os
from enum import Enum

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
