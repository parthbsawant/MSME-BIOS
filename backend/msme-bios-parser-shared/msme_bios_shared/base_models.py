"""
base_models.py — The shared output contract. Every parser's own result model
should extend ParserResult rather than redefining these fields, so the
Categorizer (and everything downstream) can query across all 3 parsers'
output using the same field names.

See docs/MASTER_REFERENCE.md (Section 4) in each parser repo for the full
reasoning behind this contract.
"""

from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel


class ParserResult(BaseModel):
    tenant_id: str
    source_file: str
    source_type: Literal["bank_statement", "invoice_bill", "photo_bill"]
    extraction_method: Literal["structured", "ai_vision"]
    needs_review: bool = False
    review_reason: Optional[str] = None
    extracted_at: datetime
