import os
from pytesi.manager import setup, setting

@setting()
class FrameworkSettings:
    index_outputs = True

class AppSettings:
    rivemu_path = None
    cartridges_path = "cartridges"

@setup()
def setup_rivemu():
    AppSettings.rivemu_path = os.getenv('RIVEMU_PATH')