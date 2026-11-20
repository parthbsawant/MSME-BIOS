"""
health.py - Business Health Index. Pure functions: no database, no HTTP.

Combines the outputs of the other analytics modules into one 0-100 score.
Every component is scored by a simple rule and the score is a weighted
average, so the owner can see exactly why it is what it is.

Components (weight)
  liquidity       (30)  cash runway = closing balance / average monthly money out
                        (last 3 months). 3+ months of runway scores 100, 0 scores 0.
  cash_trend      (20)  net cash flow over the last 3 months as a share of money in.
                        +10% or better scores 100, -10% or worse scores 0.
  receivables     (20)  overdue share of what customers owe. 0% scores 100, 50%+ scores 0.
  concentration   (15)  customer concentration risk: low 100, medium 60, high 20.
  controls        (15)  100 minus 15 per high and 5 per medium anomaly (floor 0).

A component with no data is left out and the remaining weights are rescaled.
Bands: 75+ Healthy, 50-74 Watch, below 50 At risk.
"""

from typing import Dict, List, Optional

WEIGHTS = {"liquidity": 30, "cash_trend": 20, "receivables": 20, "concentration": 15, "controls": 15}
LABELS = {"liquidity": "Cash runway", "cash_trend": "Cash trend", "receivables": "Customer dues",
          "concentration": "Customer concentration", "controls": "Unusual activity"}
RUNWAY_FULL_MONTHS = 3.0
TREND_BEST = 0.10
TREND_WORST = -0.10
OVERDUE_WORST = 0.50
CONC_SCORES = {"low": 100.0, "medium": 60.0, "high": 20.0}
HIGH_PENALTY = 15
MEDIUM_PENALTY = 5
HEALTHY_MIN = 75.0
WATCH_MIN = 50.0


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


def _clamp(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, x))


def band(score: float) -> str:
    if score >= HEALTHY_MIN:
        return "healthy"
    if score >= WATCH_MIN:
        return "watch"
    return "at_risk"


def _comp(key: str, score: float, reason: str, value: Optional[float] = None) -> Dict:
    score = round(_clamp(score), 1)
    return {"key": key, "label": LABELS[key], "weight": WEIGHTS[key], "score": score,
            "status": band(score), "value": value, "reason": reason}


def _liquidity(cash: Optional[Dict]) -> Optional[Dict]:
    if not cash or not cash.get("has_data"):
        return None
    bal = float(cash["closing_balance"])
    recent = cash.get("months", [])[-3:]
    avg_out = sum(m["money_out"] for m in recent) / len(recent) if recent else 0.0
    if bal <= 0:
        return _comp("liquidity", 0.0, f"The account is overdrawn by {_inr(abs(bal))}, so there is no cash cushion.", 0.0)
    if avg_out <= 0:
        return _comp("liquidity", 100.0, f"The bank balance is {_inr(bal)} and no money went out recently.", None)
    runway = bal / avg_out
    return _comp("liquidity", runway * 100 / RUNWAY_FULL_MONTHS,
                 f"{_inr(bal)} in the bank covers about {runway:.1f} months of spending "
                 f"(average {_inr(avg_out)} a month). {RUNWAY_FULL_MONTHS:.0f}+ months is a full score.",
                 round(runway, 2))


def _cash_trend(cash: Optional[Dict]) -> Optional[Dict]:
    if not cash or not cash.get("has_data"):
        return None
    recent = cash.get("months", [])[-3:]
    money_in = sum(m["money_in"] for m in recent)
    net = sum(m["net"] for m in recent)
    if money_in <= 0:
        return _comp("cash_trend", 0.0, "No money came in over the last few months.", 0.0)
    ratio = net / money_in
    score = (ratio - TREND_WORST) * 100 / (TREND_BEST - TREND_WORST)
    word = "kept" if net >= 0 else "lost"
    return _comp("cash_trend", score,
                 f"Over the last {len(recent)} month{'s' if len(recent) != 1 else ''} the business {word} "
                 f"{_inr(abs(net))} ({ratio * 100:+.1f}% of money in). +10% or better is a full score.",
                 round(ratio * 100, 2))


def _receivables(aging: Optional[Dict]) -> Optional[Dict]:
    if not aging:
        return None
    total = float(aging.get("total_outstanding") or 0)
    if total <= 0:
        return _comp("receivables", 100.0, "Customers owe nothing right now.", 0.0)
    share = float(aging.get("overdue_amount") or 0) / total
    return _comp("receivables", 100 - share * 100 / OVERDUE_WORST,
                 f"{share * 100:.0f}% of the {_inr(total)} customers owe is overdue. "
                 f"{OVERDUE_WORST * 100:.0f}% or more overdue scores zero.", round(share * 100, 2))


def _concentration(conc: Optional[Dict]) -> Optional[Dict]:
    if not conc or not conc.get("has_data"):
        return None
    risk = conc.get("risk", "low")
    return _comp("concentration", CONC_SCORES.get(risk, 100.0),
                 f"The top customer is {conc['top1_pct']:.1f}% of sales and the top 3 are "
                 f"{conc['top3_pct']:.1f}%. Concentration risk is {risk}.", conc["top3_pct"])


def _controls(anoms: Optional[Dict]) -> Optional[Dict]:
    if not anoms or not anoms.get("has_data"):
        return None
    sev = anoms.get("by_severity", {})
    high, medium = int(sev.get("high", 0)), int(sev.get("medium", 0))
    score = 100 - HIGH_PENALTY * high - MEDIUM_PENALTY * medium
    if high + medium == 0:
        return _comp("controls", 100.0, "Nothing unusual was flagged.", 0.0)
    return _comp("controls", score,
                 f"{high} high and {medium} medium alert{'s' if high + medium != 1 else ''} flagged "
                 f"(each high costs {HIGH_PENALTY} points, each medium {MEDIUM_PENALTY}).", float(high + medium))


def build_health(cash: Optional[Dict], aging: Optional[Dict], concentration: Optional[Dict],
                 anomalies: Optional[Dict]) -> Dict:
    parts: List[Dict] = [c for c in (
        _liquidity(cash), _cash_trend(cash), _receivables(aging),
        _concentration(concentration), _controls(anomalies)) if c is not None]
    if not parts:
        return {"has_data": False, "score": None, "band": None, "coverage_pct": 0,
                "components": [], "drivers": []}
    used = sum(c["weight"] for c in parts)
    score = sum(c["score"] * c["weight"] for c in parts) / used
    for c in parts:
        c["effective_weight_pct"] = round(c["weight"] * 100 / used, 1)
        c["points_lost"] = round((100 - c["score"]) * c["weight"] / used, 1)
    drivers = [c["key"] for c in sorted(parts, key=lambda c: -c["points_lost"]) if c["points_lost"] > 0][:2]
    return {
        "has_data": True, "score": round(score, 1), "band": band(score),
        "coverage_pct": round(used * 100 / sum(WEIGHTS.values())),
        "components": parts, "drivers": drivers,
    }
