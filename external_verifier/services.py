
import re
import pickle
from typing import List
from pydantic import BaseModel
from dagster import sensor, op, job, define_asset_job, asset, run_status_sensor, asset_sensor, multi_asset_sensor,\
    RunRequest, Config, RunConfig, SensorEvaluationContext, SkipReason, OpExecutionContext, AssetExecutionContext, \
    Definitions, DagsterRunStatus, Output, DynamicPartitionsDefinition, SensorResult, AssetSelection, SensorEvaluationContext, \
    AssetKey, MultiAssetSensorEvaluationContext, PathMetadataValue, Failure


from cartesi import abi
from cartesapp.utils import hex2bytes, str2bytes, bytes2hex, bytes2str

from common import ExtendedVerifyPayload, Storage, Rule, DbType, VerificationSender, InputFinder, InputType, ExternalVerificationOutput, \
    tape_verification, add_cartridge, remove_cartridge, set_operator, add_rule, initialize_storage_with_genesis_data, generate_cartridge_id, \
    set_unlocked_cartridges, add_locked_cartridge, deactivate_rule, VERIFICATIONS_BATCH_SIZE


###
# Models

class TapeVerificationConfig(Config):
    rule_id:        str
    outcard_hash:   str
    tape:           str
    claimed_score:  int
    sender:         str
    timestamp:      int
    input_index:    int
    in_card:        str
    tapes:          List[str]

class RuleConfig(Config):
    # id:                 str
    name:               str
    cartridge_id:       str
    args:               str
    in_card:            str
    score_function:     str
    sender:             str
    start:              int
    end:                int
    tapes:              List[str]
    allow_tapes:        bool
    allow_in_card:      bool
    save_tapes:         bool
    save_out_cards:     bool

class CartridgeConfig(Config):
    id:                 str
    data:               str
    sender:             str

class SetCartridgeUnlocksConfig(Config):
    ids:                List[str]
    unlocks:            List[bool]
    sender:             str

class RemoveCartridgeConfig(Config):
    id:                 str
    sender:             str

class SetOperatorConfig(Config):
    new_operator_address:   str
    sender:                 str

class DeactivateRuleConfig(Config):
    rule_id:                str
    sender:                 str

class ExternalVerificationOutputsConfig(Config):
    outputs: str

class ExternalVerificationOutputList(BaseModel):
    output_list: List[ExternalVerificationOutput]


###
# Jobs and Ops

@op
def initialize_storage_op(context: OpExecutionContext):
    context.log.info(f"initializing storage")
    # set_envs()
    initialize_storage_with_genesis_data()

@job
def initialize_storage_job():
    initialize_storage_op()

inputs_partition = DynamicPartitionsDefinition(name="tapes")
rules_input_partition = DynamicPartitionsDefinition(name="rules")
cartridges_input_partition = DynamicPartitionsDefinition(name="cartridges")
set_cartridge_unlocks_input_partition = DynamicPartitionsDefinition(name="cartridge_unlocks")
remove_cartridges_input_partition = DynamicPartitionsDefinition(name="remove_cartridges")
set_operators_input_partition = DynamicPartitionsDefinition(name="set_operators")
deactivate_rules_input_partition = DynamicPartitionsDefinition(name="deactivate_rules")


@asset(partitions_def=inputs_partition,key=["verify_input"])
def verification_output_asset(context: AssetExecutionContext, config: TapeVerificationConfig):
    context.log.info(f"tape verification")

    extended_verification_dict = config.dict()
    extended_verification_dict.update({
        "tape":hex2bytes(config.tape),
        "outcard_hash":hex2bytes(config.outcard_hash),
        "rule_id":hex2bytes(config.rule_id),
        "in_card":hex2bytes(config.in_card) if config.in_card else b'',
        "tapes":[hex2bytes(t) for t in config.tapes]
    })
    extended_verification: ExtendedVerifyPayload = ExtendedVerifyPayload.parse_obj(extended_verification_dict)
    out = tape_verification(extended_verification)

    if out is None:
        msg = f"Error verifying tape"
        context.log.error(msg)
        raise Failure(description="Error verifying tape")

    context.log.info(f"verified tape {out.tape_id=} with {out.score=}")

    return Output(
        out,
        metadata={
            "size": len(extended_verification.tape),
            "rule": config.rule_id,
            "sender":config.sender
        }
    )


@asset(partitions_def=rules_input_partition, key=["add_rule"])
def add_rule_asset(context: OpExecutionContext, config: RuleConfig):
    context.log.info(f"add rule {config.name} for cartridge {config.cartridge_id}")

    rule_dict = config.dict()
    rule_dict.update({
        "in_card": hex2bytes(config.in_card),
        "tapes":[hex2bytes(t) for t in config.tapes]
    })
    rule: Rule = Rule.parse_obj(rule_dict)
    context.log.info(rule)
    add_rule(rule)
    context.log.info(f"added {rule.name} rule")


add_rule_job = define_asset_job(
    name="add_rule_job",
    selection=AssetSelection.assets(add_rule_asset),
    partitions_def=rules_input_partition
)


@asset(partitions_def=cartridges_input_partition, key=["add_cartridge"])
def add_cartridge_asset(context: OpExecutionContext, config: CartridgeConfig):
    context.log.info(f"add cartridge {config.id}")

    add_locked_cartridge(config.id, hex2bytes(config.data), config.sender)
    context.log.info(f"added {config.id} cartridge")


add_cartridge_job = define_asset_job(
    name="add_cartridge_job",
    selection=AssetSelection.assets(add_cartridge_asset),
    partitions_def=cartridges_input_partition
)

@asset(partitions_def=set_cartridge_unlocks_input_partition, key=["set_cartridge_unlocks"])
def set_cartridge_unlocks_asset(context: OpExecutionContext, config: SetCartridgeUnlocksConfig):
    context.log.info(f"set cartridge unlocks {config.ids}")

    set_unlocked_cartridges(config.ids, config.unlocks, config.sender)
    context.log.info(f"unlocks of {config.ids} cartridges set")


set_cartridge_unlocks_job = define_asset_job(
    name="set_cartridge_unlocks_job",
    selection=AssetSelection.assets(set_cartridge_unlocks_asset),
    partitions_def=set_cartridge_unlocks_input_partition
)


@asset(partitions_def=remove_cartridges_input_partition, key=["remove_cartridge"])
def remove_cartridge_asset(context: OpExecutionContext, config: RemoveCartridgeConfig):
    context.log.info(f"remove cartridge {config.id}")

    remove_cartridge(config.id, config.sender)
    context.log.info(f"removed {config.id} cartridge")

remove_cartridge_job = define_asset_job(
    name="remove_cartridge_job",
    selection=AssetSelection.assets(remove_cartridge_asset),
    partitions_def=remove_cartridges_input_partition
)

@asset(partitions_def=set_operators_input_partition, key=["set_operator"])
def set_operator_asset(context: OpExecutionContext, config: SetOperatorConfig):
    context.log.info(f"setting operator {config.new_operator_address}")

    set_operator(config.new_operator_address, config.sender)
    context.log.info(f"operator set {config.new_operator_address}")

set_operator_job = define_asset_job(
    name="set_operator_job",
    selection=AssetSelection.assets(set_operator_asset),
    partitions_def=set_operators_input_partition
)

@asset(partitions_def=deactivate_rules_input_partition, key=["deactivate_rule"])
def deactivate_rule_asset(context: OpExecutionContext, config: DeactivateRuleConfig):
    context.log.info(f"Deactivating rule {config.rule_id}")

    deactivate_rule(config.rule_id, config.sender)
    context.log.info(f"rule {config.rule_id} deactivated")

deactivate_rule_job = define_asset_job(
    name="deactivate_rule_job",
    selection=AssetSelection.assets(deactivate_rule_asset),
    partitions_def=deactivate_rules_input_partition
)


@op
def submit_verification_op(context: OpExecutionContext, config: ExternalVerificationOutputsConfig):
    context.log.info(f"submit verifications")

    outputs = ExternalVerificationOutputList.parse_raw(config.outputs)

    sender = VerificationSender()

    context.log.info(f"detected {len(outputs.output_list)} new tape verifications")
    for i in range(0,len(outputs.output_list),VERIFICATIONS_BATCH_SIZE):
        sender.submit_external_outputs(outputs.output_list[i:i+VERIFICATIONS_BATCH_SIZE])
        context.log.info(f"sent {len(outputs.output_list[i:i+VERIFICATIONS_BATCH_SIZE])} tape verifications")

@job
def submit_verification_job():
    submit_verification_op()


# input_asset_job = define_asset_job(
#     name="input_asset_job",
#     selection=AssetSelection.assets(verification_output_asset,add_rule_asset,add_cartridge_asset),
#     partitions_def=inputs_partition
# )

verify_asset_job = define_asset_job(
    name="verify_asset_job",
    selection=AssetSelection.assets(verification_output_asset),
    partitions_def=inputs_partition
)

###
# Sensor

@sensor(job=initialize_storage_job)
def initialization_sensor(context: SensorEvaluationContext):
    context.log.info(f"initialization sensor {context.cursor=}")
    cursor = context.cursor or None
    if cursor is not None:
        yield SkipReason("Already run once")
        return
    run_key = "initialized"
    yield RunRequest(
        run_key=run_key,
    )
    context.update_cursor(run_key)

@sensor(jobs=[verify_asset_job,add_cartridge_job,add_rule_job,remove_cartridge_job,set_operator_job,set_cartridge_unlocks_job,deactivate_rule_job])
def inputs_sensor(context: SensorEvaluationContext):
    cursor = context.cursor or None
    if cursor is not None: cursor = int(cursor) + 1

    input_finder = InputFinder(timeout=0,poll_interval=1)
    next_input = input_finder.get_input(cursor,10)
    context.log.info(f"looking for new entries in input box from cursor {cursor}")
    new_input = next(next_input)

    run_requests = []
    tapes_partition_keys = []
    rules_partition_keys = []
    cartridges_partition_keys = []
    set_cartridge_unlocks_partition_keys = []
    remove_cartridges_partition_keys = []
    set_operators_partition_keys = []
    deactivate_rules_partition_keys = []


    blocks = []
    while new_input is not None:
        context.log.info(f"while {new_input=}")
        if new_input.type == InputType.error:
            msg = f"Error while getting inputs (last input block = {new_input.last_input_block}): {new_input.data.msg}"
            context.log.error(msg)
            continue
            # yield SkipReason("Error while getting inputs")
            # return
        elif new_input.type == InputType.unknown:
            context.log.info(f"new non-processable entry")
        elif new_input.type == InputType.none:
            blocks.append(new_input.last_input_block)
            break
        elif new_input.type == InputType.cartridge:
            context.log.info(f"new cartridge entry")
            cartridge_data = new_input.data.data
            cartridge_id = generate_cartridge_id(cartridge_data)
            key = f"add_cartridge_{cartridge_id}_{new_input.last_input_block}"
            # add_cartridge(cartridge_id,cartridge_data)
            cartridges_partition_keys.append(key)
            run_requests.append(RunRequest(
                job_name="add_cartridge_job",
                partition_key=key,
                run_config=RunConfig(
                    ops={
                        "add_cartridge": CartridgeConfig(
                            data=bytes2hex(cartridge_data),
                            id=cartridge_id,
                            sender=new_input.data.sender
                        ),
                    }
                )
            ))
        elif new_input.type == InputType.cartridge_set_unlock:
            context.log.info(f"set unlock  cartridge entry")
            key = f"set_cartridge_unlocks_{'_'.join(new_input.data.ids)}_{new_input.last_input_block}"
            # add_cartridge(cartridge_id,cartridge_data)
            set_cartridge_unlocks_partition_keys.append(key)
            run_requests.append(RunRequest(
                job_name="set_cartridge_unlocks_job",
                partition_key=key,
                run_config=RunConfig(
                    ops={
                        "set_cartridge_unlocks": SetCartridgeUnlocksConfig(
                            unlocks=new_input.data.unlocks,
                            ids=new_input.data.ids,
                            sender=new_input.data.sender
                        ),
                    }
                )
            ))
        elif new_input.type == InputType.remove_cartridge:
            context.log.info(f"remove cartridge entry")
            cartridge_id = new_input.data.id
            key = f"remove_cartridge_{cartridge_id}_{new_input.last_input_block}"
            # add_cartridge(cartridge_id,cartridge_data)
            remove_cartridges_partition_keys.append(key)
            run_requests.append(RunRequest(
                job_name="remove_cartridge_job",
                partition_key=key,
                run_config=RunConfig(
                    ops={"remove_cartridge":RemoveCartridgeConfig(**{"cartridge_id":cartridge_id,"sender":new_input.data.sender}),}
                )
            ))
        elif new_input.type == InputType.set_operator:
            context.log.info(f"set operator entry")
            new_operator_address = new_input.data.new_operator_address
            key = f"set_operator_{new_operator_address}_{new_input.last_input_block}"
            # add_cartridge(cartridge_id,cartridge_data)
            set_operators_partition_keys.append(key)
            run_requests.append(RunRequest(
                job_name="set_operator_job",
                partition_key=key,
                run_config=RunConfig(
                    ops={"set_operator":SetOperatorConfig(**{"new_operator_address":new_input.data.new_operator_address,"sender":new_input.data.sender}),}
                )
            ))
        elif new_input.type == InputType.deactivate_rule:
            context.log.info(f"deactivate entry")
            rule_id = new_input.data.rule_id
            key = f"deactivate_rule_{rule_id}_{new_input.last_input_block}"
            # add_cartridge(cartridge_id,cartridge_data)
            deactivate_rules_partition_keys.append(key)
            run_requests.append(RunRequest(
                job_name="deactivate_rule_job",
                partition_key=key,
                run_config=RunConfig(
                    ops={"deactivate_rule":DeactivateRuleConfig(**{"rule_id":rule_id,"sender":new_input.data.sender}),}
                )
            ))
        elif new_input.type == InputType.rule:
            context.log.info(f"new rule entry")
            rule: Rule = new_input.data
            rule_dict = rule.dict()
            rule_dict.update({
                "in_card":rule.in_card.hex(),
                "tapes":[t.hex() for t in rule.tapes]
            })
            # add_rule(rule)
            rule_name_key = re.sub(r'\s','_',rule.name.lower())
            key = f"add_rule_{rule.cartridge_id}_{rule_name_key}_{new_input.last_input_block}"
            rules_partition_keys.append(key)
            run_requests.append(RunRequest(
                job_name="add_rule_job",
                partition_key=key,
                run_config=RunConfig(
                    ops={"add_rule":RuleConfig(**rule_dict)}
                )
            ))
        elif new_input.type == InputType.verification:
            context.log.info(f"new verification entry")
            extended_verification: ExtendedVerifyPayload = new_input.data
            extended_verification_dict = extended_verification.dict()
            extended_verification_dict.update({
                "tape":extended_verification.tape.hex(),
                "outcard_hash":extended_verification.outcard_hash.hex(),
                "rule_id":extended_verification.rule_id.hex(),
                "in_card":extended_verification.in_card.hex(),
                "tapes":[t.hex() for t in extended_verification.tapes]
            })
            key = f"verify_input_{extended_verification.input_index}_{new_input.last_input_block}"
            tapes_partition_keys.append(key)
            run_requests.append(RunRequest(
                job_name="verify_asset_job",
                partition_key=key,
                run_config=RunConfig(
                    ops={"verify_input":TapeVerificationConfig(**extended_verification_dict)}
                )
            ))
        else:
            context.log.warning(f"unrecognized input type")

        blocks.append(new_input.last_input_block)
        new_input = next(next_input)
    
    context.log.info(f"Got {len(run_requests)} run requests until block {max(blocks)} ({tapes_partition_keys=} {rules_partition_keys=} {cartridges_partition_keys=})")
    context.update_cursor(str(max(blocks)))
    if len(run_requests) == 0:
        yield SkipReason("No inputs")
        return

    dynamic_partition_requests = []
    if tapes_partition_keys:
        dynamic_partition_requests.append(
            inputs_partition.build_add_request(tapes_partition_keys)
        )

    if cartridges_partition_keys:
        dynamic_partition_requests.append(
            cartridges_input_partition.build_add_request(
                cartridges_partition_keys
            )
        )

    if set_cartridge_unlocks_partition_keys:
        dynamic_partition_requests.append(
            set_cartridge_unlocks_input_partition.build_add_request(
                set_cartridge_unlocks_partition_keys
            )
        )

    if rules_partition_keys:
        dynamic_partition_requests.append(
            rules_input_partition.build_add_request(rules_partition_keys)
        )

    if remove_cartridges_partition_keys:
        dynamic_partition_requests.append(
            remove_cartridges_input_partition.build_add_request(remove_cartridges_partition_keys)
        )

    if set_operators_partition_keys:
        dynamic_partition_requests.append(
            set_operators_input_partition.build_add_request(set_operators_partition_keys)
        )

    if deactivate_rules_partition_keys:
        dynamic_partition_requests.append(
            deactivate_rules_input_partition.build_add_request(deactivate_rules_partition_keys)
        )

    return SensorResult(
        run_requests=run_requests,
        dynamic_partitions_requests=dynamic_partition_requests,
    )

@multi_asset_sensor(monitored_assets=[AssetKey("verify_input")], job=submit_verification_job)
def submit_verification_sensor(context: MultiAssetSensorEvaluationContext):
    output_list = []
    partition_keys = []
    context.log.info(f"Getting new outputs from {context.cursor=}")
    for (
        partition,
        materialization,
    ) in context.latest_materialization_records_by_partition(AssetKey(['verify_input']),True).items():
        context.log.info(f"Adding {partition=} to output list")
        p: PathMetadataValue = materialization.asset_materialization.metadata.get('path')
        if p is None:
            context.log.warning(f"No materialization for {partition=}")
            continue
        out: ExternalVerificationOutput = pickle.load(open(p.path,'rb'))
        output_list.append(out.dict())
        partition_keys.append(f"{partition}")

    if len(output_list) == 0:
        return SkipReason(
            f"Nothing to do"
        )

    partition_keys.sort()
    last_key = partition_keys[-1]
    context.log.info(f"Found {len(output_list)} new outputs, last output {last_key}")
    # context.update_cursor(last_key)
    context.advance_all_cursors()

    return RunRequest(
        run_key=context.cursor,
        run_config=RunConfig(
            ops={"submit_verification_op":ExternalVerificationOutputsConfig(
                outputs=ExternalVerificationOutputList(output_list=output_list).json())}
        )
    )


Storage(DbType.redis)
