"""
Step 3: pricing.py computes every price on the server, and the
frontend's display copy (featuresData.js) never drifts from it.

No database needed.
"""

import os
import re
from decimal import Decimal

import pytest

import pricing
from pricing import quote

FEATURES_DATA_JS = os.path.join(
    os.path.dirname(__file__), "..", "..", "..", "frontend", "msme-bios-frontend", "src", "lib", "featuresData.js"
)


# ---- quote(): tiers ----

def test_tier_price_and_seats():
    q = quote("tier", "growth", None, 0)
    assert q.total == Decimal("6999")
    assert q.seats_included == 4
    assert q.seats_total == 4
    assert q.feature_ids == pricing.TIERS["growth"]["feature_ids"]


def test_tier_with_extra_seats():
    q = quote("tier", "starter", None, 3)
    assert q.extra_seats_price == Decimal("1497")  # 3 x 499
    assert q.total == Decimal("2999") + Decimal("1497")
    assert q.seats_total == 5


def test_tier_ignores_client_feature_list():
    """A client cannot add features to a cheaper tier: the tier's own
    feature list is always used."""
    q = quote("tier", "starter", list(pricing.FEATURE_PRICES), 0)
    assert q.feature_ids == pricing.TIERS["starter"]["feature_ids"]
    assert q.total == Decimal("2999")


@pytest.mark.parametrize("tier_id,seats", [("starter", 2), ("growth", 4), ("intelligence", 6), ("full_suite", 10)])
def test_seats_included_per_tier_match_spec(tier_id, seats):
    assert quote("tier", tier_id, None, 0).seats_included == seats


# ---- quote(): custom ----

def test_custom_price_is_sum_of_features_plus_seats():
    q = quote("custom", None, ["document_parser", "whatsapp_alerts"], 2)
    assert q.base_price == Decimal("1499") + Decimal("599")
    assert q.seats_included == 2
    assert q.total == Decimal("2098") + Decimal("998")
    assert q.tier_id is None


def test_custom_duplicate_features_counted_once():
    q = quote("custom", None, ["document_parser", "document_parser"], 0)
    assert q.feature_ids == ["document_parser"]
    assert q.total == Decimal("1499")


# ---- quote(): invalid input is rejected ----

@pytest.mark.parametrize("args", [
    ("tier", "platinum", None, 0),          # unknown tier
    ("tier", None, None, 0),                # missing tier
    ("custom", None, [], 0),                # empty custom plan
    ("custom", None, ["free_money"], 0),    # unknown feature
    ("tier", "starter", None, -1),          # negative seats
    ("tier", "starter", None, 21),          # over the limit
    ("tier", "starter", None, 1.5),         # not a whole number
    ("lifetime", None, None, 0),            # unknown plan type
])
def test_invalid_choices_raise(args):
    with pytest.raises(ValueError):
        quote(*args)


def test_max_extra_seats_allowed():
    assert quote("tier", "starter", None, 20).extra_seats == 20


# ---- the frontend's display copy matches pricing.py ----

@pytest.fixture(scope="module")
def features_js():
    if not os.path.isfile(FEATURES_DATA_JS):
        pytest.skip("frontend source not present (e.g. inside the backend Docker image)")
    with open(FEATURES_DATA_JS, encoding="utf-8") as f:
        return f.read()


def test_frontend_feature_prices_match(features_js):
    features_block = features_js.split("export const TIERS")[0]
    js_prices = {fid: Decimal(price) for fid, price in re.findall(r"id:\s*'(\w+)'[\s\S]*?price:\s*(\d+)", features_block)}
    assert js_prices == pricing.FEATURE_PRICES


def test_frontend_tiers_match(features_js):
    tiers_block = features_js.split("export const TIERS")[1]
    found = re.findall(
        r"id:\s*'(\w+)'[\s\S]*?price:\s*(\d+),\s*seatsIncluded:\s*(\d+),\s*featureIds:\s*(\[[^\]]*\]|FEATURES\.map)",
        tiers_block,
    )
    assert {t[0] for t in found} == set(pricing.TIERS)
    for tier_id, price, seats, features in found:
        tier = pricing.TIERS[tier_id]
        assert Decimal(price) == tier["price"], tier_id
        assert int(seats) == tier["seats_included"], tier_id
        js_features = list(pricing.FEATURE_PRICES) if features == "FEATURES.map" else re.findall(r"'(\w+)'", features)
        assert js_features == tier["feature_ids"], tier_id


def test_frontend_seat_constants_match(features_js):
    def const(name):
        return int(re.search(rf"export const {name} = (\d+)", features_js).group(1))
    assert const("CUSTOM_SEATS_INCLUDED") == pricing.CUSTOM_SEATS_INCLUDED
    assert Decimal(const("EXTRA_SEAT_PRICE")) == pricing.EXTRA_SEAT_PRICE
    assert const("MAX_EXTRA_SEATS") == pricing.MAX_EXTRA_SEATS
