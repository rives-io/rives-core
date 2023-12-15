import os
import logging
import importlib
from inspect import getmembers, isfunction, signature
import sys, getopt
from typing import List
from pydantic import BaseModel

from cartesi import DApp, Rollup, RollupData, RollupMetadata, ABIRouter, URLRouter, URLParameters, abi
from cartesi.models import ABIFunctionSelectorHeader

from storage import Storage, helpers

LOGGER = logging.getLogger(__name__)



class EmptyClass(BaseModel):
    pass


###
# DappManager

class DappManager(object):
    REQUIRED_FILES = ['__init__.py','settings.py','model.py','queries.py','mutations.py']

    _instance = None
    def __new__(class_, *args, **kwargs):
        if not isinstance(class_._instance, class_):
            class_._instance = object.__new__(class_, *args, **kwargs)
        return class_._instance

    def __init__(self):
        self.dapp = DApp()
        self.abi_router = ABIRouter()
        self.url_router = URLRouter()
        self.dapp.add_router(self.abi_router)
        self.dapp.add_router(self.url_router)
        self.storage = Storage()

        self.queries = []
        self.mutations = []

    def import_apps(self):
        # TODO: add standard wallet

        # add modules
        dirs = [d for d in os.listdir() if os.path.isdir(d) and not d.startswith('.') and not d.startswith('_')]
        modules_to_add = []
        for possible_module in dirs:
            files = [f for f in os.listdir(possible_module) if os.path.isfile(f"{possible_module}/{f}") and not f.startswith('.')]
            has_required = True
            for required in DappManager.REQUIRED_FILES:
                if required not in files: 
                    has_required = False
                    break
            if not has_required: continue
            modules_to_add.append(possible_module)

        if len(modules_to_add) == 0:
            raise Exception("No modules detected")

        for module_name in modules_to_add:
            module = importlib.import_module(module_name)

        def make_qry(func,model,has_param):
            @helpers.db_session
            def qry(rollup: Rollup, params: URLParameters) -> bool:
                ctx = Context()
                ctx.set_context(rollup,None)
                param_list = []
                if has_param:
                    fields = []
                    values = []
                    for k in model.__fields__.keys():
                        if k in params.query_params:
                            fields.append(k)
                            values.append(params.query_params[k][0])

                    kwargs = dict(zip(fields, values))
                    param_list.append(model.parse_obj(kwargs)) #,packed=True)
                try:
                    res = func(*param_list)
                finally:
                    ctx.clear_context()
                return res
            return qry

        for query_fn in Query().queries:
            query_name = query_fn.__name__
            self.queries.append((query_name,query_fn))
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
            self.url_router.inspect(path=path)(make_qry(query_fn,model,param is not None))

        def make_mut(func,model,has_param):
            @helpers.db_session
            def mut(rollup: Rollup, data: RollupData) -> bool:
                ctx = Context()
                ctx.set_context(rollup,data.metadata)
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

        for mutation_fn in Mutation().mutations:
            mutation_name = mutation_fn.__name__
            
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
            self.abi_router.advance(header=header)(make_mut(mutation_fn,model,param is not None))

    def run(self):
        self.import_apps()
        self.storage.initialize_storage()
        self.dapp.run()



###
# Singletons

# Query
class Query():
    queries = []
    def __new__(cls):
        return cls
    
    @classmethod
    def query(cls, *args, **kwargs):
        def decorator(func):
            cls.add(func)
            return func
        return decorator
    
    @classmethod
    def add(cls, func):
        cls.queries.append(func)

def query(*args, **kwargs):
    def decorator(func):
        Query().add(func)
        return func
    return decorator


# Mutation
class Mutation():
    mutations = []
    def __new__(cls):
        return cls
    
    @classmethod
    def mutation(cls, *args, **kwargs):
        def decorator(func):
            cls.add(func)
            return func
        return decorator
    
    @classmethod
    def add(cls, func):
        cls.mutations.append(func)

def mutation(*args, **kwargs):
    def decorator(func):
        Mutation().add(func)
        return func
    return decorator


# Settings
class Setting():
    settings = []
    def __new__(cls):
        return cls
    
    @classmethod
    def setting(cls, *args, **kwargs):
        def decorator(klass):
            cls.add(klass)
            return klass
        return decorator
    
    @classmethod
    def add(cls, klass):
        cls.settings.append(klass)

def setting(*args, **kwargs):
    def decorator(klass):
        Setting().add(klass)
        return klass
    return decorator

class Context(object):
    rollup: Rollup | None = None
    metadata: RollupMetadata | None = None

    def __new__(cls):
        return cls
    
    @classmethod
    def set_context(cls, rollup: Rollup, metadata: RollupMetadata):
        cls.rollup = rollup
        cls.metadata = metadata

    @classmethod
    def clear_context(cls):
        cls.rollup = None
        cls.metadata = None


###
# Outputs

class Output():
    notices = []
    reports = []
    def __new__(cls):
        return cls
    
    @classmethod
    def report(cls, *args, **kwargs):
        def decorator(klass):
            cls.add_report(klass)
            return klass
        return decorator
    
    @classmethod
    def add_report(cls, klass):
        cls.reports.append(klass)

    @classmethod
    def notice(cls, *args, **kwargs):
        def decorator(klass):
            cls.add_notice(klass)
            return klass
        return decorator
    
    @classmethod
    def add_notice(cls, klass):
        cls.notices.append(klass)

def notice(*args, **kwargs):
    def decorator(klass):
        Output().add_notice(klass)
        return klass
    return decorator

event = notice

def report(*args, **kwargs):
    def decorator(klass):
        Output().add_report(klass)
        return klass
    return decorator

output = report

def metadata() -> RollupMetadata:
    return Context().metadata

# TODO: Add indexing to outputs

# TODO: accept any payload, add type to Report list to allow decoding in frontend
def send_report(payload: bytes):
    ctx = Context()
    Context().rollup.report(bytes2hex(payload))

add_output = send_report

# TODO: accept any payload, add type to Notices list to allow decoding in frontend
def send_notice(payload: bytes):
    Context().rollup.notice(bytes2hex(payload))

emit_event = send_notice

# TODO: allow human abi ,human_abi: str,payload: List[Bar]):
def send_voucher(destination: str, payload: bytes):
    Context().rollup.voucher({destination:destination,payload:bytes2hex(payload)})

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
                from dapp_manager import DappManager
                dm = DappManager()
                dm.run()
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
    