from datetime import date

from cash_summary import build_cash_summary


def row(d, line, debit=None, credit=None, balance=None, category=None):
    return {"txn_date": d, "line_no": line, "debit": debit, "credit": credit,
            "balance": balance, "category": category}


def test_empty():
    s = build_cash_summary([])
    assert s["has_data"] is False
    assert s["months"] == [] and s["closing_balance"] == 0.0


def test_totals_months_and_closing_balance():
    rows = [
        row(date(2025, 4, 2), 1, credit=1000, balance=1000, category="customer_receipt"),
        row(date(2025, 4, 5), 2, debit=400, balance=600, category="supplier_payment"),
        row(date(2025, 5, 1), 1, debit=700, balance=-100, category="salary"),
        row(date(2025, 5, 3), 2, credit=300, balance=200, category="customer_receipt"),
    ]
    s = build_cash_summary(rows)
    assert s["money_in"] == 1300 and s["money_out"] == 1100 and s["net"] == 200
    assert s["closing_balance"] == 200 and s["as_of"] == "2025-05-03"
    assert s["lowest_balance"] == -100 and s["lowest_balance_date"] == "2025-05-01"
    assert [m["month"] for m in s["months"]] == ["2025-04", "2025-05"]
    assert s["months"][0]["closing_balance"] == 600 and s["months"][1]["net"] == -400


def test_order_is_by_date_then_line_not_input_order():
    rows = [
        row(date(2025, 4, 5), 2, debit=400, balance=600),
        row(date(2025, 4, 2), 1, credit=1000, balance=1000),
    ]
    assert build_cash_summary(rows)["closing_balance"] == 600


def test_category_breakdown_shares_and_uncategorized():
    rows = [
        row(date(2025, 4, 1), 1, debit=300, balance=1, category="supplier_payment"),
        row(date(2025, 4, 2), 2, debit=100, balance=1, category="salary"),
        row(date(2025, 4, 3), 3, debit=100, balance=1),
    ]
    s = build_cash_summary(rows)
    out = {c["category"]: c for c in s["out_by_category"]}
    assert out["supplier_payment"]["share_pct"] == 60.0
    assert out["uncategorized"]["amount"] == 100 and s["uncategorized_rows"] == 1
    assert s["out_by_category"][0]["category"] == "supplier_payment"


def test_owner_money_is_split_out():
    rows = [
        row(date(2025, 9, 30), 1, credit=120000, balance=1, category="owner_capital"),
        row(date(2025, 11, 10), 2, debit=50000, balance=1, category="owner_drawing"),
    ]
    s = build_cash_summary(rows)
    assert s["owner_capital_in"] == 120000 and s["owner_drawings_out"] == 50000
