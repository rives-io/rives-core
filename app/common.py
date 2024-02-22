import os
from enum import Enum
from PIL import Image, ImageFont, ImageDraw
from Crypto.Hash import SHA256
import base58
import tempfile
import io
import pickle

from .protobuf_models import unixfs_pb2, merkle_dag_pb2
from .settings import STORAGE_PATH

DEFAULT_HEIGHT = 512
BG_EXTRA_WIDTH = 400
# MAIN_FONT_SIZE = 48
# AUX_FONT_SIZE = 16
MAIN_FONT_SIZE = 42
AUX_FONT_SIZE = 28

initial_space = 30
font2_initial_space = 60
final_space = 10
total_font_space = 80

class ScoreType(Enum):
    default = 0
    scoreboard = 1
    tournament = 2


class GameplayHash:
    cartridge_replays = {}
    cartridge_replays_filename = f"{STORAGE_PATH}/cartridge_replays.pkl"
    def __new__(cls):
        return cls
    
    @classmethod
    def get_cartridge_replays(cls):
        cartridge_replays = {}
        if STORAGE_PATH is not None:
            if os.path.exists(cls.cartridge_replays_filename):
                f = open(cls.cartridge_replays_filename, 'rb')
                cartridge_replays = pickle.load(f)
                f.close()
        else:
            cartridge_replays = cls.cartridge_replays
        return cartridge_replays

    @classmethod
    def store_cartridge_replays(cls,cartridge_replays):
        if STORAGE_PATH is not None:
            with open(cls.cartridge_replays_filename, 'wb') as f:
                pickle.dump(cartridge_replays, f)
        else:
            cls.cartridge_replays = cartridge_replays

    @classmethod
    def add(cls, cartridge_id, replay_hash):
        cartridge_replays = cls.get_cartridge_replays()
        if cartridge_replays.get(cartridge_id) is None: cartridge_replays[cartridge_id] = {}
        cartridge_replays[cartridge_id][replay_hash] = True
        cls.store_cartridge_replays(cartridge_replays)

    @classmethod
    def check(cls, cartridge_id, replay_hash):
        cartridge_replays = cls.get_cartridge_replays()
        return cartridge_replays.get(cartridge_id) is None \
            or cartridge_replays[cartridge_id].get(replay_hash) is None \
            or cartridge_replays[cartridge_id][replay_hash] == False

def get_cid(data: bytes) -> str:

    unixf = unixfs_pb2.Data()
    unixf.Type = 2 # file
    unixf.Data = data
    unixf.filesize = len(unixf.Data)

    mdag = merkle_dag_pb2.MerkleNode()
    mdag.Data = unixf.SerializeToString()

    mdag_data = mdag.SerializeToString()

    h = SHA256.new()
    h.update(mdag_data)
    sha256_code = "12"
    size = hex(h.digest_size)[2:]
    digest = h.hexdigest()
    combined = f"{sha256_code}{size}{digest}"
    multihash = base58.b58encode(bytes.fromhex(combined))
    cid = multihash.decode('utf-8')

    return cid


def screenshot_add_score(screenshot_data: bytes, game: str, score: int, user: str) -> bytes:
    screenshot_temp = tempfile.NamedTemporaryFile()
    screenshot_file = screenshot_temp.file
    screenshot_file.write(screenshot_data)
    screenshot_file.flush()

    img = Image.open(screenshot_temp.name)
    
    screenshot_temp.close()

    height = int((DEFAULT_HEIGHT // img.size[1]) * img.size[1])
    width = int(height / img.size[1] * img.size[0])
 
    space_between = (height - initial_space - final_space - 3 * total_font_space) // 2

    resized_img = img.resize((width,height))

    bg_img = Image.new('RGB', ( width + BG_EXTRA_WIDTH, height), color='#202020') 

    draw = ImageDraw.Draw(bg_img)

    font28 = ImageFont.truetype('misc/font/Retro Gaming.ttf',size=28)
    font42 = ImageFont.truetype('misc/font/Retro Gaming.ttf',size=42)

    draw.text((width + 10, initial_space), f"game",fill='#b3b3b3',font=font28)
    draw.text((width + 10, font2_initial_space), f"{game}",fill='#b3b3b3',font=font42)

    draw.text((width + 10, initial_space + total_font_space + space_between), f"score",fill='#b3b3b3',font=font28) # 170
    draw.text((width + 10, font2_initial_space + total_font_space + space_between), f"{score}",fill='#b3b3b3',font=font42) # 200

    draw.text((width + 10, initial_space + 2*(total_font_space + space_between)), f"user",fill='#b3b3b3',font=font28) # 300
    draw.text((width + 10, font2_initial_space + 2*(total_font_space + space_between)), f"{user}",fill='#b3b3b3',font=font42) # 330
    logo = Image.open('misc/Rives-Logo.png')

    bgc = bg_img.convert('RGBA')
    bgc.paste(logo,(width + BG_EXTRA_WIDTH - 100,10),logo.convert('RGBA'))

    bgc.paste(resized_img,(0,0))

    img_byte_arr = io.BytesIO()
    bgc.save(img_byte_arr, format='PNG')

    return img_byte_arr.getvalue()

