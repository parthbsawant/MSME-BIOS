"""
simulator.py - cash flow what-if simulator. Pure functions: no database, no HTTP.

Takes the cash summary (build_cash_summary output) and the overdue receivables
amount, builds a baseline forecast from the last 3 months, and applies the
owner's what-if changes on top.

Baseline  = the average monthly money in and money out of the last 3 months
            (all of it, as the bank statement shows), repeated for the next N months.
Scenario  = baseline with these changes:
              sales_change_pct     change in money in, -50 to +50 (%)
              expense_change_pct   change in money out, -50 to +50 (%)
              collect_overdue_pct  share of today's overdue customer dues that
                                   is collected, 0 to 100 (%), spread evenly over
                                   collect_over_months (1 to 12, capped at months)
              one_time             up to 10 items {month 1..N, amount, label};
                                   amount > 0 is money in, amount < 0 is money out
Nothing is stored and nothing is guessed: it is arithmetic on real history.
"""

from typing import Dict, List, Optional

MAX_MONTHS = 12
MAX_PCT = 50.0
MAX_ONE_TIME = 10
MAX_AMOUNT = 100000000.0


def _inr(value: float) -> str:
    n = int(round(value))
    s = str(abs(n))
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        parts = []
        while len(head) > 2:
            parts.insert(0, head[-2:])
            head = head[:-2]
        if head:
            parts.insert(0, head)
        s = ",".join(parts + [tail])
    return ("-" if n < 0 else "") + "Rs " + s


def _month_labels(as_of_iso: str, count: int) -> List[str]:
    year, month = int(as_of_iso[:4]), int(as_of_iso[5:7])
    labels = []
    for _ in range(count):
        month += 1
        if month > 12:
            month, year = 1, year + 1
        labels.append(f"{year:04d}-{month:02d}")
    return labels


def _num(value, name: str, lo: float, hi: float) -> float:
    try:
        v = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"{name} must be a number")
    if v != v or v < lo or v > hi:
        raise ValueError(f"{name} must be between {lo:g} and {hi:g}")
    return v


def _summary(rows: List[Dict], opening: float) -> Dict:
    lowest = min(rows, key=lambda r: r["closing"])
    first_neg = next((r["month"] for r in rows if r["closing"] < 0), None)
    return {
        "end_balance": rows[-1]["closing"],
        "lowest_balance": lowest["closing"], "lowest_month": lowest["month"],
        "months_negative": sum(1 for r in rows if r["closing"] < 0),
        "first_negative_month": first_neg,
        "opening_balance": round(opening, 2),
    }


def simulate(cash: Optional[Dict], overdue_amount: float = 0.0, months: int = 6,
             sales_change_pct: float = 0.0, expense_change_pct: float = 0.0,
             collect_overdue_pct: float = 0.0, collect_over_months: int = 3,
             one_time: Optional[List[Dict]] = None) -> Dict:
    months = int(_num(months, "months", 1, MAX_MONTHS))
    sales_pct = _num(sales_change_pct, "sales_change_pct", -MAX_PCT, MAX_PCT)
    exp_pct = _num(expense_change_pct, "expense_change_pct", -MAX_PCT, MAX_PCT)
    collect_pct = _num(collect_overdue_pct, "collect_overdue_pct", 0, 100)
    collect_n = min(int(_num(collect_over_months, "collect_over_months", 1, MAX_MONTHS)), months)
    if one_time is not None and not isinstance(one_time, list):
        raise ValueError("one_time must be a list")
    items = list(one_time or [])
    if len(items) > MAX_ONE_TIME:
        raise ValueError(f"one_time can have at most {MAX_ONE_TIME} items")
    clean = []
    for it in items:
        if not isinstance(it, dict):
            raise ValueError("each one_time item must be an object")
        clean.append({
            "month": int(_num(it.get("month"), "one_time month", 1, months)),
            "amount": _num(it.get("amount"), "one_time amount", -MAX_AMOUNT, MAX_AMOUNT),
            "label": str(it.get("label") or "")[:60],
        })

    if not cash or not cash.get("has_data") or not cash.get("months"):
        return {"has_data": False}

    recent = cash["months"][-3:]
    base_in = sum(m["money_in"] for m in recent) / len(recent)
    base_out = sum(m["money_out"] for m in recent) / len(recent)
    opening = float(cash["closing_balance"])
    labels = _month_labels(cash["as_of"], months)
    collect_total = max(0.0, float(overdue_amount or 0)) * collect_pct / 100.0

    baseline, scenario = [], []
    b_bal = s_bal = opening
    for i, label in enumerate(labels, 1):
        b_net = base_in - base_out
        b_bal += b_net
        baseline.append({"month": label, "money_in": round(base_in, 2), "money_out": round(base_out, 2),
                         "other": 0.0, "net": round(b_net, 2), "closing": round(b_bal, 2)})

        s_in = base_in * (1 + sales_pct / 100.0)
        s_out = base_out * (1 + exp_pct / 100.0)
        collected = collect_total / collect_n if i <= collect_n else 0.0
        one_in = sum(x["amount"] for x in clean if x["month"] == i and x["amount"] > 0)
        one_out = -sum(x["amount"] for x in clean if x["month"] == i and x["amount"] < 0)
        s_net = s_in + collected + one_in - s_out - one_out
        s_bal += s_net
        scenario.append({"month": label, "money_in": round(s_in + collected + one_in, 2),
                         "money_out": round(s_out + one_out, 2),
                         "other": round(collected + one_in - one_out, 2),
                         "net": round(s_net, 2), "closing": round(s_bal, 2)})

    b_sum, s_sum = _summary(baseline, opening), _summary(scenario, opening)
    delta = round(s_sum["end_balance"] - b_sum["end_balance"], 2)
    if abs(delta) < 0.5:
        headline = (f"With no changes the balance after {months} months is {_inr(b_sum['end_balance'])}.")
    else:
        headline = (f"After {months} months the balance would be {_inr(s_sum['end_balance'])}, "
                    f"{_inr(abs(delta))} {'better' if delta > 0 else 'worse'} than carrying on as now "
                    f"({_inr(b_sum['end_balance'])}).")
    return {
        "has_data": True, "as_of": cash["as_of"], "months": months,
        "baseline_basis": {"months_used": len(recent), "avg_money_in": round(base_in, 2),
                           "avg_money_out": round(base_out, 2)},
        "inputs": {"sales_change_pct": sales_pct, "expense_change_pct": exp_pct,
                   "collect_overdue_pct": collect_pct, "collect_over_months": collect_n,
                   "overdue_available": round(float(overdue_amount or 0), 2), "one_time": clean},
        "baseline": baseline, "scenario": scenario,
        "baseline_summary": b_sum, "scenario_summary": s_sum,
        "end_balance_delta": delta, "headline": headline,
    }
