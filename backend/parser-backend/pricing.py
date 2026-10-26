"""
pricing.py — The one source of truth for what a plan costs (SPEC.md
section 4, Step 3 of TRACKER.md).

The browser never supplies a price. Checkout sends only WHAT was chosen
(tier or features, plus extra seats); quote() below computes the amount.
frontend/msme-bios-frontend/src/lib/featuresData.js mirrors these numbers
for display only - tests/test_pricing.py fails if the two ever disagree.

All amounts are Decimal rupees per month. All numbers are placeholders
until Parth confirms real prices.
"""

from dataclasses import dataclass
from decimal import Decimal
from typing import List, Optional

FEATURE_PRICES = {
    "document_parser": Decimal("1499"),
    "cash_dashboard": Decimal("999"),
    "invoice_generator": Decimal("1299"),
    "receivables_payables": Decimal("1499"),
    "pnl_statement": Decimal("999"),
    "aging_reports": Decimal("799"),
    "anomaly_detection": Decimal("2499"),
    "business_health_index": Decimal("1999"),
    "revenue_concentration": Decimal("1299"),
    "demand_forecasting": Decimal("2999"),
    "cash_flow_simulator": Decimal("2499"),
    "whatsapp_alerts": Decimal("599"),
}

TIERS = {
    "starter": {
        "price": Decimal("2999"),
        "seats_included": 2,
        "feature_ids": ["document_parser", "cash_dashboard", "invoice_generator"],
    },
    "growth": {
        "price": Decimal("6999"),
        "seats_included": 4,
        "feature_ids": ["document_parser", "cash_dashboard", "invoice_generator", "receivables_payables",
                        "pnl_statement", "aging_reports"],
    },
    "intelligence": {
        "price": Decimal("14999"),
        "seats_included": 6,
        "feature_ids": ["document_parser", "cash_dashboard", "invoice_generator", "receivables_payables",
                        "pnl_statement", "aging_reports", "anomaly_detection", "business_health_index",
                        "revenue_concentration"],
    },
    "full_suite": {
        "price": Decimal("24999"),
        "seats_included": 10,
        "feature_ids": list(FEATURE_PRICES),
    },
}

CUSTOM_SEATS_INCLUDED = 2
EXTRA_SEAT_PRICE = Decimal("499")
MAX_EXTRA_SEATS = 20


@dataclass(frozen=True)
class Quote:
    plan_type: str               # 'tier' or 'custom'
    tier_id: Optional[str]
    feature_ids: List[str]
    seats_included: int
    extra_seats: int
    base_price: Decimal          # tier price, or sum of chosen feature prices
    extra_seats_price: Decimal   # extra_seats * EXTRA_SEAT_PRICE
    total: Decimal               # what the customer pays per month

    @property
    def seats_total(self) -> int:
        return self.seats_included + self.extra_seats


def quote(plan_type: str, tier_id: Optional[str], feature_ids: Optional[List[str]], extra_seats: int) -> Quote:
    """
    Computes the monthly price for a plan choice. Raises ValueError for
    anything invalid (unknown tier or feature, empty custom plan, extra
    seats out of range) - callers turn that into a 400.

    For a tier, the feature list always comes from TIERS, never from the
    caller, so a client cannot add features to a cheaper tier.
    """
    if not isinstance(extra_seats, int) or not 0 <= extra_seats <= MAX_EXTRA_SEATS:
        raise ValueError(f"extra_seats must be a whole number from 0 to {MAX_EXTRA_SEATS}")

    if plan_type == "tier":
        tier = TIERS.get(tier_id or "")
        if tier is None:
            raise ValueError(f"Unknown tier {tier_id!r}")
        features = list(tier["feature_ids"])
        base = tier["price"]
        seats_included = tier["seats_included"]
    elif plan_type == "custom":
        # Deduplicate but keep the caller's order.
        features = list(dict.fromkeys(feature_ids or []))
        if not features:
            raise ValueError("A custom plan needs at least one feature")
        unknown = [f for f in features if f not in FEATURE_PRICES]
        if unknown:
            raise ValueError(f"Unknown features: {unknown}")
        base = sum((FEATURE_PRICES[f] for f in features), Decimal("0"))
        seats_included = CUSTOM_SEATS_INCLUDED
        tier_id = None
    else:
        raise ValueError("plan_type must be 'tier' or 'custom'")

    extra_price = EXTRA_SEAT_PRICE * extra_seats
    return Quote(
        plan_type=plan_type,
        tier_id=tier_id,
        feature_ids=features,
        seats_included=seats_included,
        extra_seats=extra_seats,
        base_price=base,
        extra_seats_price=extra_price,
        total=base + extra_price,
    )
