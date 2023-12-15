
import logging

from dapp_manager import DappManager

logging.basicConfig(level=logging.DEBUG)

if __name__ == '__main__':
    dm = DappManager()
    dm.run()
