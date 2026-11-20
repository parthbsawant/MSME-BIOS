"""
enrich_invoice(parsed, raw_text, business_name) -> dict with the five
migration-005 columns: direction, party_name, payment_mode, due_date, paid_at.

  direction     'sale' if the invoice's issuer (vendor_name) is this business,
                else 'purchase'. None if either name is missing.
  party_name    sale: the customer ('Name: ...' under Billing Details).
                purchase: the vendor.
  payment_mode  'cash' | 'upi' | 'credit' from 'Payment Mode :' or 'Settled by:'.
  due_date      credit only: 'Due Date :', else '(Due <date>)', else
                invoice_date + N from 'Credit (N days)'.
  paid_at       invoice_date for cash and UPI; None for credit (reconciliation sets it).

A field that cannot be found is None. This function never raises.
"""

import re
from datetime import date, datetime, timedelta
from typing import Optional

NAME_MATCH_THRESHOLD = 0.8

# Words that do not identify a business ("Sample Store Pvt Ltd" == "Sample Store").
_NAME_NOISE = {"m", "s", "ms", "pvt", "private", "ltd", "limited", "llp", "co", "the", "and"}

_PAYMENT_MODE = re.compile(r"Payment\s*Mode\s*:\s*(Cash|UPI|Credit)\b", re.IGNORECASE)
_SETTLED_BY = re.compile(r"Settled\s*by\s*:\s*(Cash|UPI|Credit)\b", re.IGNORECASE)
_DUE_DATE = re.compile(r"Due\s*Date\s*:\s*(\d{1,2}[-/][A-Za-z0-9]{2,3}[-/]\d{4})", re.IGNORECASE)
_DUE_IN_BRACKETS = re.compile(r"\(\s*Due\s+(\d{1,2}[-/][A-Za-z0-9]{2,3}[-/]\d{4})\s*\)", re.IGNORECASE)
_CREDIT_DAYS = re.compile(r"Credit\s*\(\s*(\d{1,3})\s*days?\s*\)", re.IGNORECASE)
_BILLING = re.compile(r"Billing\s*Details", re.IGNORECASE)
# 'Name: <customer>' runs to the end of the line or to the next right-column label.
_CUSTOMER = re.compile(
    r"^\s*Name\s*:\s*(.+?)\s*(?:\s(?:Invoice\s*(?:Date|Number|No)|Due\s*Date|Payment\s*Mode)\b.*)?$",
    re.IGNORECASE | re.MULTILINE,
)


def _get(parsed, key):
    if parsed is None:
        return None
    if isinstance(parsed, dict):
        return parsed.get(key)
    return getattr(parsed, key, None)


def _tokens(name: Optional[str]) -> set:
    words = re.findall(r"[a-z0-9]+", (name or "").casefold())
    return {w for w in words if w not in _NAME_NOISE}


def name_overlap(a: Optional[str], b: Optional[str]) -> float:
    """Shared tokens / size of the larger token set (0..1), punctuation and case ignored."""
    ta, tb = _tokens(a), _tokens(b)
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / max(len(ta), len(tb))


def _parse_date(raw) -> Optional[date]:
    if raw is None:
        return None
    if isinstance(raw, datetime):
        return raw.date()
    if isinstance(raw, date):
        return raw
    text = str(raw).strip()
    for fmt in ("%d-%b-%Y", "%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d", "%d/%b/%Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def _customer_name(text: str) -> Optional[str]:
    m = _BILLING.search(text)
    section = text[m.end():] if m else text
    found = _CUSTOMER.search(section)
    if not found:
        return None
    name = " ".join(found.group(1).split()).strip(" :|-")
    return name or None


def _payment_mode(text: str) -> Optional[str]:
    m = _PAYMENT_MODE.search(text) or _SETTLED_BY.search(text)
    return m.group(1).lower() if m else None


def _due_date(text: str, invoice_date: Optional[date]) -> Optional[date]:
    for pattern in (_DUE_DATE, _DUE_IN_BRACKETS):
        m = pattern.search(text)
        if m:
            d = _parse_date(m.group(1))
            if d:
                return d
    m = _CREDIT_DAYS.search(text)
    if m and invoice_date:
        return invoice_date + timedelta(days=int(m.group(1)))
    return None


def enrich_invoice(parsed, raw_text: Optional[str], business_name: Optional[str]) -> dict:
    result = {"direction": None, "party_name": None, "payment_mode": None, "due_date": None, "paid_at": None}
    try:
        text = raw_text or ""
        vendor = _get(parsed, "vendor_name")
        invoice_date = _parse_date(_get(parsed, "invoice_date"))

        if vendor and business_name:
            is_sale = name_overlap(vendor, business_name) >= NAME_MATCH_THRESHOLD
            result["direction"] = "sale" if is_sale else "purchase"
            result["party_name"] = _customer_name(text) if is_sale else " ".join(vendor.split())

        mode = _payment_mode(text)
        result["payment_mode"] = mode
        if mode == "credit":
            result["due_date"] = _due_date(text, invoice_date)
        elif mode in ("cash", "upi"):
            result["paid_at"] = invoice_date
    except Exception:
        # Enrichment must never lose an upload: whatever was found so far stays,
        # the rest is None.
        pass
    return result
