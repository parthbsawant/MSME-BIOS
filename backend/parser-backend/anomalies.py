"""
anomalies.py - anomaly detection maths. Pure functions: no database, no HTTP.
Every finding comes from a rule that can be explained in one sentence.

Input rows (bank): txn_date, line_no, description, debit, credit, category,
counterparty. Receivables aging (optional): the output of aging.build_aging()
for sale invoices. Reads only these normalized fields.

Rules
  large_owner_withdrawal  owner_drawing debit >= 25,000  (high at >= 50,000, else medium)
  unusual_expense         a non-routine debit (expense categories, 'other', or
                          uncategorized) >= max(10,000, 5 x the median debit of
                          its category when that category has >= 3 rows)
  duplicate_payment       the same PO number (PO-YYYY-MM-NNNN) appears in two or
                          more supplier-payment debits; the later ones are flagged
  overdue_customer        a customer with >= 10,000 outstanding that is 90+ days
                          overdue (high at >= 25,000, else medium)
"""

import re
from collections import defaultdict
from decimal import Decimal
from statistics import median
from typing import Dict, Iterable, List, Optional

_ZERO = Decimal("0")
OWNER_HIGH = Decimal("50000")
OWNER_MIN = Decimal("25000")
EXPENSE_MIN = Decimal("10000")
EXPENSE_MULTIPLE = Decimal("5")
OVERDUE_MIN = Decimal("10000")
OVERDUE_HIGH = Decimal("25000")
OVERDUE_DAYS = 90
PO_RE = re.compile(r"PO-\d{4}-\d{2}-\d{4}")
NON_ROUTINE_EXCLUDED = {"supplier_payment", "emi", "gst_payment", "owner_drawing", "owner_capital",
                        "customer_receipt", "collection", "sales_upi", "cash_deposit"}
SEVERITY_ORDER = {"high": 0, "medium": 1, "low": 2}
RULES = ("large_owner_withdrawal", "unusual_expense", "duplicate_payment", "overdue_customer")


def _dec(value) -> Decimal:
    return Decimal(str(value)) if value is not None else _ZERO


def _f(value: Decimal) -> float:
    return float(round(value, 2))


def _inr(value: Decimal) -> str:
    n = int(round(value))
    s = str(abs(n))
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        parts = []
        while len(head) > 2:
            parts.insert(0, head[-2:])
            head = head[:-2]
        if head:
            parts.insert(0, head)
        s = ",".join(parts + [tail])
    return ("-" if n < 0 else "") + "Rs " + s


def build_anomalies(bank_rows: Iterable[Dict], receivables: Optional[Dict] = None) -> Dict:
    rows = sorted(bank_rows, key=lambda r: (r["txn_date"], r["line_no"]))
    found: List[Dict] = []

    # category medians for the unusual_expense rule
    by_cat = defaultdict(list)
    for r in rows:
        d = _dec(r.get("debit"))
        if d > 0:
            by_cat[r.get("category") or "uncategorized"].append(d)
    medians = {c: Decimal(str(median(v))) for c, v in by_cat.items() if len(v) >= 3}

    # duplicate PO numbers
    po_seen = defaultdict(list)
    for r in rows:
        d = _dec(r.get("debit"))
        if d > 0 and r.get("category") == "supplier_payment":
            m = PO_RE.search(r.get("description") or "")
            if m:
                po_seen[m.group()].append(r)

    for r in rows:
        debit = _dec(r.get("debit"))
        if debit <= 0:
            continue
        cat = r.get("category") or "uncategorized"
        when = r["txn_date"].isoformat()
        narr = (r.get("description") or "").strip()

        if cat == "owner_drawing" and debit >= OWNER_MIN:
            found.append({
                "rule": "large_owner_withdrawal",
                "severity": "high" if debit >= OWNER_HIGH else "medium",
                "date": when, "amount": _f(debit), "title": "Large owner withdrawal",
                "reason": f"{_inr(debit)} was withdrawn by the owner. Withdrawals of {_inr(OWNER_MIN)} or more are flagged.",
                "reference": narr,
            })
        elif cat not in NON_ROUTINE_EXCLUDED:
            limit = EXPENSE_MIN
            if cat in medians:
                limit = max(limit, medians[cat] * EXPENSE_MULTIPLE)
            if debit >= limit:
                why = ("it is not classified" if cat in ("other", "uncategorized")
                       else f"the usual {cat.replace('_', ' ')} payment is about {_inr(medians[cat])}" if cat in medians
                       else "it is far above a normal expense")
                found.append({
                    "rule": "unusual_expense", "severity": "high" if debit >= 2 * limit else "medium",
                    "date": when, "amount": _f(debit), "title": "Unusually large payment",
                    "reason": f"{_inr(debit)} was paid out and {why}. Payments of {_inr(limit)} or more in this group are flagged.",
                    "reference": narr,
                })

    for po, items in po_seen.items():
        if len(items) < 2:
            continue
        first = items[0]
        for later in items[1:]:
            amt = _dec(later.get("debit"))
            found.append({
                "rule": "duplicate_payment", "severity": "high",
                "date": later["txn_date"].isoformat(), "amount": _f(amt),
                "title": "Purchase order paid twice",
                "reason": (f"{po} was paid on {first['txn_date'].isoformat()} ({_inr(_dec(first.get('debit')))}) "
                           f"and again on {later['txn_date'].isoformat()} ({_inr(amt)})."),
                "reference": (later.get("description") or "").strip(),
            })

    if receivables:
        per = defaultdict(lambda: {"amt": _ZERO, "n": 0, "oldest": 0})
        for inv in receivables.get("invoices", []):
            if inv["days_overdue"] >= OVERDUE_DAYS:
                p = per[inv["party_name"]]
                p["amt"] += _dec(inv["outstanding"])
                p["n"] += 1
                p["oldest"] = max(p["oldest"], inv["days_overdue"])
        for name, p in per.items():
            if p["amt"] >= OVERDUE_MIN:
                found.append({
                    "rule": "overdue_customer",
                    "severity": "high" if p["amt"] >= OVERDUE_HIGH else "medium",
                    "date": receivables.get("as_of"), "amount": _f(p["amt"]),
                    "title": "Customer long overdue",
                    "reason": (f"{name} owes {_inr(p['amt'])} across {p['n']} invoice{'s' if p['n'] != 1 else ''} "
                               f"that are {OVERDUE_DAYS}+ days overdue (oldest {p['oldest']} days)."),
                    "reference": name,
                })

    found.sort(key=lambda a: (SEVERITY_ORDER[a["severity"]], -a["amount"], a["date"] or ""))
    for i, a in enumerate(found, 1):
        a["id"] = i
    by_rule = {r: sum(1 for a in found if a["rule"] == r) for r in RULES}
    by_sev = {s: sum(1 for a in found if a["severity"] == s) for s in SEVERITY_ORDER}
    return {
        "has_data": bool(rows) or bool(receivables and receivables.get("invoices")),
        "total": len(found), "by_rule": by_rule, "by_severity": by_sev,
        "anomalies": found,
    }
