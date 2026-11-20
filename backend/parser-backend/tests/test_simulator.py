import pytest

from simulator import simulate


def cash(balance=100000, in_=100000, out=90000, as_of="2025-12-31", n=3):
    return {"has_data": True, "as_of": as_of, "closing_balance": balance,
            "months": [{"month": f"m{i}", "money_in": in_, "money_out": out, "net": in_ - out,
                        "closing_balance": balance} for i in range(n)]}


def test_no_data():
    assert simulate(None) == {"has_data": False}
    assert simulate({"has_data": False}) == {"has_data": False}


def test_baseline_is_flat_average_and_labels_roll_over_year():
    r = simulate(cash(), months=3)
    assert [m["month"] for m in r["baseline"]] == ["2026-01", "2026-02", "2026-03"]
    assert [m["closing"] for m in r["baseline"]] == [110000, 120000, 130000]
    assert r["baseline_basis"] == {"months_used": 3, "avg_money_in": 100000, "avg_money_out": 90000}
    assert r["scenario"] == r["baseline"] or r["scenario_summary"] == r["baseline_summary"]
    assert r["end_balance_delta"] == 0 and "no changes" in r["headline"]


def test_uses_last_three_months_only():
    c = cash(n=4)
    c["months"][0]["money_out"] = 999999
    assert simulate(c)["baseline_basis"]["avg_money_out"] == 90000


def test_sales_and_expense_changes():
    r = simulate(cash(), months=2, sales_change_pct=-20, expense_change_pct=10)
    # in 80,000, out 99,000 -> net -19,000 a month
    assert [m["closing"] for m in r["scenario"]] == [81000, 62000]
    assert r["end_balance_delta"] == 62000 - 120000
    assert "worse" in r["headline"]


def test_collect_overdue_spread_evenly():
    r = simulate(cash(in_=90000, out=90000), overdue_amount=60000, months=4,
                 collect_overdue_pct=50, collect_over_months=3)
    # 30,000 collected as 10,000 in each of the first 3 months
    assert [m["other"] for m in r["scenario"]] == [10000, 10000, 10000, 0]
    assert r["scenario_summary"]["end_balance"] == 130000 and r["end_balance_delta"] == 30000


def test_one_time_items_and_netting():
    items = [{"month": 2, "amount": -50000, "label": "Fridge"}, {"month": 2, "amount": 20000, "label": "Loan"}]
    r = simulate(cash(in_=90000, out=90000), months=3, one_time=items)
    assert [m["closing"] for m in r["scenario"]] == [100000, 70000, 70000]
    assert r["scenario"][1]["money_in"] == 110000 and r["scenario"][1]["money_out"] == 140000


def test_negative_balance_summary():
    r = simulate(cash(balance=-28539, in_=100000, out=115000), months=3)
    s = r["baseline_summary"]
    assert s["first_negative_month"] == "2026-01" and s["months_negative"] == 3
    assert s["lowest_month"] == "2026-03" and s["lowest_balance"] == -28539 - 45000


@pytest.mark.parametrize("kwargs", [
    {"months": 0}, {"months": 13}, {"sales_change_pct": 51}, {"expense_change_pct": -51},
    {"collect_overdue_pct": 101}, {"collect_over_months": 13}, {"sales_change_pct": "abc"},
    {"one_time": [{"month": 7, "amount": 1}], "months": 6},
    {"one_time": [{"month": 1, "amount": 1}] * 11},
    {"one_time": [{"month": 1, "amount": float("nan")}]},
    {"one_time": "oops"}, {"one_time": ["x"]},
])
def test_bad_input_raises(kwargs):
    with pytest.raises(ValueError):
        simulate(cash(), **kwargs)


def test_collect_months_capped_to_horizon():
    r = simulate(cash(), overdue_amount=3000, months=2, collect_overdue_pct=100, collect_over_months=6)
    assert r["inputs"]["collect_over_months"] == 2
    assert [m["other"] for m in r["scenario"]] == [1500, 1500]
