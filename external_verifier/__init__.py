from dagster import Definitions

from services import verification_output_asset, \
    verify_asset_job,initialize_storage_job,add_cartridge_job,add_rule_job,\
    submit_verification_job, remove_cartridge_job, set_operator_job, \
    inputs_sensor, initialization_sensor, submit_verification_sensor,  \
    add_cartridge_asset, add_rule_asset, remove_cartridge_asset, set_operator_asset, \
    deactivate_rule_asset, set_cartridge_unlocks_asset, set_cartridge_unlocks_job
###
# Definitions

defs = Definitions(
    assets=[verification_output_asset, add_cartridge_asset, add_rule_asset, \
            remove_cartridge_asset, set_operator_asset, deactivate_rule_asset, set_cartridge_unlocks_asset],
    jobs=[verify_asset_job,initialize_storage_job,add_cartridge_job,add_rule_job, \
          submit_verification_job, remove_cartridge_job, set_operator_job, set_cartridge_unlocks_job],
    sensors=[inputs_sensor,initialization_sensor,submit_verification_sensor],
)
