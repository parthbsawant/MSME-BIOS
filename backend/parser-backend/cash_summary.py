"""
cash_summary.py - the cash dashboard maths. Pure functions: no database, no
HTTP. api.py loads the tenant's bank rows and calls build_cash_summary().

Reads only normalized bank columns: txn_date, line_no, debit, credit,
balance, category. Amounts come back as floats rounded to 2 places.
"""

from collections import defaultdict
from datetime import date
from decimal import Decimal
from typing import Dict, Iterable, List, Optional

_ZERO = Decimal("0")
UNCATEGORIZED = "uncategorized"


def _dec(value) -> Decimal:
    return Decimal(str(value)) if value is not None else _ZERO


def _f(value: Decimal) -> float:
    return float(round(value, 2))


def _month(d: date) -> str:
    return f"{d.year:04d}-{d.month:02d}"


def build_cash_summary(rows: Iterable[Dict]) -> Dict:
    """
    rows: dicts with txn_date (date), line_no (int), debit, credit, balance
    (numbers or None) and category (str or None), any order.
    """
    ordered = sorted(rows, key=lambda r: (r["txn_date"], r["line_no"]))
    if not ordered:
        return {
            "has_data": False, "as_of": None, "closing_balance": 0.0,
            "lowest_balance": None, "lowest_balance_date": None,
            "money_in": 0.0, "money_out": 0.0, "net": 0.0,
            "owner_capital_in": 0.0, "owner_drawings_out": 0.0,
            "months": [], "in_by_category": [], "out_by_category": [],
            "uncategorized_rows": 0, "row_count": 0,
        }

    money_in = money_out = _ZERO
    in_cat = defaultdict(lambda: _ZERO)
    out_cat = defaultdict(lambda: _ZERO)
    per_month = {}
    lowest = None
    lowest_date = None
    uncategorized = 0

    for r in ordered:
        debit, credit = _dec(r.get("debit")), _dec(r.get("credit"))
        cat = r.get("category") or UNCATEGORIZED
        if cat == UNCATEGORIZED:
            uncategorized += 1
        m = per_month.setdefault(_month(r["txn_date"]), {"in": _ZERO, "out": _ZERO, "closing": None})
        if credit:
            money_in += credit
            in_cat[cat] += credit
            m["in"] += credit
        if debit:
            money_out += debit
            out_cat[cat] += debit
            m["out"] += debit
        if r.get("balance") is not None:
            bal = _dec(r["balance"])
            m["closing"] = bal
            if lowest is None or bal < lowest:
                lowest, lowest_date = bal, r["txn_date"]

    last = ordered[-1]
    closing = _dec(last["balance"]) if last.get("balance") is not None else money_in - money_out

    months: List[Dict] = []
    for key in sorted(per_month):
        m = per_month[key]
        months.append({
            "month": key, "money_in": _f(m["in"]), "money_out": _f(m["out"]),
            "net": _f(m["in"] - m["out"]),
            "closing_balance": _f(m["closing"]) if m["closing"] is not None else None,
        })

    def ranked(d: Dict[str, Decimal]) -> List[Dict]:
        total = sum(d.values(), _ZERO)
        items = sorted(d.items(), key=lambda kv: kv[1], reverse=True)
        return [{"category": k, "amount": _f(v),
                 "share_pct": _f(v * 100 / total) if total else 0.0} for k, v in items]

    return {
        "has_data": True,
        "as_of": last["txn_date"].isoformat(),
        "closing_balance": _f(closing),
        "lowest_balance": _f(lowest) if lowest is not None else None,
        "lowest_balance_date": lowest_date.isoformat() if lowest_date else None,
        "money_in": _f(money_in), "money_out": _f(money_out), "net": _f(money_in - money_out),
        "owner_capital_in": _f(in_cat.get("owner_capital", _ZERO)),
        "owner_drawings_out": _f(out_cat.get("owner_drawing", _ZERO)),
        "months": months,
        "in_by_category": ranked(in_cat),
        "out_by_category": ranked(out_cat),
        "uncategorized_rows": uncategorized,
        "row_count": len(ordered),
    }
