
import sys
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
    tape_verification, add_cartridge, add_rule, set_envs, initialize_storage_with_genesis_data, generate_cartridge_id, VERIFICATIONS_BATCH_SIZE


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

class RuleConfig(Config):
    id:                 str
    cartridge_id:       str
    args:               str
    in_card:            str
    score_function:     str
    sender:             str
    start:              int
    end:                int

class CartridgeConfig(Config):
    id:                 str
    data:               str

class ExternalVerificationOutputsConfig(Config):
    outputs: str

class ExternalVerificationOutputList(BaseModel):
    output_list: List[ExternalVerificationOutput]


###
# Jobs and Ops

@op
def initialize_storage_op(context: OpExecutionContext):
    context.log.info(f"initializing storage")
    set_envs()
    initialize_storage_with_genesis_data()

@job
def initialize_storage_job():
    initialize_storage_op()

inputs_partition = DynamicPartitionsDefinition(name="tapes")
rules_input_partition = DynamicPartitionsDefinition(name="rules")
cartridges_input_partition = DynamicPartitionsDefinition(name="cartridges")


@asset(partitions_def=inputs_partition,key=["verify_input"])
def verification_output_asset(context: AssetExecutionContext, config: TapeVerificationConfig):
    context.log.info(f"tape verification")

    extended_verification_dict = config.dict()
    extended_verification_dict.update({
        "tape":hex2bytes(config.tape),
        "outcard_hash":hex2bytes(config.outcard_hash),
        "rule_id":hex2bytes(config.rule_id)}
    )
    extended_verification: ExtendedVerifyPayload = ExtendedVerifyPayload.parse_obj(extended_verification_dict)
    out = tape_verification(extended_verification)

    if out is None:
        msg = f"Error verifying tape"
        context.log.error(msg)
        raise Failure(description="Error verifying tape")

    context.log.info(f"verified tape {out.tape_hash=} with {out.score=}")

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
    context.log.info(f"add rule {config.id}")

    rule_dict = config.dict()
    rule_dict.update({
        "in_card": hex2bytes(config.in_card),
    })
    rule: Rule = Rule.parse_obj(rule_dict)
    context.log.info(rule)
    add_rule(rule)
    context.log.info(f"added {rule.id} rule")


add_rule_job = define_asset_job(
    name="add_rule_job",
    selection=AssetSelection.assets(add_rule_asset),
    partitions_def=rules_input_partition
)


@asset(partitions_def=cartridges_input_partition, key=["add_cartridge"])
def add_cartridge_asset(context: OpExecutionContext, config: CartridgeConfig):
    context.log.info(f"add cartridge {config.id}")

    add_cartridge(config.id, hex2bytes(config.data))
    context.log.info(f"added {config.id} cartridge")


add_cartridge_job = define_asset_job(
    name="add_cartridge_job",
    selection=AssetSelection.assets(add_cartridge_asset),
    partitions_def=cartridges_input_partition
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

@sensor(jobs=[verify_asset_job,add_cartridge_job,add_rule_job])
def inputs_sensor(context: SensorEvaluationContext):
    cursor = context.cursor or None
    if cursor is not None: cursor = int(cursor)

    input_finder = InputFinder(timeout=0,poll_interval=1)
    next_input = input_finder.get_input(cursor)
    context.log.info(f"looking for new entries in input box from cursor {cursor}")
    new_input = next(next_input)

    run_requests = []
    tapes_partition_keys = []
    rules_partition_keys = []
    cartridges_partition_keys = []

    blocks = []
    while new_input is not None:
        if new_input.type == InputType.error:
            context.log.error(new_input.data.msg)
            yield SkipReason("Error while getting inputs")
            return
        elif new_input.type == InputType.unknown:
            context.log.info(f"new non-processable entry")
        elif new_input.type == InputType.none:
            blocks.append(new_input.last_input_block)
            break
        elif new_input.type == InputType.cartridge:
            context.log.info(f"new cartridge entry")
            cartridge_data = new_input.data.data
            cartridge_id = generate_cartridge_id(cartridge_data)
            key = f"add_cartridge_{cartridge_id}"
            # add_cartridge(cartridge_id,cartridge_data)
            cartridges_partition_keys.append(key)
            run_requests.append(RunRequest(
                job_name="add_cartridge_job",
                partition_key=key,
                run_config=RunConfig(
                    ops={
                        "add_cartridge": CartridgeConfig(
                            data=bytes2hex(cartridge_data),
                            id=cartridge_id
                        ),
                    }
                )
            ))
        elif new_input.type == InputType.rule:
            context.log.info(f"new rule entry")
            rule: Rule = new_input.data
            rule_dict = rule.dict()
            rule_dict.update({"in_card":rule.in_card.hex()})
            # add_rule(rule)
            key = f"add_rule_{rule.id}"
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
                "rule_id":extended_verification.rule_id.hex()}
            )
            key = f"verify_input_{extended_verification.input_index}"
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
    context.update_cursor(str(max(blocks) + 1))
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
    if rules_partition_keys:
        dynamic_partition_requests.append(
            rules_input_partition.build_add_request(rules_partition_keys)
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
