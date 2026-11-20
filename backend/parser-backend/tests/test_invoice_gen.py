from datetime import date
from decimal import Decimal
import pytest
import invoice_gen as g

L = lambda **k: dict(dict(name="Rice 1kg", hsn="1006", unit="PAC", qty=10, rate=75, gst_pct=0), **k)


def test_totals_match_old_engine_sample():
    _, t = g.compute_totals([L(), L(name="Biscuits", hsn="1905", qty=12, rate=20, gst_pct=18)])
    assert t["subtotal"] == Decimal("990.00") and t["cgst_total"] == Decimal("21.60")
    assert t["sgst_total"] == Decimal("21.60") and t["grand_total"] == Decimal("1033.20")
    assert t["amount_in_words"] == "Rupees One Thousand Thirty Three and 20 Paise Only"


def test_rounding_half_up_and_columns_add_up():
    en, t = g.compute_totals([L(qty=3, rate="33.33", gst_pct=5), L(qty=7, rate="12.5", gst_pct=12)])
    assert sum(e["line_total"] for e in en) == t["grand_total"]
    assert t["grand_total"] == t["subtotal"] + t["cgst_total"] + t["sgst_total"]
    assert en[0]["taxable_value"] == Decimal("99.99")
    assert en[0]["cgst_amount"] == Decimal("2.50")  # 99.99*2.5% = 2.49975 -> 2.50


def test_words():
    assert g.amount_in_words(0) == "Rupees Zero and 0 Paise Only"
    assert g.amount_in_words("2003.40") == "Rupees Two Thousand Three and 40 Paise Only"
    assert g.amount_in_words(125000.05) == "Rupees One Lakh Twenty Five Thousand and 5 Paise Only"
    assert g.amount_in_words(10000000) == "Rupees One Crore and 0 Paise Only"
    with pytest.raises(ValueError):
        g.amount_in_words(-1)


@pytest.mark.parametrize("bad", [None, [], "x", [1], [L(name=" ")], [L(qty=0)], [L(qty="abc")],
                                 [L(rate=-1)], [L(gst_pct=7)], [L(qty="nan")], [L(rate="inf")],
                                 [L()] * 41])
def test_bad_lines_rejected(bad):
    with pytest.raises(ValueError):
        g.compute_totals(bad)


def test_fy_and_number():
    assert g.financial_year(date(2026, 3, 31)) == "25-26"
    assert g.financial_year(date(2026, 4, 1)) == "26-27"
    assert g.financial_year(date(2025, 12, 31)) == "25-26"
    assert g.format_invoice_number(451, "25-26") == "00451/25-26"
    assert g.format_invoice_number(7, "26-27", "INV-") == "INV-00007/26-27"
    for bad in (0, -1, "3", None):
        with pytest.raises(ValueError):
            g.format_invoice_number(bad, "25-26")


def test_build_credit_cash_upi():
    c = g.build_invoice(invoice_date=date(2026, 2, 10), payment_mode="credit", credit_days=7, lines=[L()], seq=5)
    assert c["invoice_number"] == "00005/25-26" and c["due_date"] == date(2026, 2, 17)
    assert c["paid_at"] is None and c["payment_label"] == "Credit (7 days)"
    k = g.build_invoice(invoice_date=date(2026, 2, 10), payment_mode="Cash", credit_days=99, lines=[L()], seq=6)
    assert k["due_date"] == date(2026, 2, 10) and k["paid_at"] == date(2026, 2, 10) and k["payment_label"] == "Cash"
    u = g.build_invoice(invoice_date=date(2026, 2, 10), payment_mode="upi", credit_days=None, lines=[L()], seq=7)
    assert u["payment_label"] == "UPI"


@pytest.mark.parametrize("kw", [dict(payment_mode="cheque"), dict(payment_mode="credit", credit_days=0),
                                dict(payment_mode="credit", credit_days=366), dict(payment_mode="credit", credit_days="x"),
                                dict(payment_mode="credit", credit_days=None), dict(lines=[L(rate=0)])])
def test_build_rejects(kw):
    base = dict(invoice_date=date(2026, 2, 10), payment_mode="cash", credit_days=None, lines=[L()], seq=1)
    base.update(kw)
    with pytest.raises(ValueError):
        g.build_invoice(**base)
    with pytest.raises(ValueError):
        g.build_invoice(**dict(base, invoice_date="2026-02-10", payment_mode="cash", lines=[L()]))
