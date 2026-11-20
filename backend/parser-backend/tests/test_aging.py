from datetime import date

from aging import bucket_for, build_aging, build_supplier_paid

AS_OF = date(2025, 12, 31)


def inv(num, party, inv_date, due, total, paid=0, possible=0):
    return {"party_name": party, "invoice_number": num, "invoice_date": inv_date,
            "due_date": due, "total": total, "paid": paid, "possible": possible}


def test_bucket_edges():
    assert bucket_for(-5) == "current" and bucket_for(0) == "current"
    assert [bucket_for(d) for d in (1, 30, 31, 60, 61, 90, 91)] == \
        ["1-30", "1-30", "31-60", "31-60", "61-90", "61-90", "90+"]


def test_outstanding_and_settled_invoices_left_out():
    rows = [
        inv("A", "Ravi", date(2025, 12, 1), date(2025, 12, 20), 1000, 400),
        inv("B", "Ravi", date(2025, 11, 1), date(2025, 11, 20), 500, 500),        # fully paid
        inv("C", "Sita", date(2025, 11, 1), date(2025, 11, 20), 500, 499.5),      # within Rs 1
    ]
    r = build_aging(rows, AS_OF)
    assert r["invoice_count"] == 1 and r["total_outstanding"] == 600
    assert r["invoices"][0]["invoice_number"] == "A"
    assert r["invoices"][0]["days_overdue"] == 11 and r["invoices"][0]["bucket"] == "1-30"


def test_bucket_totals_add_up_and_all_buckets_present():
    rows = [
        inv("1", "P1", date(2025, 12, 20), date(2026, 1, 5), 100),    # not due -> current
        inv("2", "P2", date(2025, 12, 1), date(2025, 12, 15), 200),   # 16 days
        inv("3", "P3", date(2025, 10, 1), date(2025, 10, 31), 300),   # 61 days
        inv("4", "P4", date(2025, 6, 1), date(2025, 6, 30), 400),     # 184 days
    ]
    r = build_aging(rows, AS_OF)
    amounts = {b["bucket"]: b["amount"] for b in r["buckets"]}
    assert [b["bucket"] for b in r["buckets"]] == ["current", "1-30", "31-60", "61-90", "90+"]
    assert amounts == {"current": 100, "1-30": 200, "31-60": 0, "61-90": 300, "90+": 400}
    assert sum(amounts.values()) == r["total_outstanding"] == 1000
    assert r["overdue_amount"] == 900
    assert r["invoices"][0]["invoice_number"] == "4"   # oldest first


def test_missing_due_date_uses_invoice_date_and_unknown_party():
    r = build_aging([inv("X", None, date(2025, 12, 1), None, 100)], AS_OF)
    row = r["invoices"][0]
    assert row["party_name"] == "Unknown party" and row["days_overdue"] == 30


def test_top_parties_group_and_share():
    rows = [
        inv("1", "Ravi", date(2025, 12, 1), date(2025, 12, 10), 600),
        inv("2", "Ravi", date(2025, 11, 1), date(2025, 11, 10), 200),
        inv("3", "Sita", date(2025, 12, 1), date(2025, 12, 10), 200),
    ]
    r = build_aging(rows, AS_OF, top_n=1)
    assert r["party_count"] == 2 and len(r["top_parties"]) == 1
    top = r["top_parties"][0]
    assert top["party_name"] == "Ravi" and top["outstanding"] == 800
    assert top["invoice_count"] == 2 and top["share_pct"] == 80.0
    assert top["oldest_days_overdue"] == 51


def test_possible_flag_and_empty():
    r = build_aging([inv("1", "Ravi", date(2025, 12, 1), date(2025, 12, 10), 100, 0, possible=1)], AS_OF)
    assert r["invoices"][0]["has_possible_payment"] is True
    e = build_aging([], AS_OF)
    assert e["invoice_count"] == 0 and e["total_outstanding"] == 0 and len(e["buckets"]) == 5


def test_supplier_paid():
    rows = [
        {"txn_date": date(2025, 4, 1), "debit": 300, "category": "supplier_payment", "counterparty": "Agro Ltd"},
        {"txn_date": date(2025, 5, 1), "debit": 100, "category": "supplier_payment", "counterparty": "Agro Ltd"},
        {"txn_date": date(2025, 5, 2), "debit": 100, "category": "supplier_payment", "counterparty": None},
        {"txn_date": date(2025, 5, 3), "debit": 999, "category": "salary", "counterparty": "X"},
        {"txn_date": date(2025, 5, 4), "debit": None, "category": "supplier_payment", "counterparty": "Y"},
    ]
    r = build_supplier_paid(rows)
    assert r["total_paid"] == 500 and r["supplier_count"] == 2
    assert r["top_suppliers"][0]["supplier"] == "Agro Ltd"
    assert r["top_suppliers"][0]["payments"] == 2 and r["top_suppliers"][0]["last_payment"] == "2025-05-01"
    assert r["top_suppliers"][1]["supplier"] == "Unknown supplier"
