"""
models.py — Data models for the Photo/Handwritten Bill Parser.

Note how much more of this is nullable compared to the invoice parser's
models - that's intentional. A handwritten bill genuinely might have
illegible fields; pretending otherwise means the parser crashes on real
input instead of gracefully flagging what it couldn't read. See
docs/PARSER_GUIDE.md Section 4.

Uses typing.Optional rather than the newer 'X | None' syntax - Pydantic
models specifically don't resolve that newer syntax reliably on Python
3.9, even with 'from __future__ import annotations' (a fix that DOES
work for plain functions, e.g. in msme-bios-parser-shared's
claude_client.py, but not for Pydantic BaseModel classes like these).
"""

from datetime import date
from typing import Optional
from pydantic import BaseModel
from msme_bios_shared import ParserResult


class HandwrittenLineItem(BaseModel):
    description: Optional[str] = None
    qty: Optional[float] = None
    rate: Optional[float] = None
    amount: Optional[float] = None
    confidence: Optional[str] = None  # "high" / "low", once ai_extractor.py sets this


class HandwrittenBillResult(ParserResult):
    """The full result for one parsed handwritten bill. source_type is
    always 'photo_bill' for this parser - set automatically."""
    vendor_or_customer_name: Optional[str] = None
    bill_date: Optional[date] = None
    line_items: list[HandwrittenLineItem] = []
    total: Optional[float] = None

    def __init__(self, **data):
        data.setdefault("source_type", "photo_bill")
        super().__init__(**data)
