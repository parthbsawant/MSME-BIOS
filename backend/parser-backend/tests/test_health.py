from health import build_health, band


def cash(balance=300000, months=None):
    months = months or [{"month": "2026-01", "money_in": 100000, "money_out": 100000, "net": 0, "closing_balance": balance}]
    return {"has_data": True, "closing_balance": balance, "months": months}


def comp(res, key):
    return next(c for c in res["components"] if c["key"] == key)


def test_nothing_gives_no_score():
    r = build_health(None, None, None, None)
    assert r["has_data"] is False and r["score"] is None and r["components"] == []
    r = build_health({"has_data": False}, None, {"has_data": False}, {"has_data": False})
    assert r["has_data"] is False


def test_bands():
    assert band(75) == "healthy" and band(74.9) == "watch" and band(50) == "watch" and band(49.9) == "at_risk"


def test_liquidity_runway():
    r = build_health(cash(300000), None, None, None)       # 3 months of 100k
    assert comp(r, "liquidity")["score"] == 100.0
    r = build_health(cash(150000), None, None, None)       # 1.5 months
    assert comp(r, "liquidity")["score"] == 50.0
    r = build_health(cash(-5000), None, None, None)
    assert comp(r, "liquidity")["score"] == 0.0
    r = build_health(cash(900000), None, None, None)       # capped at 100
    assert comp(r, "liquidity")["score"] == 100.0


def test_cash_trend_bounds():
    good = cash(months=[{"month": "m", "money_in": 100, "money_out": 80, "net": 20, "closing_balance": 1}])
    bad = cash(months=[{"month": "m", "money_in": 100, "money_out": 120, "net": -20, "closing_balance": 1}])
    flat = cash(months=[{"month": "m", "money_in": 100, "money_out": 100, "net": 0, "closing_balance": 1}])
    assert comp(build_health(good, None, None, None), "cash_trend")["score"] == 100.0
    assert comp(build_health(bad, None, None, None), "cash_trend")["score"] == 0.0
    assert comp(build_health(flat, None, None, None), "cash_trend")["score"] == 50.0


def test_uses_only_last_three_months():
    months = [{"month": f"m{i}", "money_in": 100, "money_out": 900 if i == 0 else 100, "net": 0, "closing_balance": 1}
              for i in range(4)]
    r = build_health(cash(300, months=months), None, None, None)
    assert comp(r, "liquidity")["score"] == 100.0       # the 900 month is ignored


def test_receivables():
    assert comp(build_health(None, {"total_outstanding": 0, "overdue_amount": 0}, None, None), "receivables")["score"] == 100.0
    assert comp(build_health(None, {"total_outstanding": 1000, "overdue_amount": 250}, None, None), "receivables")["score"] == 50.0
    assert comp(build_health(None, {"total_outstanding": 1000, "overdue_amount": 900}, None, None), "receivables")["score"] == 0.0


def test_concentration_and_controls():
    conc = {"has_data": True, "risk": "medium", "top1_pct": 12.0, "top3_pct": 31.0}
    r = build_health(None, None, conc, {"has_data": True, "by_severity": {"high": 2, "medium": 1}})
    assert comp(r, "concentration")["score"] == 60.0
    assert comp(r, "controls")["score"] == 65.0            # 100 - 30 - 5
    r = build_health(None, None, None, {"has_data": True, "by_severity": {"high": 10, "medium": 0}})
    assert comp(r, "controls")["score"] == 0.0


def test_weights_rescale_when_components_missing():
    r = build_health(None, None, {"has_data": True, "risk": "low", "top1_pct": 5, "top3_pct": 10},
                     {"has_data": True, "by_severity": {"high": 0, "medium": 0}})
    assert r["score"] == 100.0 and r["coverage_pct"] == 30
    assert comp(r, "concentration")["effective_weight_pct"] == 50.0


def test_overall_score_and_drivers():
    r = build_health(cash(300000),
                     {"total_outstanding": 1000, "overdue_amount": 500},                       # receivables 0
                     {"has_data": True, "risk": "high", "top1_pct": 30, "top3_pct": 60},       # conc 20
                     {"has_data": True, "by_severity": {"high": 0, "medium": 0}})               # controls 100
    # liquidity 100*30 + trend 50*20 + recv 0*20 + conc 20*15 + controls 100*15 = 3000+1000+0+300+1500 = 5800 / 100
    assert r["score"] == 58.0 and r["band"] == "watch" and r["coverage_pct"] == 100
    assert r["drivers"] == ["receivables", "concentration"]   # lost 20 and 12 points (trend lost 10)
    assert abs(sum(c["points_lost"] for c in r["components"]) - (100 - r["score"])) < 0.2
