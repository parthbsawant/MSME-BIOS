"""
access.py — Who is calling, and what may they do (SPEC.md section 9).
Step 4 of TRACKER.md.

Every protected endpoint gets a Context from the verified Firebase token:
user, business (tenant), role, status and department - all resolved on
the server, nothing taken from the request. The guards below are the only
place access rules are applied; the rules themselves live in roles.py.

  current_context          any active member of a business
  require_owner            team, billing, plan, checkout, business details
  feature_access(feature)  business has an active plan (else 402) AND the
                           caller's role may use the feature (else 403)

Errors are raised as ApiError and rendered by api.py in the same
{"error", "message"} shape as every other error response.
"""

from dataclasses import dataclass
from typing import List, Optional

from fastapi import Depends

import roles
import subscriptions as subs
import tenant_resolution as tr
from db_pool import get_connection
from firebase_auth import verify_firebase_token


class ApiError(Exception):
    def __init__(self, status_code: int, error: str, message: str):
        self.status_code = status_code
        self.error = error
        self.message = message


@dataclass(frozen=True)
class Context:
    user_id: str
    tenant_id: str
    role: str
    status: str
    firebase_uid: str
    email: str

    @property
    def department(self) -> Optional[str]:
        """The department this caller's data is limited to; None = all (owner)."""
        return roles.department_for(self.role)

    @property
    def is_owner(self) -> bool:
        return roles.can_manage_business(self.role)


def resolve(decoded_token: dict):
    """(user_id, Context or None). None means the user has no business yet
    because an invitation is waiting for them. Does NOT check status."""
    conn = get_connection()
    try:
        user_id, membership = tr.resolve_membership(
            conn,
            firebase_uid=decoded_token["uid"],
            email=decoded_token.get("email", ""),
            display_name=decoded_token.get("name"),
        )
    finally:
        conn.close()
    if membership is None:
        return user_id, None
    return user_id, Context(
        user_id=user_id,
        tenant_id=membership["tenant_id"],
        role=membership["role"],
        status=membership["status"],
        firebase_uid=decoded_token["uid"],
        email=decoded_token.get("email", ""),
    )


def check_active(ctx: Context) -> None:
    if ctx.status != "active":
        raise ApiError(403, "deactivated", "Your access to this business has been turned off by the owner.")


def current_context(decoded_token: dict = Depends(verify_firebase_token)) -> Context:
    _, ctx = resolve(decoded_token)
    if ctx is None:
        raise ApiError(403, "invite_pending", "You have a pending invitation. Accept it to join the business.")
    check_active(ctx)
    return ctx


def require_owner(ctx: Context = Depends(current_context)) -> Context:
    if not ctx.is_owner:
        raise ApiError(403, "owner_only", "Only the business owner can do this.")
    return ctx


def plan_feature_ids(tenant_id: str) -> List[str]:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT feature_ids FROM plans WHERE tenant_id = %s", (tenant_id,))
            row = cur.fetchone()
    finally:
        conn.close()
    return list(row["feature_ids"] or []) if row else []


def require_paid(ctx: Context = Depends(current_context)) -> Context:
    """The business has an active subscription (members included)."""
    conn = get_connection()
    try:
        active = subs.is_active(conn, ctx.tenant_id)
    finally:
        conn.close()
    if not active:
        raise ApiError(402, "payment_required", "This business has no active plan. Complete checkout first.")
    return ctx


def feature_access(feature_id: str):
    """Dependency factory: paid business AND feature in plan ∩ role."""
    def dependency(ctx: Context = Depends(require_paid)) -> Context:
        if feature_id not in roles.effective_features(ctx.role, plan_feature_ids(ctx.tenant_id)):
            raise ApiError(403, "feature_not_available", "Your role or your business's plan does not include this feature.")
        return ctx
    return dependency
