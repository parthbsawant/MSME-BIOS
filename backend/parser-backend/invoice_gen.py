"""invoice_gen.py - pure invoice maths for the Invoice Generator feature.

No database, no HTTP, no file access. Takes plain dicts, returns plain dicts.
Python 3.9 compatible. Ported from the standalone invoice engine (gst_utils.py)
with three fixes: Decimal money, input validation, and per-tenant numbering.

Supply is treated as intra-state: GST is split into equal CGST and SGST.
"""
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional, Tuple

ALLOWED_GST = (0, 0.25, 3, 5, 12, 18, 28)
PAYMENT_MODES = ("cash", "upi", "credit")
MAX_LINES = 40
MAX_CREDIT_DAYS = 365
_Q = Decimal("0.01")


def _d(x: Any, field: str) -> Decimal:
    try:
        v = Decimal(str(x))
    except Exception:
        raise ValueError("%s must be a number" % field)
    if not v.is_finite():
        raise ValueError("%s must be a number" % field)
    return v


def _r(v: Decimal) -> Decimal:
    return v.quantize(_Q, rounding=ROUND_HALF_UP)


def validate_lines(lines: Any) -> List[Dict[str, Any]]:
    """Return cleaned lines or raise ValueError with a readable message."""
    if not isinstance(lines, list) or not lines:
        raise ValueError("at least one item is required")
    if len(lines) > MAX_LINES:
        raise ValueError("at most %d items per invoice" % MAX_LINES)
    out = []
    for i, ln in enumerate(lines, 1):
        if not isinstance(ln, dict):
            raise ValueError("item %d must be an object" % i)
        name = str(ln.get("name", "")).strip()
        if not name:
            raise ValueError("item %d needs a name" % i)
        qty = _d(ln.get("qty"), "item %d quantity" % i)
        rate = _d(ln.get("rate"), "item %d rate" % i)
        gst = _d(ln.get("gst_pct", 0), "item %d GST %%" % i)
        if qty <= 0:
            raise ValueError("item %d quantity must be above 0" % i)
        if rate < 0:
            raise ValueError("item %d rate cannot be negative" % i)
        if float(gst) not in ALLOWED_GST:
            raise ValueError("item %d GST must be one of %s" % (i, ", ".join(str(g) for g in ALLOWED_GST)))
        out.append({"name": name[:120], "hsn": str(ln.get("hsn", "") or "").strip()[:12],
                    "unit": str(ln.get("unit", "") or "").strip()[:8] or "NOS",
                    "qty": qty, "rate": rate, "gst_pct": gst})
    return out


def compute_totals(lines: Any) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """Per-line tax and invoice totals. All money is Decimal rounded to paise.
    Returns (enriched_lines, totals). Totals are the sum of the rounded lines,
    so the PDF columns always add up to the printed total."""
    clean = validate_lines(lines)
    enriched, sub, cg, sg = [], Decimal(0), Decimal(0), Decimal(0)
    for ln in clean:
        taxable = _r(ln["qty"] * ln["rate"])
        half = ln["gst_pct"] / 2
        c = _r(taxable * half / 100)
        s = c
        e = dict(ln, taxable_value=taxable, cgst_rate=half, cgst_amount=c,
                 sgst_rate=half, sgst_amount=s, line_total=taxable + c + s)
        enriched.append(e)
        sub += taxable
        cg += c
        sg += s
    grand = sub + cg + sg
    return enriched, {"subtotal": sub, "cgst_total": cg, "sgst_total": sg,
                      "grand_total": grand, "amount_in_words": amount_in_words(grand)}


def amount_in_words(amount: Any) -> str:
    """2003.40 -> 'Rupees Two Thousand Three and 40 Paise Only' (Indian grouping)."""
    a = _r(_d(amount, "amount"))
    if a < 0:
        raise ValueError("amount cannot be negative")
    rupees = int(a)
    paise = int((a - rupees) * 100)
    ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
            "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen",
            "Eighteen", "Nineteen"]
    tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

    def two(x):
        return ones[x] if x < 20 else tens[x // 10] + (" " + ones[x % 10] if x % 10 else "")

    def three(x):
        if x >= 100:
            return ones[x // 100] + " Hundred" + (" " + two(x % 100) if x % 100 else "")
        return two(x)

    if rupees == 0:
        words = "Zero"
    else:
        n, parts = rupees, []
        for size, label in ((10000000, "Crore"), (100000, "Lakh"), (1000, "Thousand")):
            q, n = divmod(n, size)
            if q:
                parts.append(three(q) + " " + label)
        if n:
            parts.append(three(n))
        words = " ".join(parts)
    return "Rupees %s and %d Paise Only" % (words, paise)


def format_invoice_number(seq: int, fy: str, prefix: str = "") -> str:
    """(451, '25-26') -> '00451/25-26'. An optional prefix goes in front."""
    if not isinstance(seq, int) or seq < 1:
        raise ValueError("invoice sequence must be a positive integer")
    return "%s%05d/%s" % (prefix, seq, fy)


def financial_year(d: date) -> str:
    """Indian FY: 1 Apr to 31 Mar. 2026-02-10 -> '25-26'; 2026-04-01 -> '26-27'."""
    y = d.year if d.month >= 4 else d.year - 1
    return "%02d-%02d" % (y % 100, (y + 1) % 100)


def build_invoice(*, invoice_date: date, payment_mode: str, credit_days: Optional[int],
                  lines: Any, seq: int, prefix: str = "") -> Dict[str, Any]:
    """Validate and assemble everything the endpoint stores and the PDF prints.

    due_date is invoice_date + credit_days for credit, else invoice_date.
    paid_at is invoice_date for cash/upi (settled on the spot), None for credit.
    """
    if not isinstance(invoice_date, date):
        raise ValueError("invoice_date must be a date")
    mode = str(payment_mode).strip().lower()
    if mode not in PAYMENT_MODES:
        raise ValueError("payment_mode must be cash, upi or credit")
    days = 0
    if mode == "credit":
        try:
            days = int(credit_days if credit_days is not None else 0)
        except (TypeError, ValueError):
            raise ValueError("credit_days must be a whole number")
        if days < 1 or days > MAX_CREDIT_DAYS:
            raise ValueError("credit_days must be between 1 and %d" % MAX_CREDIT_DAYS)
    enriched, totals = compute_totals(lines)
    if totals["grand_total"] <= 0:
        raise ValueError("invoice total must be above 0")
    due = invoice_date + timedelta(days=days)
    label = "Credit (%d days)" % days if mode == "credit" else mode.upper() if mode == "upi" else "Cash"
    return {"invoice_number": format_invoice_number(seq, financial_year(invoice_date), prefix),
            "invoice_date": invoice_date, "due_date": due, "payment_mode": mode,
            "payment_label": label, "paid_at": invoice_date if mode != "credit" else None,
            "lines": enriched, "totals": totals}
