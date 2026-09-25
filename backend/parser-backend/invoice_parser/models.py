"""
models.py — Data models for the Invoice/Bill Parser.

InvoiceResult extends the shared ParserResult contract from
msme-bios-parser-shared - see docs/MASTER_REFERENCE.md Section 4.
"""

from datetime import date
from typing import Optional
from pydantic import BaseModel
from msme_bios_shared import ParserResult


class InvoiceLineItem(BaseModel):
    description: str
    qty: float
    rate: float
    amount: float
    gst_pct: float = 0.0


class InvoiceResult(ParserResult):
    """The full result for one parsed invoice. source_type is always
    'invoice_bill' for this parser - set automatically, not by the caller."""
    vendor_name: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[date] = None
    gstin: Optional[str] = None
    line_items: list[InvoiceLineItem] = []
    subtotal: float = 0.0
    cgst_amount: float = 0.0
    sgst_amount: float = 0.0
    total: float = 0.0

    def __init__(self, **data):
        data.setdefault("source_type", "invoice_bill")
        super().__init__(**data)
