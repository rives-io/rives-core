import logging
from cartesapp.input import query
from cartesapp.output import add_output

from .core_settings import CoreSettings

LOGGER = logging.getLogger(__name__)

@query()
def operator_address() -> bool:
    add_output(CoreSettings().operator_address)
    return True
