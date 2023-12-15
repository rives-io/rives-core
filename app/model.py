from storage import Entity, helpers, seed, Storage # TODO: create repo to avoid this relative import hassle
import datetime
from hashlib import sha256

# TODO: define cartridge class
class Cartridge(Entity):
    id              = helpers.PrimaryKey(str)
    # user_address    = helpers.Required(str)
    # info            = helpers.Optional(helpers.Json)
    # created_at      = helpers.Required(datetime)
    # cover           = helpers.Required(bytes) 

def generate_cartridge_id(bin: bytes) -> str:
    return sha256(bin).hexdigest()

@seed()
def initialize_data():
    Cartridge(id='test')
    Cartridge(id='test2')


# TODO: define replay class
# type Replay struct {
#   CartridgeId string      `json:"cartridgeId"`
#   UserAddress string      `json:"userAddress"`
#   SubmittedAt uint64      `json:"submittedAt"`
#   Args string             `json:"args"`
#   OutCardHash []byte      `json:"outCardHash"`
#   InCard []byte           `json:"inCard"`
#   DataChunks *DataChunks  `json:"dataChunks"`
# }

# type DataChunks struct {
#   ChunksData map[uint32]*Chunk
#   TotalChunks uint32
# }
# type Chunk struct {
#   Data []byte
# }