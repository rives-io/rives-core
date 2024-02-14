import os
from cartesapp.manager import setup
from .settings import AppSettings

@setup()
def setup_rivemu():
    AppSettings.rivemu_path = os.getenv('RIVEMU_PATH')

