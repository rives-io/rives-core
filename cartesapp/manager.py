import os
import logging
import importlib
from inspect import getmembers, isfunction, signature
import sys, getopt
from typing import Optional, List, get_type_hints
from pydantic import BaseModel
from Crypto.Hash import keccak
from enum import Enum
import json

from cartesi import DApp, Rollup, RollupData, RollupMetadata, ABIRouter, URLRouter, URLParameters, abi
from cartesi.models import ABIFunctionSelectorHeader
from cartesi.abi import encode_model

from .storage import Storage, helpers, add_output_index, OutputType, get_output_indexes


LOGGER = logging.getLogger(__name__)

MAX_OUTPUT_SIZE = 1048567 # (2097152-17)/2

class EmptyClass(BaseModel):
    pass


###
# Manager

class Manager(object):
    dapp = DApp()
    abi_router = ABIRouter()
    url_router = URLRouter()
    storage = Storage
    modules_to_add = []
    queries_info = {}
    mutations_info = {}

    def __new__(cls):
        return cls
    
    @classmethod
    def add_module(cls,mod):
        cls.modules_to_add.append(mod)

    @classmethod
    def _import_apps(cls):
        if len(cls.modules_to_add) == 0:
            raise Exception("No modules detected")

        for module_name in cls.modules_to_add:
            importlib.import_module(module_name)

    @classmethod
    def _register_queries(cls):
        query_selectors = []
        for query_fn in Query.queries:
            query_name = query_fn.__name__
            module_name = query_fn.__module__.split('.')[0]

            sig = signature(query_fn)

            if len(sig.parameters) > 1:
                raise Exception("Queries shouldn't have more than one parameter")

            it = iter(sig.parameters.items())
            param = next(it, None)
            if param is not None:
                model = param[1].annotation
            else:
                model = EmptyClass

            # using url router
            path = f"{module_name}/{query_name}"
            if path in query_selectors:
                raise Exception("Duplicate query selector")
            query_selectors.append(path)
            cls.queries_info[f"{module_name}.{query_name}"] = {"selector":path,"module":module_name,"method":query_name,"model":model}
            LOGGER.info(f"Adding query {module_name}.{query_name} selector={path}, model={model.schema()}")
            cls.url_router.inspect(path=path)(_make_query(query_fn,model,param is not None,module=module_name))

    @classmethod
    def _register_mutations(cls):
        mutation_selectors = []
        for mutation_fn in Mutation.mutations:
            mutation_name = mutation_fn.__name__
            module_name = mutation_fn.__module__.split('.')[0]
            
            sig = signature(mutation_fn)

            if len(sig.parameters) > 1:
                raise Exception("Mutations shouldn't have more than one parameter")

            it = iter(sig.parameters.items())
            param = next(it, None)
            if param is not None:
                model = param[1].annotation
            else:
                model = EmptyClass

            # using abi router
            header = ABIFunctionSelectorHeader(
                function=f"{module_name}.{mutation_name}",
                argument_types=abi.get_abi_types_from_model(model)
            )
            header_selector = header.to_bytes()
            if header_selector in mutation_selectors:
                raise Exception("Duplicate mutation selector")
            mutation_selectors.append(header_selector)
            cls.mutations_info[f"{module_name}.{mutation_name}"] = {"selector":header,"module":module_name,"method":module_name,"model":model}
            LOGGER.info(f"Adding mutation {module_name}.{mutation_name} selector={header}, model={model.schema()}")
            cls.abi_router.advance(header=header)(_make_mut(mutation_fn,model,param is not None,module=module_name))

    @classmethod
    def _setup_settings(cls):
        add_indexer_query = False
        settings = Setting.settings
        for module_name in settings:
            settings_cls = settings[module_name]
            add_indexer_query = getattr(settings_cls,'index_outputs')
            if add_indexer_query: break
        if add_indexer_query:
            query()(indexer_query)

    @classmethod
    def _run_setup_functions(cls):
        for app_setup in Setup.setup_functions:
            app_setup()

    @classmethod
    def run(cls):
        cls.dapp.add_router(cls.abi_router)
        cls.dapp.add_router(cls.url_router)
        cls._import_apps()
        cls._setup_settings()
        cls._register_queries()
        cls._register_mutations()
        cls._run_setup_functions()
        cls.storage.initialize_storage()
        cls.dapp.run()


###
# Singletons

# Query
class Query:
    queries = []
    def __new__(cls):
        return cls
    
    @classmethod
    def add(cls, func):
        cls.queries.append(func)

def query(**kwargs):
    def decorator(func):
        Query.add(func)
        return func
    return decorator


# Mutation
class Mutation:
    mutations = []
    def __new__(cls):
        return cls
    
    @classmethod
    def add(cls, func):
        cls.mutations.append(func)

# TODO: decorator params to allow chunked and compressed mutations
def mutation(**kwargs):
    if kwargs.get('chunk') is not None:
        LOGGER.warning("Chunking inputs is not implemented yet")
    if kwargs.get('compress') is not None:
        LOGGER.warning("Compressing inputs is not implemented yet")
    def decorator(func):
        Mutation.add(func)
        return func
    return decorator


# Settings
class Setting:
    settings = {}
    def __new__(cls):
        return cls
    
    @classmethod
    def add(cls, klass):
        cls.settings[klass.__module__.split('.')[0]] = klass

def setting(**kwargs):
    def decorator(klass):
        Setting.add(klass)
        return klass
    return decorator

class Context(object):
    rollup: Rollup | None = None
    metadata: RollupMetadata | None = None
    module: str | None = None
    n_reports: int = 0
    n_notices: int = 0
    n_vouchers: int = 0

    def __new__(cls):
        return cls
    
    @classmethod
    def set_context(cls, rollup: Rollup, metadata: RollupMetadata, module: str):
        cls.rollup = rollup
        cls.metadata = metadata
        cls.module = module
        cls.n_reports = 0
        cls.n_notices = 0
        cls.n_vouchers = 0

    @classmethod
    def clear_context(cls):
        cls.rollup = None
        cls.metadata = None
        cls.module = None
        cls.n_reports: 0
        cls.n_notices = 0
        cls.n_vouchers = 0

class Setup:
    setup_functions = []
    
    def __new__(cls):
        return cls
    
    @classmethod
    def add_setup(cls, func):
        cls.setup_functions.append(_make_setup_function(func))

def _make_setup_function(f):
    @helpers.db_session
    def setup_func():
        f()
    return setup_func

def setup(**kwargs):
    def decorator(func):
        Setup.add_setup(func)
        return func
    return decorator


###
# Outputs

class OutputFormat(Enum):
    abi = 0
    packed_abi = 1
    json = 2

class Output:
    notices = {}
    reports = {}
    def __new__(cls):
        return cls
    
    @classmethod
    def add_report(cls, klass):
        cls.reports[klass.__name__] = klass

    @classmethod
    def add_notice(cls, klass):
        cls.notices[klass.__name__] = klass

def notice(**kwargs):
    def decorator(klass):
        Output.add_notice(klass)
        return klass
    return decorator

event = notice

def report(**kwargs):
    def decorator(klass):
        Output.add_report(klass)
        return klass
    return decorator

output = report

def get_metadata() -> RollupMetadata:
    return Context.metadata

def normalize_output(data,encode_format) -> [bytes, str]:
    if isinstance(data, bytes): return data,'bytes'
    if isinstance(data, int): data.to_bytes(32,byteorder='big'),'int'
    if isinstance(data, str): 
        if data.startswith('0x'): return hex2bytes(data[2:]),'hex'
        return str2bytes(data),'str'
    if isinstance(data, dict) or isinstance(data, list) or isinstance(data, tuple):
        return str2bytes(json.dumps(data)),data.__class__.__name__
    if issubclass(data.__class__,BaseModel): 
        if encode_format == OutputFormat.abi: return encode_model(data),data.__class__.__name__
        if encode_format == OutputFormat.packed_abi: return encode_model(data,True),data.__class__.__name__
        if encode_format == OutputFormat.json: return str2bytes(data.json()),data.__class__.__name__
    raise Exception("Invalid output format")

def normalize_voucher(*kargs):
    if len(kargs) == 1:
        if isinstance(kargs[0], bytes): return kargs[0],'bytes'
        if isinstance(kargs[0], str): return hex2bytes(kargs[0]),'hex'
        raise Exception("Invalid voucher payload")
    if len(kargs) == 2:
        if not isinstance(kargs[0], str): raise Exception("Invalid voucher selector")
        if not issubclass(kargs[1].__class__,BaseModel): raise Exception("Invalid voucher model")

        sig_hash = keccak.new(digest_bits=256)
        sig_hash.update(kargs[0].encode('utf-8'))

        selector = sig_hash.digest()[:4]
        data = abi.encode_model(kargs[1])

        return selector+data,kargs[1].__class__.__name__
    # TODO: 3 is name, classes, and data, 
    #   too many problems: how is model stored in index? how formats are defined: str or abi annotation? 
    raise Exception("Invalid number of arguments")

def send_report(payload_data, **kwargs):
    ctx = Context
    stg = Setting.settings.get(ctx.module)

    report_format = OutputFormat[getattr(stg,'report_format')] if hasattr(stg,'report_format') else OutputFormat.json
    payload,class_name = normalize_output(payload_data,report_format)

    tags=kwargs.get('tags')
    add_idx = ctx.metadata is not None and stg is not None \
        and hasattr(stg,'index_outputs') and getattr(stg,'index_outputs')

    sent_bytes = 0
    while sent_bytes < len(payload):
        inds = f" ({ctx.metadata.input_index}, {ctx.n_reports})" if ctx.metadata is not None else ""
        top_bytes = sent_bytes + MAX_OUTPUT_SIZE
        if top_bytes > len(payload):
            top_bytes = len(payload)
        
        if add_idx:
            LOGGER.debug(f"Adding index report{inds} {tags=}")
            add_output_index(ctx.metadata,OutputType.report,ctx.n_reports,class_name,tags)

        LOGGER.debug(f"Sending report{inds} {top_bytes - sent_bytes} bytes")
        ctx.rollup.report(bytes2hex(payload[sent_bytes:top_bytes]))
        ctx.n_reports += 1
        sent_bytes = top_bytes
    
add_output = send_report

def send_notice(payload_data, **kwargs):
    ctx = Context
    stg = Setting.settings.get(ctx.module)

    notice_format = OutputFormat[getattr(stg,'notice_format')] if hasattr(stg,'notice_format') else OutputFormat.abi
    payload,class_name = normalize_output(payload_data,notice_format)

    tags=kwargs.get('tags')

    inds = f" ({ctx.metadata.input_index}, {ctx.n_notices})" if ctx.metadata is not None else ""
    if ctx.metadata is not None and stg is not None and hasattr(stg,'index_outputs') and getattr(stg,'index_outputs'):
        LOGGER.debug(f"Adding index notice{inds} {tags=}")
        add_output_index(ctx.metadata,OutputType.notice,ctx.n_notices,class_name,tags)

    LOGGER.debug(f"Sending notice{inds} {len(payload)} bytes")
    ctx.rollup.notice(bytes2hex(payload))
    ctx.n_notices += 1

emit_event = send_notice

def send_voucher(destination: str, *kargs, **kwargs):
    payload,class_name = normalize_voucher()

    ctx = Context
    stg = Setting.settings.get(ctx.module)
    tags=kwargs.get('tags')
    inds = f" ({ctx.metadata.input_index}, {ctx.n_vouchers})" if ctx.metadata is not None else ""
    if ctx.metadata is not None and stg is not None and hasattr(stg,'index_outputs') and getattr(stg,'index_outputs'):
        LOGGER.debug(f"Adding index voucher{inds} {tags=}")
        add_output_index(ctx.metadata,OutputType.voucher,ctx.n_vouchers,class_name,tags)

    LOGGER.debug(f"Sending voucher{inds}")
    ctx.rollup.voucher({destination:destination,payload:bytes2hex(payload)})
    ctx.n_vouchers += 1

contract_call = send_voucher


###
# Helpers

def hex2bytes(hexstr):
    if hexstr.startswith('0x'): 
        hexstr = hexstr[2:]
    return bytes.fromhex(hexstr)

def bytes2str(binstr):
    return binstr.decode("utf-8")

def hex2str(hexstr):
    return bytes2str(hex2bytes(hexstr))

def bytes2hex(value):
    return "0x" + value.hex()

def str2bytes(strtxt):
    return strtxt.encode("utf-8")

def str2hex(strtxt):
    return bytes2hex(str2bytes(strtxt))

def _make_query(func,model,has_param, **kwargs):
    module = kwargs.get('module')
    @helpers.db_session
    def query(rollup: Rollup, params: URLParameters) -> bool:
        ctx = Context
        ctx.set_context(rollup,None,module)
        param_list = []
        if has_param:
            hints = get_type_hints(model)
            fields = []
            values = []
            for k in model.__fields__.keys():
                if k in params.query_params:
                    field_str = str(hints[k])
                    if field_str.startswith('typing.List') or field_str.startswith('typing.Optional[typing.List'):
                        fields.append(k)
                        values.append(params.query_params[k])
                    else:
                        fields.append(k)
                        values.append(params.query_params[k][0])
            kwargs = dict(zip(fields, values))
            param_list.append(model.parse_obj(kwargs))
        try:
            res = func(*param_list)
        finally:
            ctx.clear_context()
        return res
    return query

def _make_mut(func,model,has_param, **kwargs):
    module = kwargs.get('module')
    @helpers.db_session
    def mut(rollup: Rollup, data: RollupData) -> bool:
        ctx = Context
        ctx.set_context(rollup,data.metadata,module)
        payload = data.bytes_payload()[4:]
        param_list = []
        if has_param:
            param_list.append(abi.decode_to_model(data=payload, model=model)) #,packed=True)
        try:
            res = func(*param_list)
        finally:
            ctx.clear_context()
        return res
    return mut

class IndexerPayload(BaseModel):
    tags: Optional[List[str]]
    output_type: Optional[str]
    msg_sender: Optional[str]
    timestamp_gte: Optional[int]
    timestamp_lte: Optional[int]

def indexer_query(payload: IndexerPayload) -> bool:
    out = get_output_indexes(**payload.dict())

    add_output(out)

    return True


###
# CLI

def execute_from_command_line(argv):
    opts, args = getopt.getopt(argv[1:],"hrgc",["help","run","code_gen","create"])
    for opt, arg in opts:
        if opt in ('-h', '--help'):
            print(f"{argv[0]} [option]")
            print(f"    options: help, run, code_gen")
            sys.exit()
        elif opt in ("-r", "--run"):
            # x = arg
            try:
                from manager import Manager
                m = Manager()
                m.run()
            except Exception as e:
                print(e)
                exit(1)
        elif opt in ("-g", "--code_gen"): # generate frontend lib
            # x = arg
            print("Not yet Implemented")
            exit(1)
        elif opt in ("-c", "--create"): # create new app
            # x = arg
            print("Not yet Implemented")
            exit(1)
        else:
            print("No option selected")
            exit(1)


if __name__ == '__main__':
    execute_from_command_line(sys.argv)
    