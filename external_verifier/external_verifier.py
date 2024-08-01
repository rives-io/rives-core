import sys
import time
import typer
from typing import Optional, List, Annotated
from multiprocessing import Process, Pool, Manager, Event
import logging
import math
import traceback

from common import ExtendedVerifyPayload, Storage, Rule, DbType, VerificationSender, InputFinder, InputType, \
    set_envs, initialize_storage_with_genesis_data, add_cartridge, remove_cartridge, add_rule, set_operator, push_verification, \
    verify_payload, deserialize_verification, deserialize_output, generate_cartridge_id, VERIFICATIONS_BATCH_SIZE


LOGGER = logging.getLogger("external_verifier")


###
# Processes

class Enqueuer(Process):
    cancel_event = None
    input_finder = None

    def __init__(self, cancel_event = None, timeout = 5, poll_interval = 1):
        super().__init__()
        self.cancel_event = cancel_event
        self.input_finder = InputFinder(timeout=timeout,poll_interval=poll_interval)

    def run(self):
        block = Storage.get_processed_block()
        if block is not None: block = int(block) + 1
        
        next_input = self.input_finder.get_input(block)

        LOGGER.info(f"looking for new entries in input box")
        while True:
            if self.cancel_event.is_set(): return

            new_input = next(next_input)

            if new_input.type == InputType.error:
                LOGGER.error(new_input.data.msg)
                self.cancel_event.set()
                return
            elif new_input.type == InputType.unknown:
                LOGGER.info(f"new non-processable entry")
            elif new_input.type == InputType.none:
                pass
            elif new_input.type == InputType.cartridge:
                LOGGER.info(f"new cartridge entry")
                cartridge_data = new_input.data.data
                cartridge_id = generate_cartridge_id(cartridge_data)
                add_cartridge(cartridge_id,cartridge_data,new_input.data.sender)
            elif new_input.type == InputType.remove_cartridge:
                LOGGER.info(f"remove cartridge entry")
                cartridge_id = new_input.data.id
                remove_cartridge(cartridge_id,new_input.data.sender)
            elif new_input.type == InputType.set_operator:
                LOGGER.info(f"set operator cartridge entry")
                cartridge_id = new_input.data.id
                set_operator(new_input.data.new_operator_address,new_input.data.sender)
            elif new_input.type == InputType.rule:
                LOGGER.info(f"new rule entry")
                rule: Rule = new_input.data
                add_rule(rule)
            elif new_input.type == InputType.verification:
                LOGGER.info(f"new verification entry")
                extended_verification: ExtendedVerifyPayload = new_input.data
                push_verification(extended_verification)
            else:
                LOGGER.warning(f"unrecognized input type")

            Storage.set_processed_block(new_input.last_input_block)

def deserialize_and_verify(data: bytes):
    verify_payload(deserialize_verification(data))
    Storage.remove_processing_verification(data)

class Verifier(Process):
    timeout = None
    pool_size = None
    cancel_event = None

    def __init__(self, cancel_event = None, pool_size = 5, timeout = 30):
        super().__init__()
        self.pool_size = pool_size
        self.timeout = timeout
        self.cancel_event = cancel_event

    def run(self):
        while True:
            if self.cancel_event.is_set(): break
            try:
                t0 = time.time()
                Storage.reset_processing_verification()
                all_data = []
                LOGGER.info(f"looking for tapes to verify")
                while time.time() - t0 < self.timeout and len(all_data) < self.pool_size:
                    t_left = math.ceil(time.time() - t0)
                    data = Storage.pop_verification(t_left)
                    if data is not None:
                        LOGGER.info(f"found tape")
                        all_data.append(data)
                if len(all_data) > 0:
                    LOGGER.info(f"verifiying {len(all_data)} tapes")
                    with Pool(len(all_data)) as pool:
                        # result = pool.map_async(verify_payload, all_data)
                        # result.wait()
                        all_status = pool.map(deserialize_and_verify,all_data)
                        LOGGER.info(f"batch processing status {all_status}")
            except Exception as e:
                LOGGER.error(e)
                traceback.print_exc()
                self.cancel_event.set()


class Submitter(Process):
    max_batch_size = None
    timeout = None
    sender = None
    cancel_event = None

    def __init__(self, cancel_event = None, max_batch_size = VERIFICATIONS_BATCH_SIZE,timeout = 300):
        super().__init__()
        self.max_batch_size = max_batch_size
        self.timeout = timeout
        self.sender = VerificationSender()
        self.cancel_event = cancel_event

    def run(self):
        while True:
            if self.cancel_event.is_set(): break
            try:
                t0 = time.time()
                Storage.reset_temp_output()
                all_data = []
                LOGGER.info(f"looking for verification outputs to send")
                while time.time() - t0 < self.timeout and len(all_data) < self.max_batch_size:
                    t_left = math.ceil(time.time() - t0)
                    data = Storage.pop_output(t_left)
                    if data is not None:
                        all_data.append(deserialize_output(data))
                if len(all_data) > 0:
                    LOGGER.info(f"sending {len(all_data)} tape verifications")
                    self.sender.submit_external_outputs(all_data)
                    LOGGER.info(f"verification for {len(all_data)} outputs sent")
                    for out in all_data:
                        Storage.remove_temp_output(out.json())
            except Exception as e:
                LOGGER.error(e)
                traceback.print_exc()
                self.cancel_event.set()


###
# CLI

app = typer.Typer(help="Rives External Verifier: Verify Tapes directly from the chain")

@app.command()
def run(db: Optional[DbType] = DbType.mem, log_level: Optional[str] = None, config: Annotated[List[str], typer.Option(help="args config in the [ key=value ] format")] = None, 
        disable_enqueuer: Optional[bool] = False, disable_verifier: Optional[bool] = False, disable_submitter: Optional[bool] = False):

    config_dict = {}
    if config is not None:
        import re
        for c in config:
            k,v = re.split('=',c,1)
            config_dict[k] = v

    Storage(db)
    # os.chdir('..')
    # set_envs()
    initialize_storage_with_genesis_data()

    if log_level is not None:
        logging.basicConfig(level=getattr(logging,log_level.upper()))
    cancel_event = Event()
    services = []
    if not disable_enqueuer:
        service_conf = {"cancel_event":cancel_event}
        if config_dict.get('enqueuer_timeout') is not None:
            service_conf['timeout'] = int(config_dict.get('enqueuer_timeout'))
        services.append(Enqueuer(**service_conf))
    if not disable_verifier:
        service_conf = {"cancel_event":cancel_event}
        if config_dict.get('verifier_timeout') is not None:
            service_conf['timeout'] = int(config_dict.get('verifier_timeout'))
        services.append(Verifier(**service_conf))
    if not disable_submitter:
        service_conf = {"cancel_event":cancel_event}
        if config_dict.get('submitter_timeout') is not None:
            service_conf['timeout'] = int(config_dict.get('submitter_timeout'))
        services.append(Submitter(**service_conf))

    try:
        for s in services:
            LOGGER.info(f"starting service {s.__class__.__name__}")
            s.start()
        for s in services: s.join()
    except KeyboardInterrupt:
        LOGGER.info(f"canceling")
        for s in services: s.terminate()
    finally:
        for s in services: s.join()

if __name__ == '__main__':
    app()
    