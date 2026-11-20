from datetime import date

from concentration import build_concentration, is_unattributed, risk_level


def inv(party, total, d=date(2025, 4, 1)):
    return {"party_name": party, "invoice_date": d, "total": total}


def test_empty():
    r = build_concentration([])
    assert r["has_data"] is False and r["top_customers"] == [] and r["risk"] == "low"


def test_shares_cumulative_and_ranking():
    rows = [inv("A", 500), inv("A", 100), inv("B", 300), inv("C", 100)]
    r = build_concentration(rows)
    assert r["total_sales"] == 1000 and r["customer_count"] == 3 and r["invoice_count"] == 4
    t = r["top_customers"]
    assert [c["customer"] for c in t] == ["A", "B", "C"]
    assert t[0]["sales"] == 600 and t[0]["share_pct"] == 60.0 and t[0]["invoice_count"] == 2
    assert t[1]["cumulative_pct"] == 90.0 and t[2]["cumulative_pct"] == 100.0
    assert r["top1_pct"] == 60.0 and r["top3_pct"] == 100.0


def test_customers_needed_for_50_and_80_percent():
    rows = [inv("A", 400), inv("B", 300), inv("C", 200), inv("D", 100)]
    r = build_concentration(rows)
    assert r["customers_for_50pct"] == 2 and r["customers_for_80pct"] == 3


def test_walkin_and_blank_are_unattributed_not_ranked():
    rows = [inv("Walk-in Customer", 200), inv(None, 100), inv("  ", 100), inv("A", 600)]
    r = build_concentration(rows)
    assert r["customer_count"] == 1 and r["unattributed_pct"] == 40.0
    assert r["top_customers"][0]["share_pct"] == 60.0     # share of TOTAL sales
    assert is_unattributed("Cash Customer") and not is_unattributed("Chavan Traders")


def test_risk_rule_edges():
    assert risk_level(25, 0) == "high" and risk_level(0, 50) == "high"
    assert risk_level(24.99, 49.99) == "medium"
    assert risk_level(10, 0) == "medium" and risk_level(0, 30) == "medium"
    assert risk_level(9.99, 29.99) == "low"


def test_top_n_limit_and_first_last_dates_and_zero_amounts_ignored():
    rows = [inv(f"C{i}", 100 - i) for i in range(12)]
    rows += [inv("C0", 5, date(2025, 6, 1)), inv("Z", 0), inv("Y", None)]
    r = build_concentration(rows, top_n=3)
    assert len(r["top_customers"]) == 3 and r["customer_count"] == 12
    c0 = r["top_customers"][0]
    assert c0["customer"] == "C0" and c0["first_purchase"] == "2025-04-01" and c0["last_purchase"] == "2025-06-01"
