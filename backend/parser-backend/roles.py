"""
roles.py — The one source of truth for roles, departments and what each
role may use (SPEC.md section 3). Step 4 of TRACKER.md.

Every role decision in the backend goes through the functions below -
never through `if role == ...` scattered across endpoints - so custom
roles (a later phase) can replace these dictionaries with a table read
without touching any endpoint.

The frontend may mirror this for HIDING menu items only; the backend is
the authority.
"""

from typing import Iterable, List, Optional

import pricing

ROLES = ("owner", "finance", "sales", "hr", "marketing")
OWNER = "owner"
MEMBER_ROLES = tuple(r for r in ROLES if r != OWNER)

# Which department's data a role sees. None = all departments (owner).
_ROLE_DEPARTMENT = {
    "owner": None,
    "finance": "finance",
    "sales": "sales",
    "hr": "hr",
    "marketing": "marketing",
}

# Features each role is ALLOWED. What they actually get is this
# intersected with the plan the business bought (effective_features).
_ROLE_FEATURES = {
    "owner": list(pricing.FEATURE_PRICES),  # everything; the plan limits it
    "finance": ["document_parser", "cash_dashboard", "receivables_payables", "pnl_statement",
                "aging_reports", "cash_flow_simulator", "anomaly_detection"],
    "sales": ["invoice_generator", "revenue_concentration", "demand_forecasting"],
    "hr": ["document_parser"],  # limited to HR documents by the department filter
    "marketing": ["demand_forecasting", "revenue_concentration", "whatsapp_alerts"],
}


def _check(role: str) -> None:
    if role not in ROLES:
        raise ValueError(f"Unknown role {role!r}")


def is_member_role(role: str) -> bool:
    """A role the owner can invite someone as (every role except owner)."""
    return role in MEMBER_ROLES


def department_for(role: str) -> Optional[str]:
    """The department this role's data is limited to; None means all."""
    _check(role)
    return _ROLE_DEPARTMENT[role]


def allowed_features(role: str) -> List[str]:
    _check(role)
    return list(_ROLE_FEATURES[role])


def effective_features(role: str, plan_feature_ids: Iterable[str]) -> List[str]:
    """Plan features intersected with role features, in plan order. A
    feature not in the plan is unavailable to everyone, owner included."""
    allowed = set(allowed_features(role))
    return [f for f in plan_feature_ids if f in allowed]


def can_manage_business(role: str) -> bool:
    """Team, billing, plan, checkout and business details: owner only."""
    _check(role)
    return role == OWNER
