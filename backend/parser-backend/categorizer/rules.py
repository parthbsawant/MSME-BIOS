"""
Ordered, case-insensitive regex rules. First rule that matches AND agrees
with the debit/credit side wins. A rule whose category is on the wrong side
is ignored (the next rules are still tried).

Separators in bank narrations vary ('NEFT DR', 'NEFT/DR/', 'neft-dr',
double spaces), so patterns use \\W* / \\W+ between words.
"""

import re
from typing import Optional

from .taxonomy import agrees

_RULES = [
    # A purchase-order reference on a debit is a supplier payment.
    ("supplier_payment", r"\bPO\W?\d{4}\W?\d{2}\W?\d{4}\b"),
    ("gst_payment",      r"\bGSTR|\bGST\W+PMT\b|\bCHALLAN\b|\bCHLN\b"),
    ("od_interest",      r"\bOD\W+INT"),
    ("salary",           r"\bSALARY\b|\bSAL\b"),
    ("electricity",      r"\bMSEDCL\b|\bELEC"),
    ("emi",              r"\bEMI\b|\bECS\b|\bNACH\b.*\bLOAN\b"),
    ("owner_capital",    r"\bOWNE?R\W+CAPITAL\b"),
    ("owner_drawing",    r"\bATM\b.*\b(WDL|WITHDRAW)"),
    ("cash_deposit",     r"\bCA?SH\W+DEP"),
    ("bank_charges",     r"\bBANK\W+CH(AR)?GE?S\b"),
    ("internet",         r"\bBROADBAND\b|\bBB\b|\bMOBILE\W+(AND\W+)?(BB|BROADBAND)\b"),
    ("transport",        r"\bDIESEL\b|\bDSL\b|\bT[E]?MPO\W+RUNNING\b"),
    ("packaging",        r"\bPACKAGING\b|\bPKG\b|\bCARRY\W+BAGS\b"),
    ("repairs",          r"\bREPAIRS?\b|\bRPRS\b|\bMAINT(ENANCE)?\b"),
    ("misc_expense",     r"\bMISC\b|\bDONATION\b"),
    ("customer_receipt", r"\bUPI\W*(CR|CREDIT)\b"),
]

RULES = [(cat, re.compile(pat, re.IGNORECASE)) for cat, pat in _RULES]


def match_rule(narration: str, side: Optional[str]) -> Optional[str]:
    """Category from the first matching rule that agrees with the side, else None."""
    text = narration or ""
    for category, pattern in RULES:
        if pattern.search(text) and agrees(category, side):
            return category
    return None
