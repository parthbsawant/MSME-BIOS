"""
concentration.py - revenue concentration maths. Pure functions: no database,
no HTTP. api.py loads sale invoice rows and calls build_concentration().

Reads only normalized fields: party_name, invoice_date, total.
Invoices with no usable customer name (blank, walk-in, cash customer,
unknown) are counted in total sales but not ranked as a customer; they are
reported as unattributed_pct.
"""

from collections import defaultdict
from decimal import Decimal
from typing import Dict, Iterable

_ZERO = Decimal("0")
_ANON_MARKERS = ("walk-in", "walk in", "walkin", "cash customer", "counter sale", "unknown")

# Explainable risk rule (shares are % of total sales):
#   high   : top customer >= 25%  or  top 3 customers >= 50%
#   medium : top customer >= 10%  or  top 3 customers >= 30%
#   low    : otherwise
RISK_RULE = {"high": {"top1": 25.0, "top3": 50.0}, "medium": {"top1": 10.0, "top3": 30.0}}


def _dec(value) -> Decimal:
    return Decimal(str(value)) if value is not None else _ZERO


def _f(value: Decimal) -> float:
    return float(round(value, 2))


def is_unattributed(name) -> bool:
    if not name or not str(name).strip():
        return True
    low = str(name).strip().lower()
    return any(m in low for m in _ANON_MARKERS)


def risk_level(top1_pct: float, top3_pct: float) -> str:
    if top1_pct >= RISK_RULE["high"]["top1"] or top3_pct >= RISK_RULE["high"]["top3"]:
        return "high"
    if top1_pct >= RISK_RULE["medium"]["top1"] or top3_pct >= RISK_RULE["medium"]["top3"]:
        return "medium"
    return "low"


def build_concentration(invoices: Iterable[Dict], top_n: int = 10) -> Dict:
    """invoices: dicts with party_name, invoice_date (date), total."""
    per = defaultdict(lambda: {"sales": _ZERO, "n": 0, "first": None, "last": None})
    total = unattributed = _ZERO
    n_invoices = 0
    for inv in invoices:
        amount = _dec(inv.get("total"))
        if amount <= 0:
            continue
        n_invoices += 1
        total += amount
        name = inv.get("party_name")
        if is_unattributed(name):
            unattributed += amount
            continue
        p = per[str(name).strip()]
        p["sales"] += amount
        p["n"] += 1
        d = inv.get("invoice_date")
        if d is not None:
            p["first"] = d if p["first"] is None or d < p["first"] else p["first"]
            p["last"] = d if p["last"] is None or d > p["last"] else p["last"]

    if total <= 0:
        return {"has_data": False, "total_sales": 0.0, "invoice_count": 0, "customer_count": 0,
                "unattributed_pct": 0.0, "top1_pct": 0.0, "top3_pct": 0.0, "top5_pct": 0.0,
                "top10_pct": 0.0, "customers_for_50pct": 0, "customers_for_80pct": 0,
                "risk": "low", "top_customers": []}

    ranked = sorted(per.items(), key=lambda kv: (-kv[1]["sales"], kv[0]))
    pct = lambda v: float(round(v * 100 / total, 2))
    cumulative = _ZERO
    top = []
    need50 = need80 = 0
    for i, (name, v) in enumerate(ranked, 1):
        cumulative += v["sales"]
        if not need50 and cumulative * 100 >= total * 50:
            need50 = i
        if not need80 and cumulative * 100 >= total * 80:
            need80 = i
        if i <= top_n:
            top.append({"rank": i, "customer": name, "sales": _f(v["sales"]),
                        "share_pct": pct(v["sales"]), "cumulative_pct": pct(cumulative),
                        "invoice_count": v["n"],
                        "first_purchase": v["first"].isoformat() if v["first"] else None,
                        "last_purchase": v["last"].isoformat() if v["last"] else None})

    def top_share(k):
        return pct(sum((v["sales"] for _, v in ranked[:k]), _ZERO))

    top1, top3, top5, top10 = top_share(1), top_share(3), top_share(5), top_share(10)
    return {
        "has_data": True,
        "total_sales": _f(total),
        "invoice_count": n_invoices,
        "customer_count": len(ranked),
        "unattributed_pct": pct(unattributed),
        "top1_pct": top1, "top3_pct": top3, "top5_pct": top5, "top10_pct": top10,
        "customers_for_50pct": need50,
        "customers_for_80pct": need80,
        "risk": risk_level(top1, top3),
        "top_customers": top,
    }
