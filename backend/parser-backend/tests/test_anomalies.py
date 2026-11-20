from datetime import date

from anomalies import build_anomalies


def row(d, line, desc="X", debit=None, credit=None, cat=None):
    return {"txn_date": d, "line_no": line, "description": desc, "debit": debit, "credit": credit,
            "category": cat, "counterparty": None}


def rules(res):
    return [(a["rule"], a["amount"], a["severity"]) for a in res["anomalies"]]


def test_empty():
    r = build_anomalies([])
    assert r["total"] == 0 and r["has_data"] is False


def test_owner_withdrawal_thresholds():
    rows = [row(date(2025, 11, 10), 1, "ATM CASH WDL SELF", 50000, cat="owner_drawing"),
            row(date(2025, 11, 11), 2, "ATM", 30000, cat="owner_drawing"),
            row(date(2025, 11, 12), 3, "ATM", 24999, cat="owner_drawing")]
    assert rules(build_anomalies(rows)) == [("large_owner_withdrawal", 50000, "high"),
                                            ("large_owner_withdrawal", 30000, "medium")]


def test_unclassified_large_debit_is_flagged():
    rows = [row(date(2026, 1, 22), 1, "NEFT DR SHINDE AUTO WORKS TEMPO ENGINE OVERHAUL", 68000, cat="other")]
    r = build_anomalies(rows)
    a = r["anomalies"][0]
    assert a["rule"] == "unusual_expense" and a["amount"] == 68000 and "not classified" in a["reason"]
    assert a["reference"].startswith("NEFT DR SHINDE")


def test_expense_uses_category_median_and_ignores_normal_and_routine_categories():
    rows = [row(date(2025, m, 5), 1, "R", 900 + m, cat="repairs") for m in (4, 5, 6)]
    rows.append(row(date(2025, 7, 5), 1, "R", 12000, cat="repairs"))       # >= 10,000 and >= 5 x median
    rows.append(row(date(2025, 8, 5), 1, "R", 8000, cat="repairs"))        # below 10,000 floor
    rows.append(row(date(2025, 8, 6), 2, "SUP", 400000, cat="supplier_payment"))   # excluded category
    rows.append(row(date(2025, 8, 7), 3, "EMI", 90000, cat="emi"))                 # excluded category
    r = build_anomalies(rows)
    assert [(x["rule"], x["amount"]) for x in r["anomalies"]] == [("unusual_expense", 12000)]


def test_duplicate_po_flags_later_payment_only():
    rows = [row(date(2025, 8, 26), 1, "NEFT DR PO-2025-08-0023 TASGAON PULSES", 8249.82, cat="supplier_payment"),
            row(date(2025, 8, 29), 2, "NEFT DR PO-2025-08-0023 TASGAON PULSES", 8249.82, cat="supplier_payment"),
            row(date(2025, 8, 30), 3, "NEFT DR PO-2025-08-0024 OTHER", 100, cat="supplier_payment")]
    r = build_anomalies(rows)
    assert len(r["anomalies"]) == 1
    a = r["anomalies"][0]
    assert a["rule"] == "duplicate_payment" and a["date"] == "2025-08-29" and "PO-2025-08-0023" in a["reason"]


def test_overdue_customers_need_90_days_and_10000():
    rec = {"as_of": "2025-12-31", "invoices": [
        {"party_name": "Ravi", "outstanding": 15000, "days_overdue": 120},
        {"party_name": "Ravi", "outstanding": 15000, "days_overdue": 95},          # Ravi total 30,000 -> high
        {"party_name": "Sita", "outstanding": 12000, "days_overdue": 100},         # medium
        {"party_name": "Gita", "outstanding": 50000, "days_overdue": 60},          # not 90 days
        {"party_name": "Mohan", "outstanding": 9000, "days_overdue": 200}]}        # below 10,000
    r = build_anomalies([], rec)
    assert [(a["reference"], a["severity"], a["amount"]) for a in r["anomalies"]] == \
        [("Ravi", "high", 30000), ("Sita", "medium", 12000)]
    assert r["has_data"] is True


def test_sorting_and_counts():
    rows = [row(date(2025, 11, 10), 1, "ATM", 50000, cat="owner_drawing"),
            row(date(2026, 1, 22), 2, "REPAIR", 15000, cat="other")]
    r = build_anomalies(rows)
    assert r["total"] == 2 and r["by_severity"]["high"] >= 1
    assert r["anomalies"][0]["severity"] == "high" and [a["id"] for a in r["anomalies"]] == [1, 2]
    assert set(r["by_rule"]) == {"large_owner_withdrawal", "unusual_expense", "duplicate_payment", "overdue_customer"}
