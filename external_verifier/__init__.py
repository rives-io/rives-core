from dagster import Definitions

from services import verification_output_asset, \
    verify_asset_job,initialize_storage_job,add_cartridge_job,add_rule_job,submit_verification_job, \
    inputs_sensor, initialization_sensor, submit_verification_sensor
###
# Definitions

defs = Definitions(
    assets=[verification_output_asset],
    jobs=[verify_asset_job,initialize_storage_job,add_cartridge_job,add_rule_job, submit_verification_job],
    sensors=[inputs_sensor,initialization_sensor,submit_verification_sensor],
)
