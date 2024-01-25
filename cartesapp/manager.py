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
import traceback
import typer

from cartesi import DApp, Rollup, RollupData, RollupMetadata, ABIRouter, URLRouter, URLParameters, abi
from cartesi.models import ABIFunctionSelectorHeader
from cartesi.abi import encode_model

from .storage import Storage, helpers, add_output_index, OutputType, get_output_indexes
from .utils import str2bytes, hex2bytes, bytes2hex


LOGGER = logging.getLogger(__name__)

MAX_OUTPUT_SIZE = 1048567 # (2097152-17)/2

class EmptyClass(BaseModel):
    pass


###
# Manager

class Manager(object):
    dapp = None
    abi_router = None
    url_router = None
    storage = None
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
    def _register_queries(cls, add_to_router=True):
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
            abi_types = [] # abi.get_abi_types_from_model(model)
            cls.queries_info[f"{module_name}.{query_name}"] = {"selector":path,"module":module_name,"method":query_name,"abi_types":abi_types,"model":model}
            if add_to_router:
                LOGGER.info(f"Adding query {module_name}.{query_name} selector={path}, model={model.schema()}")
                cls.url_router.inspect(path=path)(_make_query(query_fn,model,param is not None,module=module_name))

    @classmethod
    def _register_mutations(cls, add_to_router=True):
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
            abi_types = abi.get_abi_types_from_model(model)
            header = ABIFunctionSelectorHeader(
                function=f"{module_name}.{mutation_name}",
                argument_types=abi_types
            )
            header_selector = header.to_bytes().hex()
            if header_selector in mutation_selectors:
                raise Exception("Duplicate mutation selector")
            mutation_selectors.append(header_selector)
            cls.mutations_info[f"{module_name}.{mutation_name}"] = {"selector":header,"module":module_name,"method":mutation_name,"abi_types":abi_types,"model":model}
            if add_to_router:
                LOGGER.info(f"Adding mutation {module_name}.{mutation_name} selector={header_selector}, model={model.schema()}")
                cls.abi_router.advance(header=header)(_make_mut(mutation_fn,model,param is not None,module=module_name))

    @classmethod
    def _setup_settings(cls):
        add_indexer_query = False
        settings = Setting.settings
        for module_name in settings:
            settings_cls = settings[module_name]
            if getattr(settings_cls,'index_outputs'): 
                add_indexer_query = True
                break
        if add_indexer_query:
            output()(IndexerOutput)
            query()(indexer_query)

    @classmethod
    def _run_setup_functions(cls):
        for app_setup in Setup.setup_functions:
            app_setup()

    @classmethod
    def run(cls):
        cls.dapp = DApp()
        cls.abi_router = ABIRouter()
        cls.url_router = URLRouter()
        cls.storage = Storage
        cls.dapp.add_router(cls.abi_router)
        cls.dapp.add_router(cls.url_router)
        cls._import_apps()
        cls._setup_settings()
        cls._register_queries()
        cls._register_mutations()
        cls._run_setup_functions()
        cls.storage.initialize_storage()
        cls.dapp.run()

    @classmethod
    def generate_frontend_lib(cls, lib_path=None):
        cls._import_apps()
        cls._setup_settings()
        cls._register_queries(False)
        cls._register_mutations(False)
        # generate lib
        from .template_frontend_generator import render_templates
        params = [
            {"indexer_query":indexer_query,"indexer_output":IndexerOutput},
            Setting.settings,
            cls.mutations_info,
            cls.queries_info,
            Output.notices_info,
            Output.reports_info,
            cls.modules_to_add]
        if lib_path is not None: params.append(lib_path)
        render_templates(*params)

    @classmethod
    def create_frontend(cls):
        from .template_frontend_generator import create_frontend_structure
        create_frontend_structure()

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
    if kwargs.get('sender_address') is not None:
        LOGGER.warning("Sender address filtering is not implemented yet")
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
    notices_info = {}
    reports_info = {}
    vouchers_info = {}
    def __new__(cls):
        return cls
    
    @classmethod
    def add_report(cls, klass):
        module_name = klass.__module__.split('.')[0]
        class_name = klass.__name__
        abi_types = [] # abi.get_abi_types_from_model(klass)
        cls.reports_info[f"{module_name}.{class_name}"] = {"module":module_name,"class":class_name,"abi_types":abi_types,"model":klass}

    @classmethod
    def add_notice(cls, klass):
        module_name = klass.__module__.split('.')[0]
        class_name = klass.__name__
        abi_types = abi.get_abi_types_from_model(klass)
        cls.notices_info[f"{module_name}.{class_name}"] = {"module":module_name,"class":class_name,"abi_types":abi_types,"model":klass}

    @classmethod
    def add_voucher(cls, klass):
        module_name = klass.__module__.split('.')[0]
        class_name = klass.__name__
        abi_types = abi.get_abi_types_from_model(klass)
        cls.vouchers_info[f"{module_name}.{class_name}"] = {"module":module_name,"class":class_name,"abi_types":abi_types,"model":klass}

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

def voucher(**kwargs):
    def decorator(klass):
        Output.add_voucher(klass)
        return klass
    return decorator

contract_call = voucher

def get_metadata() -> RollupMetadata:
    return Context.metadata

def normalize_output(data,encode_format) -> [bytes, str]:
    if isinstance(data, bytes): return data,'bytes'
    if isinstance(data, int): data.to_bytes(32,byteorder='big'),'int'
    if isinstance(data, str): 
        if data.startswith('0x'): return hex2bytes(data[2:]),'hex'
        return str2bytes(data),'str'
    class_name = f"{data.__module__.split('.')[0]}.{data.__class__.__name__}"
    if isinstance(data, dict) or isinstance(data, list) or isinstance(data, tuple):
        return str2bytes(json.dumps(data)),class_name
    if issubclass(data.__class__,BaseModel): 
        if encode_format == OutputFormat.abi: return encode_model(data),class_name
        if encode_format == OutputFormat.packed_abi: return encode_model(data,True),class_name
        if encode_format == OutputFormat.json: return str2bytes(data.json(exclude_unset=True,exclude_none=True)),class_name
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
    # only one output to allow always chunking
    if ctx.n_reports > 0: raise Exception("Can't add multiple reports")
    
    stg = Setting.settings.get(ctx.module)

    report_format = OutputFormat[getattr(stg,'report_format')] if hasattr(stg,'report_format') else OutputFormat.json
    payload,class_name = normalize_output(payload_data,report_format)
    if len(payload) > 4194248:
        LOGGER.warn("Payload Data exceed maximum length. Truncating")
    payload = payload[:4194248] # 4194248 = 4194304 (4MB) - 56 B (extra 0x and json formating)

    # Always chunk if len > MAX_OUTPUT_SIZE
    # if len(payload) > MAX_OUTPUT_SIZE: raise Exception("Maximum report length violation")

    tags = kwargs.get('tags')
    add_idx = ctx.metadata is not None and stg is not None \
        and hasattr(stg,'index_outputs') and getattr(stg,'index_outputs')

    sent_bytes = 0
    while sent_bytes < len(payload):
        inds = f" ({ctx.metadata.input_index}, {ctx.n_reports})" if ctx.metadata is not None else ""
        top_bytes = sent_bytes + MAX_OUTPUT_SIZE
        if top_bytes > len(payload):
            top_bytes = len(payload)
        
        if add_idx:
            splited_class_name = class_name.split('.')[-1]
            LOGGER.debug(f"Adding index report{inds} {tags=}")
            add_output_index(ctx.metadata,OutputType.report,ctx.n_reports,ctx.module,splited_class_name,tags)

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

    if len(payload) > MAX_OUTPUT_SIZE: raise Exception("Maximum output length violation")

    tags = kwargs.get('tags')

    inds = f" ({ctx.metadata.input_index}, {ctx.n_notices})" if ctx.metadata is not None else ""
    if ctx.metadata is not None and stg is not None and hasattr(stg,'index_outputs') and getattr(stg,'index_outputs'):
        LOGGER.debug(f"Adding index notice{inds} {tags=}")
        splited_class_name = class_name.split('.')[-1]
        add_output_index(ctx.metadata,OutputType.notice,ctx.n_notices,ctx.module,splited_class_name,tags)

    LOGGER.debug(f"Sending notice{inds} {len(payload)} bytes")
    ctx.rollup.notice(bytes2hex(payload))
    ctx.n_notices += 1

emit_event = send_notice

def send_voucher(destination: str, *kargs, **kwargs):
    payload,class_name = normalize_voucher()

    if len(payload) > MAX_OUTPUT_SIZE: raise Exception("Maximum output length violation")

    ctx = Context
    stg = Setting.settings.get(ctx.module)
    tags = kwargs.get('tags')
    inds = f" ({ctx.metadata.input_index}, {ctx.n_vouchers})" if ctx.metadata is not None else ""
    if ctx.metadata is not None and stg is not None and hasattr(stg,'index_outputs') and getattr(stg,'index_outputs'):
        LOGGER.debug(f"Adding index voucher{inds} {tags=}")
        splited_class_name = class_name.split('.')[-1]
        add_output_index(ctx.metadata,OutputType.voucher,ctx.n_vouchers,ctx.module,splited_class_name,tags)

    LOGGER.debug(f"Sending voucher{inds}")
    ctx.rollup.voucher({destination:destination,payload:bytes2hex(payload)})
    ctx.n_vouchers += 1

submit_contract_call = send_voucher


###
# Helpers

def _make_query(func,model,has_param, **kwargs):
    module = kwargs.get('module')
    @helpers.db_session
    def query(rollup: Rollup, params: URLParameters) -> bool:
        try:
            ctx = Context
            ctx.set_context(rollup,None,module)
            # TODO: accept abi encode or json (for larger post requests, configured in settings)
            # Decoding url parameters
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
            res = func(*param_list)
        except Exception as e:
            msg = f"Error: {e}"
            LOGGER.error(msg)
            if logging.root.level <= logging.DEBUG:
                traceback.print_exc()
                add_output(msg)
            return False
        finally:
            ctx.clear_context()
        return res
    return query

def _make_mut(func,model,has_param, **kwargs):
    module = kwargs.get('module')
    @helpers.db_session
    def mut(rollup: Rollup, data: RollupData) -> bool:
        try:
            ctx = Context
            ctx.set_context(rollup,data.metadata,module)
            payload = data.bytes_payload()[4:]
            param_list = []
            if has_param:
                param_list.append(abi.decode_to_model(data=payload, model=model)) #,packed=True)
            res = func(*param_list)
        except Exception as e:
            msg = f"Error: {e}"
            LOGGER.error(msg)
            if logging.root.level <= logging.DEBUG:
                traceback.print_exc()
                add_output(msg,tags=['error'])
            return False
        finally:
            ctx.clear_context()
        return res
    return mut

# TODO add to indexer module and import it on manager

class IndexerPayload(BaseModel):
    tags: Optional[List[str]]
    output_type: Optional[str]
    msg_sender: Optional[str]
    timestamp_gte: Optional[int]
    timestamp_lte: Optional[int]
    module: Optional[str]
    input_index: Optional[int]

class OutputIndex(BaseModel):
    output_type: str
    module: str
    class_name: str
    input_index: int
    output_index: int

class IndexerOutput(BaseModel):
    data:   List[OutputIndex]

def indexer_query(payload: IndexerPayload) -> bool:
    out = get_output_indexes(**payload.dict())

    output_inds = [OutputIndex(output_type=r[0],module=r[1],class_name=r[2],input_index=r[3],output_index=r[4]) for r in out]
    
    add_output(IndexerOutput(data=output_inds))

    return True


###
# CLI

app = typer.Typer(help="Cartesapp Manager: manage your Cartesi Rollups App")


@app.command()
def run(modules: List[str]):
    """
    Run backend with MODULES
    """
    try:
        m = Manager()
        for mod in modules:
            m.add_module(mod)
        m.run()
    except Exception as e:
        print(e)
        traceback.print_exc()
        exit(1)

@app.command()
def generate_fronted_libs(modules: List[str]):
    """
    Generate frontend libs for MODULES
    """
    try:
        m = Manager()
        for mod in modules:
            m.add_module(mod)
        m.generate_frontend_lib()
    except Exception as e:
        print(e)
        traceback.print_exc()
        exit(1)

@app.command()
def create_frontend(force: Optional[bool]):
    """
    Create basic frontend
    """
    # check if it exists, bypass with force
    # create frontend web
    # doctor basic reqs (node)
    # install packages ["ajv": "^8.12.0","ethers": "^5.7.2","ts-transformer-keys": "^0.4.4"]
    print("Not yet Implemented")
    exit(1)

@app.command()
def create(name: str):
    """
    Create new Cartesi Rollups App with NAME
    """
    print("Not yet Implemented")
    exit(1)

@app.command()
def create_module(name: str, force: Optional[bool]):
    """
    Create new MODULE for current Cartesi Rollups App
    """
    print("Not yet Implemented")
    exit(1)

@app.command()
def deploy(conf: str):
    """
    Deploy App with CONF file
    """
    # doctor basic reqs (sunodo)
    print("Not yet Implemented")
    exit(1)

@app.command()
def node(dev: Optional[bool] = True):
    """
    Deploy App to NETWORK
    """
    # doctor basic reqs (sunodo,nonodo)
    print("Not yet Implemented")
    exit(1)

if __name__ == '__main__':
    app()
    