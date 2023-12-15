
import pony.orm

class Storage():
    db = pony.orm.Database()
    seeds = []
    
    def __new__(cls):
        return cls
    
    @classmethod
    def initialize_storage(cls):
        cls.db.bind(provider="sqlite", filename=":memory:")
        cls.db.generate_mapping(create_tables=True)
        for s in cls.seeds: s()

    @classmethod
    def add_seed(cls, func):
        cls.seeds.append(func)

def make_seed_function(f):
    @helpers.db_session
    def seed_func():
        f()
    return seed_func

def seed(*args, **kwargs):
    def decorator(func):
        Storage().add_seed(make_seed_function(func))
        return func
    return decorator

Entity = Storage().db.Entity


helpers = pony.orm

pony.orm.set_sql_debug(True)
