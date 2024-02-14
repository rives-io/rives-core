import pony.orm
import logging
from enum import Enum
from typing import Optional, List

from cartesi.abi import String, Bytes, Int, UInt


helpers = pony.orm


###
# Storage

class Storage:
    db = pony.orm.Database()
    seeds = []
    
    def __new__(cls):
        return cls
    
    @classmethod
    def initialize_storage(cls):
        if logging.root.level <= logging.DEBUG:
            pony.orm.set_sql_debug(True)
        cls.db.bind(provider="sqlite", filename=":memory:")
        # cls.db.provider.converter_classes.append((Enum, EnumConverter))
        cls.db.generate_mapping(create_tables=True)
        for s in cls.seeds: s()

    @classmethod
    def add_seed(cls, func):
        cls.seeds.append(_make_seed_function(func))

def _make_seed_function(f):
    @helpers.db_session
    def seed_func():
        f()
    return seed_func

# TODO: allow ordering
def seed(**kwargs):
    def decorator(func):
        Storage.add_seed(func)
        return func
    return decorator


Entity = Storage.db.Entity

