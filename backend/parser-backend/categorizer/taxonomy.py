"""
The category list and which side of the statement each category sits on.

'customer_receipt' is stage 1 only: reconciliation (Step 4) later turns it
into 'collection' (paid a credit invoice) or 'sales_upi' (a shop sale).
The categorizer itself never outputs 'collection' or 'sales_upi'.
"""

from typing import Optional

CREDIT = "credit"
DEBIT = "debit"

# category -> side it normally sits on (None = either side)
SIDE = {
    "customer_receipt": CREDIT,
    "collection": CREDIT,
    "sales_upi": CREDIT,
    "cash_deposit": CREDIT,
    "owner_capital": CREDIT,
    "supplier_payment": DEBIT,
    "emi": DEBIT,
    "salary": DEBIT,
    "electricity": DEBIT,
    "internet": DEBIT,
    "transport": DEBIT,
    "packaging": DEBIT,
    "repairs": DEBIT,
    "bank_charges": DEBIT,
    "misc_expense": DEBIT,
    "od_interest": DEBIT,
    "gst_payment": DEBIT,
    "owner_drawing": DEBIT,
    "other": None,
}

CATEGORIES = list(SIDE)

# What the categorizer can output (stage 1).
STAGE1_CATEGORIES = [c for c in CATEGORIES if c not in ("collection", "sales_upi")]


def side_of(debit, credit) -> Optional[str]:
    """'debit', 'credit' or None (both empty / zero / unparseable)."""
    def amount(x):
        if x is None or x == "":
            return 0
        try:
            return float(x)
        except (TypeError, ValueError):
            return 0

    d, c = amount(debit), amount(credit)
    if d > 0 and c <= 0:
        return DEBIT
    if c > 0 and d <= 0:
        return CREDIT
    return None


def agrees(category: str, side: Optional[str]) -> bool:
    """True if the category may sit on this side. Unknown side agrees with all."""
    expected = SIDE.get(category)
    return side is None or expected is None or expected == side
