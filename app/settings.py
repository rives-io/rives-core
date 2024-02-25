# App Framework settings

# Files with definitions to import
FILES = ['setup','cartridge','replay','scoreboard'] # * Required

# Index outputs in inspect indexer queries
INDEX_OUTPUTS = True # Defaul: False

ENABLE_DAPP_RELAY = False # Defaul: False

ENABLE_WALLET = False # Defaul: False (required to set ENABLE_DAPP_RELAY)

STORAGE_PATH = None

class AppSettings:
    rivemu_path = None
    cartridges_path = "cartridges"
    scoreboard_ttl = 7776000 # 90 days
