"""
models.py — Data models for the Bank Statement Parser.

BankStatementResult extends the shared ParserResult contract from
msme-bios-parser-shared - see docs/MASTER_REFERENCE.md Section 4.
"""

from datetime import date
from typing import Optional
from pydantic import BaseModel, field_validator
from msme_bios_shared import ParserResult


class BankTransaction(BaseModel):
    txn_date: date
    description: str
    debit: float = 0.0
    credit: float = 0.0
    balance: float
    needs_review: bool = False
    review_reason: Optional[str] = None

    @field_validator("debit", "credit")
    @classmethod
    def no_negative_amounts(cls, v: float) -> float:
        if v < 0:
            raise ValueError("debit/credit amounts must be non-negative")
        return v


class BankStatementResult(ParserResult):
    """The full result for one parsed bank statement. source_type is always
    'bank_statement' for this parser - set automatically, not by the caller."""
    transactions: list[BankTransaction] = []

    def __init__(self, **data):
        data.setdefault("source_type", "bank_statement")
        super().__init__(**data)
