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
