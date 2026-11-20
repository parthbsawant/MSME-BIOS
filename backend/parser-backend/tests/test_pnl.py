from datetime import date

from pnl import build_pnl


def row(d, cat, debit=None, credit=None):
    return {"txn_date": d, "debit": debit, "credit": credit, "category": cat}


D1, D2, D3 = date(2025, 11, 5), date(2025, 11, 20), date(2025, 12, 3)


def sample():
    return [
        row(D1, "collection", credit=100000), row(D1, "sales_upi", credit=50000),
        row(D2, "cash_deposit", credit=30000), row(D2, "customer_receipt", credit=20000),
        row(D1, "supplier_payment", debit=120000),
        row(D2, "salary", debit=20000), row(D2, "electricity", debit=5000),
        row(D3, "emi", debit=10000), row(D3, "od_interest", debit=1000),
        row(D3, "gst_payment", debit=7000), row(D3, "owner_drawing", debit=50000),
        row(D3, "owner_capital", credit=40000), row(D3, "other", credit=3000),
        row(D3, "other", debit=68000),
    ]


def test_empty():
    assert build_pnl([]) == {"has_data": False}
    assert build_pnl([row(D1, "salary")]) == {"has_data": False}      # no amount


def test_totals_and_margins():
    t = build_pnl(sample())["totals"]
    assert t["revenue"] == 200000 and t["purchases"] == 120000 and t["gross_profit"] == 80000
    assert t["operating_costs"] == 25000 + 68000        # salary + electricity + unclassified 'other'
    assert t["operating_profit"] == 80000 - 93000
    assert t["finance_costs"] == 11000
    assert t["net_profit"] == 80000 - 93000 - 11000
    assert t["gross_margin_pct"] == 40.0 and t["net_margin_pct"] == -12.0


def test_memo_items_are_outside_profit():
    r = build_pnl(sample())
    assert r["memo"] == {"gst_paid": 7000, "owner_drawings": 50000, "owner_capital": 40000, "other_receipts": 3000}
    assert r["unclassified_rows"] == 1
    assert {"category": "unclassified", "amount": 68000.0, "share_pct": 73.12} in r["operating_lines"]


def test_months_add_up_to_totals():
    r = build_pnl(sample())
    assert [m["month"] for m in r["months"]] == ["2025-11", "2025-12"]
    assert round(sum(m["net_profit"] for m in r["months"]), 2) == r["totals"]["net_profit"]
    assert r["months"][0]["revenue"] == 200000 and r["months"][1]["finance_costs"] == 11000


def test_date_filter():
    r = build_pnl(sample(), start=date(2025, 12, 1), end=date(2025, 12, 31))
    assert r["from"] == "2025-12-03" and r["totals"]["revenue"] == 0 and r["totals"]["net_profit"] == -79000
    assert build_pnl(sample(), start=date(2030, 1, 1)) == {"has_data": False}


def test_no_revenue_gives_no_margin_and_unknown_debit_category_is_unclassified():
    r = build_pnl([row(D1, "mystery", debit=500)])
    assert r["totals"]["gross_margin_pct"] is None and r["unclassified_rows"] == 1
    assert r["totals"]["operating_costs"] == 500
