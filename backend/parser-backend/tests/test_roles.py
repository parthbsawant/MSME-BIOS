"""
Step 4: roles.py matches SPEC.md section 3 exactly. No database needed.
"""

import pytest

import pricing
import roles

ALL_TIER_FEATURES = pricing.TIERS["full_suite"]["feature_ids"]


@pytest.mark.parametrize("role,expected", [
    ("finance", {"document_parser", "cash_dashboard", "receivables_payables", "pnl_statement",
                 "aging_reports", "cash_flow_simulator", "anomaly_detection"}),
    ("sales", {"invoice_generator", "revenue_concentration", "demand_forecasting"}),
    ("hr", {"document_parser"}),
    ("marketing", {"demand_forecasting", "revenue_concentration", "whatsapp_alerts"}),
])
def test_role_features_match_spec(role, expected):
    assert set(roles.allowed_features(role)) == expected


def test_owner_gets_exactly_the_plan():
    growth = pricing.TIERS["growth"]["feature_ids"]
    assert roles.effective_features("owner", growth) == growth
    assert roles.effective_features("owner", ALL_TIER_FEATURES) == ALL_TIER_FEATURES


def test_feature_not_in_plan_is_hidden_from_everyone():
    plan = ["invoice_generator"]  # e.g. a custom plan without the document parser
    assert roles.effective_features("owner", plan) == ["invoice_generator"]
    assert roles.effective_features("finance", plan) == []
    assert roles.effective_features("hr", plan) == []


def test_effective_is_intersection_in_plan_order():
    plan = pricing.TIERS["intelligence"]["feature_ids"]
    assert roles.effective_features("finance", plan) == [f for f in plan if f in roles.allowed_features("finance")]
    assert roles.effective_features("sales", plan) == ["invoice_generator", "revenue_concentration"]


@pytest.mark.parametrize("role,dept", [("owner", None), ("finance", "finance"), ("sales", "sales"),
                                       ("hr", "hr"), ("marketing", "marketing")])
def test_departments(role, dept):
    assert roles.department_for(role) == dept


def test_only_owner_manages_the_business():
    assert roles.can_manage_business("owner")
    assert not any(roles.can_manage_business(r) for r in roles.MEMBER_ROLES)


def test_owner_is_not_an_invitable_role():
    assert not roles.is_member_role("owner")
    assert all(roles.is_member_role(r) for r in ("finance", "sales", "hr", "marketing"))
    assert not roles.is_member_role("admin")


def test_unknown_role_raises():
    with pytest.raises(ValueError):
        roles.department_for("admin")
    with pytest.raises(ValueError):
        roles.effective_features("admin", ALL_TIER_FEATURES)


def test_every_role_feature_is_a_real_feature():
    for role in roles.ROLES:
        assert set(roles.allowed_features(role)) <= set(pricing.FEATURE_PRICES), role


def test_role_departments_match_document_departments():
    import document_store
    member_departments = {roles.department_for(r) for r in roles.MEMBER_ROLES}
    assert member_departments == set(document_store.DEPARTMENTS)
