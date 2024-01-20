import pony.orm
import logging
from enum import Enum
from typing import Optional, List

from cartesi.abi import String, Bytes, Int, UInt


helpers = pony.orm


###
# Models

class OutputType(Enum):
    report = 0
    notice = 1
    voucher = 2

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


###
# Indexer model and methods

class Output(Entity):
    id              = helpers.PrimaryKey(int, auto=True)
    output_type     = helpers.Required(str) # helpers.Required(OutputType)
    msg_sender      = helpers.Required(str, 66, lazy=True, index=True)
    block_number    = helpers.Required(int, lazy=True)
    timestamp       = helpers.Required(int, lazy=True, index=True)
    epoch_index     = helpers.Required(int, lazy=True)
    input_index     = helpers.Required(int)
    output_index    = helpers.Required(int)
    output_module   = helpers.Required(str)
    output_class    = helpers.Required(str)
    tags            = helpers.Set("OutputTag")

class OutputTag(Entity):
    id              = helpers.PrimaryKey(int, auto=True)
    name            = helpers.Required(str, index=True)
    output          = helpers.Required(Output, index=True)


def add_output_index(metadata,output_type,output_index,output_module,output_class,tags=None):
    o = Output(
        output_type     = output_type.name.lower(),
        output_class    = output_class,
        output_module   = output_module,
        msg_sender      = metadata.msg_sender.lower(),
        block_number    = metadata.block_number,
        timestamp       = metadata.timestamp,
        epoch_index     = metadata.epoch_index,
        input_index     = metadata.input_index,
        output_index    = output_index
    )
    if tags is not None:
        for tag in tags:
            t = OutputTag(
                name = tag,
                output = o
            )

def get_output_indexes(**kwargs):
    tags = kwargs.get('tags')

    output_query = Output.select()

    tag_query = OutputTag.select()

    if tags is not None and len(tags) > 0:
        tag_query = tag_query.filter(lambda t: t.name in tags)

    if kwargs.get('module') is not None:
        output_query = output_query.filter(lambda o: o.output_module == kwargs.get('module').lower())
    if kwargs.get('output_type') is not None:
        output_query = output_query.filter(lambda o: o.output_type == kwargs.get('output_type').lower())
    if kwargs.get('msg_sender') is not None:
        output_query = output_query.filter(lambda o: o.msg_sender == kwargs.get('msg_sender').lower())
    if kwargs.get('timestamp_gte') is not None:
        output_query = output_query.filter(lambda o: o.timestamp >= kwargs.get('timestamp_gte'))
    if kwargs.get('timestamp_lte') is not None:
        output_query = output_query.filter(lambda o: o.timestamp <= kwargs.get('timestamp_lte'))
    if kwargs.get('input_index') is not None:
        output_query = output_query.filter(lambda o: o.input_index == kwargs.get('input_index'))

    query = helpers.distinct(
        [o.output_type,o.output_module,o.output_class,o.input_index,o.output_index]
        for o in output_query for t in tag_query if t.output == o
    )

    return query.fetch()








# import pony.orm
# from enum import Enum
# from typing import Optional, List

# from cartesi.abi import String, Bytes, Int, UInt

# # class EnumConverter(pony.orm.dbapiprovider.Converter):
# #     def sql_type(self):
# #         return "VARCHAR(30)"
# #     def validate(converter, val, obj=None):
# #         if isinstance(val, Enum): pass
# #         elif isinstance(val, str): val = converter.py_type[val]
# #         elif isinstance(val, int): val = converter.py_type(val)
# #         else: throw(TypeError, "Attribute %r: expected type is 'Enum'. Got: %r" % (converter.attr, val))
# #         return val
# #     def py2sql(converter, val):
# #         print(f"py2sql{val=}")
# #         return val.name
# #     def sql2py(converter, val):
# #         print(f"sql2py{val=}")
# #         return converter.py_type[val].name
# #     # sql2py = validate
# #     dbval2val = sql2py
# #     val2dbval = py2sql
# #     def dbvals_equal(converter, x, y):
# #         print(f"dbvals_equal{x=},{y=}")
# #         if isinstance(x, Enum): x = x.name
# #         elif isinstance(x, int): x = converter.py_type(x).name
# #         if isinstance(y, Enum): y = y.name
# #         elif isinstance(y, int): y = converter.py_type(y).name
# #         return x == y

# helpers = pony.orm
# pony.orm.set_sql_debug(True)
# db = pony.orm.Database()
# Entity = db.Entity

# # helpers.Required(OutputType)
# class Output(Entity):
#     id              = helpers.PrimaryKey(int, auto=True)
#     output_type     = helpers.Required(str) # helpers.Required(OutputType)
#     msg_sender      = helpers.Required(str, lazy=True, index=True)
#     block_number    = helpers.Required(int, lazy=True)
#     timestamp       = helpers.Required(int, lazy=True, index=True)
#     epoch_index     = helpers.Required(int, lazy=True)
#     input_index     = helpers.Required(int)
#     output_index    = helpers.Required(int)
#     output_class    = helpers.Required(str)
#     tags            = helpers.Set("OutputTag")

# class OutputTag(Entity):
#     id              = helpers.PrimaryKey(int, auto=True)
#     name            = helpers.Required(str, index=True)
#     output          = helpers.Required(Output)

# db.bind(provider="sqlite", filename=":memory:")
# # db.provider.converter_classes.append((Enum, EnumConverter))
# db.generate_mapping(create_tables=True)


# o = Output(output_type='report',msg_sender="0x0000",timestamp=16000,block_number=0,epoch_index=0,input_index=0,output_index=0,output_class='hex')

# t1 = OutputTag(name='game',output=o)
# t2 = OutputTag(name='log',output=o)

# helpers.select(o for o in Output for t in OutputTag if t.output == o and t.name in ['log'] and o.output_type == 'report')[:]

# output_filter = lambda o: True
# prev_filter = output_filter
# output_filter = lambda o: prev_filter_filter(o) and o.timestamp <= 

# helpers.select(o for o in Output for t in OutputTag if t.output == o and t.name in ['log'] and o.output_type == 'report' and output_filter(o))[:]

# tags = ['log']

# output_query = Output.select()

# tag_query = OutputTag.select()

# if tags is not None and len(tags) > 0:
#     tag_query = tag_query.filter(lambda t: t.name in tags)

# output_query = output_query.filter(lambda o: o.msg_sender == '0x0000')

# q = helpers.distinct(
#     [o.output_type,o.output_class,o.input_index,o.output_index]
#     for o in output_query for t in tag_query if t.output == o
# )