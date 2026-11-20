from datetime import date
import invoice_gen as g
import invoice_pdf as p

BIZ = dict(business_name="A & B <Store>", address="Road 1", phone="+91 90000 00000", gstin="",
           upi_id="x@upi", bank_name="Bank", bank_branch="Main", terms=["E & O.E", "2. a < b"])
HDR = dict(customer_name="R&D <x> Traders", customer_address="Village & Co", customer_gstin="")


def _inv(n=2, **kw):
    lines = [dict(name="Item %d & <co>" % i, hsn="1006", unit="PAC", qty=3, rate="12.5", gst_pct=5) for i in range(n)]
    return g.build_invoice(invoice_date=date(2026, 2, 10), payment_mode=kw.get("mode", "cash"),
                           credit_days=kw.get("days"), lines=lines, seq=1)


def test_returns_pdf_bytes_with_special_characters():
    b = p.render_invoice_pdf(BIZ, HDR, _inv())
    assert b[:5] == b"%PDF-" and len(b) > 2000


def test_max_lines_and_credit_and_no_logo_or_qr():
    assert p.render_invoice_pdf(BIZ, HDR, _inv(40, mode="credit", days=30))[:5] == b"%PDF-"


def test_missing_optional_fields_ok():
    biz = dict(business_name="Shop")
    assert p.render_invoice_pdf(biz, dict(customer_name="C"), _inv())[:5] == b"%PDF-"
