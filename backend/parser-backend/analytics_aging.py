"""
analytics_aging.py – pure‑function implementation of the Aging Report logic.
The module does **not** touch the database; it expects a list of invoice dicts
(e.g. rows fetched from the `invoices` table) and returns bucketed totals.
All monetary values are handled with :class:`decimal.Decimal` to avoid floating‑point errors.
"""

from __future__ import annotations

import datetime as _dt
from collections import defaultdict
from decimal import Decimal
from typing import List, Mapping, Dict, Any

# -----------------------------------------------------------------------
# Helper – bucket name determination
# -----------------------------------------------------------------------

def _bucket_name(days: int) -> str:
    """Return the bucket label for *days* past‑due according to spec.

    * ``days <= 0`` → "Not yet due" (includes today and any future dates)
    * ``1 <= days <= 30`` → "1-30"
    * ``31 <= days <= 60`` → "31-60"
    * ``61 <= days <= 90`` → "61-90"
    * ``days > 90`` → "Over 90"
    """
    if days <= 0:
        return "Not yet due"
    if days <= 30:
        return "1-30"
    if days <= 60:
        return "31-60"
    if days <= 90:
        return "61-90"
    return "Over 90"

# -----------------------------------------------------------------------
# Main public function
# -----------------------------------------------------------------------

def get_aging_report(
    invoices: List[Mapping[str, Any]],
    kind: str,
    as_of: _dt.date,
) -> Dict[str, Any]:
    """Calculate aging buckets for a list of invoice rows.

    Parameters
    ----------
    invoices:
        Iterable of mapping objects representing invoice rows. Expected keys:
        ``amount`` (Decimal or value coercible to Decimal),
        ``due_date`` (date or ``None``),
        ``invoice_date`` (date),
        ``payment_mode`` (str, e.g. "credit"),
        ``paid_at`` (datetime or ``None``),
        ``direction`` ("sale" for receivables, "purchase" for payables),
        ``party`` (str – vendor or customer name – used for party‑wise totals).
    kind:
        Either "receivables" or "payables" – selects the ``direction``
        filter (``sale`` vs ``purchase``).
    as_of:
        The date to calculate days‑past‑due against.

    Returns
    -------
    dict
        ``{"kind": ..., "as_of": ..., "buckets": [...], "party_totals": [...]}``
        where each bucket entry contains ``name``, ``total`` (Decimal), ``count``
        and ``percent`` (Decimal, rounded to two places). ``party_totals`` is a
        flat list of ``{"party": ..., "bucket": ..., "amount": Decimal}``.
    """
    if kind not in {"receivables", "payables"}:
        raise ValueError("kind must be 'receivables' or 'payables'")

    wanted_direction = "sale" if kind == "receivables" else "purchase"

    bucket_totals: Dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    bucket_counts: Dict[str, int] = defaultdict(int)
    raw_party_entries: List[Dict[str, Any]] = []
    overall_total = Decimal("0")

    for inv in invoices:
        # Basic filters – open credit invoices only
        if inv.get("payment_mode") != "credit":
            continue
        if inv.get("paid_at") is not None:
            continue
        if inv.get("direction") != wanted_direction:
            continue

        # Determine the date to compare against: due_date if present else invoice_date
        due = inv.get("due_date") or inv.get("invoice_date")
        if due is None:
            continue
        days_past_due = (as_of - due).days
        bucket = _bucket_name(days_past_due)
        amount = Decimal(str(inv.get("amount", "0")))
        bucket_totals[bucket] += amount
        bucket_counts[bucket] += 1
        overall_total += amount

        party_name = inv.get("party") or inv.get("vendor_name") or "Unknown"
        raw_party_entries.append({"party": party_name, "bucket": bucket, "amount": amount})

    # ---------------------------------------------------------------
    # Aggregate party totals (by party and bucket) and sort descending
    # ---------------------------------------------------------------
    aggregated: Dict[tuple, Decimal] = {}
    for entry in raw_party_entries:
        key = (entry["party"], entry["bucket"])
        aggregated[key] = aggregated.get(key, Decimal("0")) + Decimal(str(entry["amount"]))
    party_totals = [
        {"party": k[0], "bucket": k[1], "amount": float(v)}
        for k, v in aggregated.items()
    ]
    party_totals.sort(key=lambda x: x["amount"], reverse=True)

    # Build bucket list with percentages
    buckets_list = []
    for name in ["Not yet due", "1-30", "31-60", "61-90", "Over 90"]:
        total = bucket_totals.get(name, Decimal("0"))
        count = bucket_counts.get(name, 0)
        percent = (
            total / overall_total * Decimal("100")
        ).quantize(Decimal("0.01")) if overall_total != 0 else Decimal("0")
        buckets_list.append({
            "name": name,
            "total": float(total),
            "percent": float(percent),
            "count": count,
        })

    result: Dict[str, Any] = {
        "kind": kind,
        "as_of": as_of.isoformat(),
        "buckets": buckets_list,
        "party_totals": party_totals,
    }
    return result

# -----------------------------------------------------------------------
# Simple self‑test (executed only when run as ``python analytics_aging.py``)
# -----------------------------------------------------------------------
if __name__ == "__main__":
    sample = [
        {
            "amount": Decimal("100"),
            "due_date": _dt.date(2024, 1, 1),
            "invoice_date": _dt.date(2024, 1, 1),
            "payment_mode": "credit",
            "paid_at": None,
            "direction": "sale",
            "party": "Vendor A",
        }
    ]
    print(get_aging_report(sample, "receivables", _dt.date(2024, 1, 10)))
