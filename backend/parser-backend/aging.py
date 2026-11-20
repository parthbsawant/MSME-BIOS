"""
aging.py - receivables / payables aging maths. Pure functions: no database,
no HTTP. api.py loads invoice rows (with the amount already paid, taken from
invoice_payments) and calls build_aging().

Reads only normalized fields: party_name, invoice_number, invoice_date,
due_date, total, paid, possible (count of unconfirmed links).
"""

from collections import defaultdict
from datetime import date
from decimal import Decimal
from typing import Dict, Iterable, List, Optional

_ZERO = Decimal("0")
SETTLED_TOLERANCE = Decimal("1.00")  # reconciliation treats within Rs 1 as paid
BUCKETS = ("current", "1-30", "31-60", "61-90", "90+")
UNKNOWN_PARTY = "Unknown party"
UNKNOWN_SUPPLIER = "Unknown supplier"


def _dec(value) -> Decimal:
    return Decimal(str(value)) if value is not None else _ZERO


def _f(value: Decimal) -> float:
    return float(round(value, 2))


def bucket_for(days_overdue: int) -> str:
    """days_overdue <= 0 means not yet due."""
    if days_overdue <= 0:
        return "current"
    if days_overdue <= 30:
        return "1-30"
    if days_overdue <= 60:
        return "31-60"
    if days_overdue <= 90:
        return "61-90"
    return "90+"


def build_aging(invoices: Iterable[Dict], as_of: date, top_n: int = 5) -> Dict:
    """
    invoices: dicts with party_name, invoice_number, invoice_date (date),
    due_date (date or None), total, paid (number or None), possible (int or None).
    as_of: the reference date for "days overdue".
    A missing due_date falls back to the invoice date. Fully paid invoices
    (outstanding within Rs 1) are left out.
    """
    items: List[Dict] = []
    for inv in invoices:
        total, paid = _dec(inv.get("total")), _dec(inv.get("paid"))
        outstanding = total - paid
        if outstanding <= SETTLED_TOLERANCE:
            continue
        due = inv.get("due_date") or inv.get("invoice_date")
        days = max((as_of - due).days, 0) if due else 0
        if due and (as_of - due).days <= 0:
            days = 0
        items.append({
            "party_name": inv.get("party_name") or UNKNOWN_PARTY,
            "invoice_number": inv.get("invoice_number"),
            "invoice_date": inv["invoice_date"].isoformat() if inv.get("invoice_date") else None,
            "due_date": due.isoformat() if due else None,
            "total": _f(total), "paid": _f(paid), "outstanding": _f(outstanding),
            "days_overdue": days,
            "bucket": bucket_for(days),
            "has_possible_payment": bool(inv.get("possible")),
            "_out": outstanding,
        })

    items.sort(key=lambda i: (-i["days_overdue"], -i["_out"], i["invoice_number"] or ""))

    total_out = sum((i["_out"] for i in items), _ZERO)
    b_amount = {b: _ZERO for b in BUCKETS}
    b_count = {b: 0 for b in BUCKETS}
    parties = defaultdict(lambda: {"out": _ZERO, "n": 0, "oldest": 0})
    for i in items:
        b_amount[i["bucket"]] += i["_out"]
        b_count[i["bucket"]] += 1
        p = parties[i["party_name"]]
        p["out"] += i["_out"]
        p["n"] += 1
        p["oldest"] = max(p["oldest"], i["days_overdue"])

    ranked = sorted(parties.items(), key=lambda kv: (-kv[1]["out"], kv[0]))
    top_parties = [{
        "party_name": name, "outstanding": _f(v["out"]), "invoice_count": v["n"],
        "oldest_days_overdue": v["oldest"],
        "share_pct": _f(v["out"] * 100 / total_out) if total_out else 0.0,
    } for name, v in ranked[:top_n]]

    overdue = sum((i["_out"] for i in items if i["days_overdue"] > 0), _ZERO)
    for i in items:
        del i["_out"]

    return {
        "as_of": as_of.isoformat(),
        "total_outstanding": _f(total_out),
        "invoice_count": len(items),
        "party_count": len(parties),
        "overdue_amount": _f(overdue),
        "buckets": [{"bucket": b, "amount": _f(b_amount[b]), "count": b_count[b],
                     "share_pct": _f(b_amount[b] * 100 / total_out) if total_out else 0.0}
                    for b in BUCKETS],
        "top_parties": top_parties,
        "invoices": items,
    }


def build_supplier_paid(rows: Iterable[Dict], top_n: int = 10) -> Dict:
    """
    What the business paid its suppliers, from categorized bank rows
    (category == 'supplier_payment'). rows: txn_date, debit, category, counterparty.
    """
    per = defaultdict(lambda: {"amount": _ZERO, "n": 0, "last": None})
    total = _ZERO
    for r in rows:
        if r.get("category") != "supplier_payment":
            continue
        debit = _dec(r.get("debit"))
        if debit <= 0:
            continue
        p = per[r.get("counterparty") or UNKNOWN_SUPPLIER]
        p["amount"] += debit
        p["n"] += 1
        if p["last"] is None or r["txn_date"] > p["last"]:
            p["last"] = r["txn_date"]
        total += debit
    ranked = sorted(per.items(), key=lambda kv: (-kv[1]["amount"], kv[0]))
    return {
        "total_paid": _f(total),
        "supplier_count": len(per),
        "top_suppliers": [{
            "supplier": name, "amount": _f(v["amount"]), "payments": v["n"],
            "last_payment": v["last"].isoformat() if v["last"] else None,
            "share_pct": _f(v["amount"] * 100 / total) if total else 0.0,
        } for name, v in ranked[:top_n]],
    }
