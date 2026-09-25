"""
msme_bios_shared — Shared code for the 3 MSME-BIOS document parsers.

Usage from any parser repo, once this package is installed:

    from msme_bios_shared import ParserResult, extract_structured, write_to_staging, validate_config
"""

from msme_bios_shared.base_models import ParserResult
from msme_bios_shared.claude_client import extract_structured, get_client
from msme_bios_shared.db import write_to_staging, get_connection
from msme_bios_shared.config import validate_config

__all__ = [
    "ParserResult",
    "extract_structured",
    "get_client",
    "write_to_staging",
    "get_connection",
    "validate_config",
]

__version__ = "0.1.0"
