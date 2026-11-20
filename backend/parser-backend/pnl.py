"""
pnl.py - cash-basis profit and loss statement. Pure functions: no database, no HTTP.

Built only from categorized bank rows (txn_date, debit, credit, category).

Revenue          money received from customers: customer_receipt, collection,
                 sales_upi, cash_deposit (cash sales banked from the till)
Purchases        supplier_payment
Gross profit     revenue - purchases
Operating costs  salary, electricity, internet, transport, packaging, repairs,
                 bank_charges, misc_expense, and any payment that is not
                 classified (shown as 'unclassified', never hidden)
Finance costs    emi (loan instalments), od_interest
Net profit       gross profit - operating costs - finance costs

Shown below the line and NOT part of profit:
  gst_payment (GST remitted), owner_drawing, owner_capital (money the owner
  put in), other_receipts (credits that are not customer money or owner capital).

This is a cash view, not an accrual one: purchases are what was paid to
suppliers, not the cost of goods actually sold, and money in and out includes GST.
"""

from collections import defaultdict
from datetime import date
from decimal import Decimal
from typing import Dict, Iterable, List, Optional

_ZERO = Decimal("0")
REVENUE = ("customer_receipt", "collection", "sales_upi", "cash_deposit")
PURCHASES = ("supplier_payment",)
OPEX = ("salary", "electricity", "internet", "transport", "packaging", "repairs",
        "bank_charges", "misc_expense")
FINANCE = ("emi", "od_interest")
UNCLASSIFIED = "unclassified"


def _dec(v) -> Decimal:
    return Decimal(str(v)) if v is not None else _ZERO


def _f(v: Decimal) -> float:
    return float(round(v, 2))


def _pct(part: Decimal, whole: Decimal) -> Optional[float]:
    return float(round(part * 100 / whole, 2)) if whole else None


def _lines(d: Dict[str, Decimal], total: Decimal) -> List[Dict]:
    ranked = sorted(((k, v) for k, v in d.items() if v), key=lambda kv: (-kv[1], kv[0]))
    return [{"category": k, "amount": _f(v), "share_pct": _pct(v, total)} for k, v in ranked]


def build_pnl(rows: Iterable[Dict], start: Optional[date] = None, end: Optional[date] = None) -> Dict:
    revenue = defaultdict(lambda: _ZERO)
    purchases = defaultdict(lambda: _ZERO)
    opex = defaultdict(lambda: _ZERO)
    finance = defaultdict(lambda: _ZERO)
    memo = {"gst_paid": _ZERO, "owner_drawings": _ZERO, "owner_capital": _ZERO, "other_receipts": _ZERO}
    per_month: Dict[str, Dict[str, Decimal]] = {}
    unclassified_rows = 0
    row_count = 0
    first = last = None

    for r in rows:
        d = r["txn_date"]
        if (start and d < start) or (end and d > end):
            continue
        debit, credit = _dec(r.get("debit")), _dec(r.get("credit"))
        if debit <= 0 and credit <= 0:
            continue
        row_count += 1
        first = d if first is None or d < first else first
        last = d if last is None or d > last else last
        cat = r.get("category") or UNCLASSIFIED
        m = per_month.setdefault(d.strftime("%Y-%m"), defaultdict(lambda: _ZERO))

        if credit > 0:
            if cat in REVENUE:
                revenue[cat] += credit
                m["revenue"] += credit
            elif cat == "owner_capital":
                memo["owner_capital"] += credit
            else:
                memo["other_receipts"] += credit
            continue

        if cat in PURCHASES:
            purchases[cat] += debit
            m["purchases"] += debit
        elif cat in OPEX:
            opex[cat] += debit
            m["opex"] += debit
        elif cat in FINANCE:
            finance[cat] += debit
            m["finance"] += debit
        elif cat == "gst_payment":
            memo["gst_paid"] += debit
        elif cat == "owner_drawing":
            memo["owner_drawings"] += debit
        else:
            opex[UNCLASSIFIED] += debit
            m["opex"] += debit
            unclassified_rows += 1

    if not row_count:
        return {"has_data": False}

    t_rev, t_pur = sum(revenue.values(), _ZERO), sum(purchases.values(), _ZERO)
    t_opx, t_fin = sum(opex.values(), _ZERO), sum(finance.values(), _ZERO)
    gross = t_rev - t_pur
    operating = gross - t_opx
    net = operating - t_fin

    months = []
    for key in sorted(per_month):
        m = per_month[key]
        g = m["revenue"] - m["purchases"]
        o = g - m["opex"]
        months.append({"month": key, "revenue": _f(m["revenue"]), "purchases": _f(m["purchases"]),
                       "gross_profit": _f(g), "operating_costs": _f(m["opex"]),
                       "operating_profit": _f(o), "finance_costs": _f(m["finance"]),
                       "net_profit": _f(o - m["finance"])})

    return {
        "has_data": True,
        "from": first.isoformat(), "to": last.isoformat(), "row_count": row_count,
        "totals": {"revenue": _f(t_rev), "purchases": _f(t_pur), "gross_profit": _f(gross),
                   "operating_costs": _f(t_opx), "operating_profit": _f(operating),
                   "finance_costs": _f(t_fin), "net_profit": _f(net),
                   "gross_margin_pct": _pct(gross, t_rev), "net_margin_pct": _pct(net, t_rev)},
        "revenue_lines": _lines(revenue, t_rev),
        "purchase_lines": _lines(purchases, t_pur),
        "operating_lines": _lines(opex, t_opx),
        "finance_lines": _lines(finance, t_fin),
        "memo": {k: _f(v) for k, v in memo.items()},
        "unclassified_rows": unclassified_rows,
        "months": months,
    }
