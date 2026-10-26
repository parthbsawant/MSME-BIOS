"""
team.py — Invitations, members, seats and the audit log in the database
(SPEC.md sections 4, 6 and 7). Step 4 of TRACKER.md.

Rules:
  - Invite by link only. The raw token is returned ONCE (for the owner to
    copy); only its SHA-256 hash is stored. Links expire after 7 days.
  - Seats: active members (owner included) + live pending invites can
    never exceed subscriptions.seats_purchased. The subscription row is
    locked while checking, so two simultaneous invites cannot both take
    the last seat.
  - The owner cannot be invited, re-roled or deactivated.
  - One person belongs to one business (v1). Accepting an invite while
    owning a business is refused - unless that business is completely
    empty, in which case it is deleted (decision 2026-10-26).
  - Every team action writes an audit_log row in the same transaction.

Errors are TeamError(status, code, message); api.py turns them into the
standard {"error", "message"} response.
"""

import hashlib
import re
import secrets
from typing import Optional

from psycopg2.extras import Json

import roles

INVITE_TTL_DAYS = 7
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class TeamError(Exception):
    def __init__(self, status_code: int, error: str, message: str):
        self.status_code = status_code
        self.error = error
        self.message = message


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _audit(cur, tenant_id: str, user_id: Optional[str], action: str, target: Optional[str], details: Optional[dict] = None):
    cur.execute(
        "INSERT INTO audit_log (tenant_id, user_id, action, target, details) VALUES (%s, %s, %s, %s, %s)",
        (tenant_id, user_id, action, target, Json(details) if details is not None else None),
    )


def _transaction(conn, fn):
    """Runs fn(cur) in one transaction; rolls back on any error."""
    try:
        with conn.cursor() as cur:
            result = fn(cur)
        conn.commit()
        return result
    except Exception:
        conn.rollback()
        raise


# ============================================================
# SEATS
# ============================================================

def _seats(cur, tenant_id: str, lock: bool = False) -> dict:
    cur.execute(
        "SELECT seats_purchased FROM subscriptions WHERE tenant_id = %s AND status = 'active'" + (" FOR UPDATE" if lock else ""),
        (tenant_id,),
    )
    sub = cur.fetchone()
    cur.execute("SELECT count(*) AS n FROM user_tenants WHERE tenant_id = %s AND status = 'active'", (tenant_id,))
    members = cur.fetchone()["n"]
    cur.execute(
        "SELECT count(*) AS n FROM invitations WHERE tenant_id = %s AND status = 'pending' AND expires_at > now()",
        (tenant_id,),
    )
    pending = cur.fetchone()["n"]
    return {
        "purchased": sub["seats_purchased"] if sub else 0,
        "active_members": members,
        "pending_invites": pending,
        "in_use": members + pending,
    }


def seat_summary(conn, tenant_id: str) -> dict:
    return _transaction(conn, lambda cur: _seats(cur, tenant_id))


def _require_free_seat(cur, tenant_id: str) -> None:
    seats = _seats(cur, tenant_id, lock=True)
    if seats["in_use"] + 1 > seats["purchased"]:
        raise TeamError(
            409, "seat_limit",
            f"All {seats['purchased']} seats are in use ({seats['active_members']} members, "
            f"{seats['pending_invites']} pending invites). Revoke an invite, deactivate a member or buy more seats.",
        )


# ============================================================
# INVITATIONS (owner side)
# ============================================================

def create_invite(conn, tenant_id: str, owner_user_id: str, email: str, role: str) -> dict:
    email = (email or "").strip().lower()
    if not _EMAIL_RE.match(email):
        raise TeamError(400, "bad_request", "Enter a valid email address.")
    if not roles.is_member_role(role):
        raise TeamError(400, "bad_request", f"Role must be one of {list(roles.MEMBER_ROLES)}.")

    def run(cur):
        cur.execute(
            """SELECT 1 FROM user_tenants ut JOIN users u ON u.id = ut.user_id
               WHERE ut.tenant_id = %s AND lower(u.email) = %s""",
            (tenant_id, email),
        )
        if cur.fetchone():
            raise TeamError(409, "already_member", "This person is already in your team.")
        # An expired pending invite no longer counts; retire it so the
        # "one pending invite per email" rule lets a fresh one through.
        cur.execute(
            "UPDATE invitations SET status = 'revoked' WHERE tenant_id = %s AND email = %s AND status = 'pending' AND expires_at <= now()",
            (tenant_id, email),
        )
        cur.execute(
            "SELECT 1 FROM invitations WHERE tenant_id = %s AND email = %s AND status = 'pending'",
            (tenant_id, email),
        )
        if cur.fetchone():
            raise TeamError(409, "invite_exists", "This email already has a pending invite. Revoke it first to send a new one.")
        _require_free_seat(cur, tenant_id)

        token = secrets.token_urlsafe(32)
        cur.execute(
            """
            INSERT INTO invitations (tenant_id, email, role, token_hash, invited_by, expires_at)
            VALUES (%s, %s, %s, %s, %s, now() + make_interval(days => %s))
            RETURNING id, expires_at
            """,
            (tenant_id, email, role, hash_token(token), owner_user_id, INVITE_TTL_DAYS),
        )
        row = cur.fetchone()
        _audit(cur, tenant_id, owner_user_id, "invite.created", email, {"role": role})
        return {"invite_id": str(row["id"]), "email": email, "role": role,
                "expires_at": row["expires_at"].isoformat(), "token": token}

    return _transaction(conn, run)


def list_invites(conn, tenant_id: str) -> list:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, email, role, status, expires_at, created_at, accepted_at,
                   (status = 'pending' AND expires_at <= now()) AS expired
            FROM invitations WHERE tenant_id = %s ORDER BY created_at DESC
            """,
            (tenant_id,),
        )
        rows = cur.fetchall()
    return [
        {
            "invite_id": str(r["id"]),
            "email": r["email"],
            "role": r["role"],
            "status": "expired" if r["expired"] else r["status"],
            "expires_at": r["expires_at"].isoformat(),
            "created_at": r["created_at"].isoformat(),
            "accepted_at": r["accepted_at"].isoformat() if r["accepted_at"] else None,
        }
        for r in rows
    ]


def revoke_invite(conn, tenant_id: str, owner_user_id: str, invite_id: str) -> None:
    def run(cur):
        cur.execute(
            "UPDATE invitations SET status = 'revoked' WHERE id = %s AND tenant_id = %s AND status = 'pending' RETURNING email",
            (invite_id, tenant_id),
        )
        row = cur.fetchone()
        if row is None:
            raise TeamError(404, "not_found", "No pending invite with this id.")
        _audit(cur, tenant_id, owner_user_id, "invite.revoked", row["email"])
    _transaction(conn, run)


# ============================================================
# MEMBERS (owner side)
# ============================================================

def list_members(conn, tenant_id: str) -> list:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT u.id AS user_id, u.email, u.display_name, ut.role, ut.status, ut.created_at
            FROM user_tenants ut JOIN users u ON u.id = ut.user_id
            WHERE ut.tenant_id = %s
            ORDER BY (ut.role = 'owner') DESC, ut.created_at
            """,
            (tenant_id,),
        )
        rows = cur.fetchall()
    return [
        {
            "user_id": str(r["user_id"]),
            "email": r["email"],
            "display_name": r["display_name"],
            "role": r["role"],
            "department": roles.department_for(r["role"]),
            "status": r["status"],
            "joined_at": r["created_at"].isoformat(),
        }
        for r in rows
    ]


def _member_for_update(cur, tenant_id: str, user_id: str) -> dict:
    cur.execute(
        "SELECT role, status FROM user_tenants WHERE tenant_id = %s AND user_id = %s FOR UPDATE",
        (tenant_id, user_id),
    )
    member = cur.fetchone()
    if member is None:
        raise TeamError(404, "not_found", "No member with this id in your business.")
    if member["role"] == roles.OWNER:
        raise TeamError(403, "owner_protected", "The owner's role and access cannot be changed.")
    return member


def change_role(conn, tenant_id: str, owner_user_id: str, user_id: str, role: str) -> None:
    if not roles.is_member_role(role):
        raise TeamError(400, "bad_request", f"Role must be one of {list(roles.MEMBER_ROLES)}.")

    def run(cur):
        member = _member_for_update(cur, tenant_id, user_id)
        cur.execute("UPDATE user_tenants SET role = %s WHERE tenant_id = %s AND user_id = %s", (role, tenant_id, user_id))
        _audit(cur, tenant_id, owner_user_id, "member.role_changed", user_id, {"from": member["role"], "to": role})
    _transaction(conn, run)


def set_status(conn, tenant_id: str, owner_user_id: str, user_id: str, status: str) -> None:
    def run(cur):
        member = _member_for_update(cur, tenant_id, user_id)
        if member["status"] == status:
            return
        if status == "active":
            _require_free_seat(cur, tenant_id)  # a reactivated member takes a seat again
        cur.execute("UPDATE user_tenants SET status = %s WHERE tenant_id = %s AND user_id = %s", (status, tenant_id, user_id))
        _audit(cur, tenant_id, owner_user_id, "member.reactivated" if status == "active" else "member.deactivated", user_id)
    _transaction(conn, run)


def list_audit(conn, tenant_id: str, limit: int = 100) -> list:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT a.action, a.target, a.details, a.at, u.email AS actor_email
            FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
            WHERE a.tenant_id = %s ORDER BY a.at DESC LIMIT %s
            """,
            (tenant_id, limit),
        )
        rows = cur.fetchall()
    return [{"action": r["action"], "target": r["target"], "details": r["details"],
             "actor_email": r["actor_email"], "at": r["at"].isoformat()} for r in rows]


# ============================================================
# INVITATIONS (invitee side)
# ============================================================

def preview_invite(conn, token: str) -> Optional[dict]:
    """What the accept page shows. None if the token is unknown."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT i.email, i.role, i.status, (i.expires_at <= now()) AS expired, b.business_name
            FROM invitations i LEFT JOIN businesses b ON b.tenant_id = i.tenant_id
            WHERE i.token_hash = %s
            """,
            (hash_token(token),),
        )
        row = cur.fetchone()
    if row is None:
        return None
    status = "expired" if row["status"] == "pending" and row["expired"] else row["status"]
    return {"business_name": row["business_name"], "role": row["role"], "email": row["email"], "status": status}


def _is_empty_business(cur, tenant_id: str) -> bool:
    cur.execute(
        """
        SELECT NOT EXISTS (SELECT 1 FROM businesses WHERE tenant_id = %(t)s)
           AND NOT EXISTS (SELECT 1 FROM plans WHERE tenant_id = %(t)s)
           AND NOT EXISTS (SELECT 1 FROM subscriptions WHERE tenant_id = %(t)s)
           AND NOT EXISTS (SELECT 1 FROM documents WHERE tenant_id = %(t)s)
           AND (SELECT count(*) FROM user_tenants WHERE tenant_id = %(t)s) = 1 AS empty
        """,
        {"t": tenant_id},
    )
    return cur.fetchone()["empty"]


def accept_invite(conn, user_id: str, user_email: str, token: str) -> dict:
    """
    Joins the signed-in user to the inviting business with the invited
    role. Checks, in this order: the token exists, it is not revoked,
    not already used, not expired, and was sent to this user's email.
    One transaction; the invitation row is locked so it can be used once.
    """
    def run(cur):
        cur.execute(
            "SELECT id, tenant_id, email, role, status, (expires_at <= now()) AS expired FROM invitations WHERE token_hash = %s FOR UPDATE",
            (hash_token(token or ""),),
        )
        invite = cur.fetchone()
        if invite is None:
            raise TeamError(404, "invite_invalid", "This invite link is not valid.")
        if invite["status"] == "revoked":
            raise TeamError(410, "invite_revoked", "This invite was cancelled by the business owner.")
        if invite["status"] == "accepted":
            raise TeamError(409, "invite_used", "This invite link has already been used.")
        if invite["expired"]:
            raise TeamError(410, "invite_expired", "This invite link has expired. Ask the owner for a new one.")
        if (user_email or "").strip().lower() != invite["email"]:
            raise TeamError(403, "invite_wrong_email", "This invite was sent to a different email address. Sign in with the invited email.")

        tenant_id = str(invite["tenant_id"])
        cur.execute("SELECT tenant_id, role FROM user_tenants WHERE user_id = %s FOR UPDATE", (user_id,))
        current = cur.fetchone()
        if current is not None:
            current_tenant = str(current["tenant_id"])
            if current_tenant == tenant_id:
                raise TeamError(409, "already_member", "You are already a member of this business.")
            if current["role"] == roles.OWNER and _is_empty_business(cur, current_tenant):
                cur.execute("DELETE FROM tenants WHERE id = %s", (current_tenant,))  # cascades its user_tenants row
            else:
                raise TeamError(409, "has_business",
                                "Your account already belongs to a business. One account can belong to one business.")

        cur.execute(
            "INSERT INTO user_tenants (user_id, tenant_id, role, status) VALUES (%s, %s, %s, 'active')",
            (user_id, tenant_id, invite["role"]),
        )
        cur.execute(
            "UPDATE invitations SET status = 'accepted', accepted_at = now(), accepted_by = %s WHERE id = %s",
            (user_id, invite["id"]),
        )
        _audit(cur, tenant_id, user_id, "member.joined", invite["email"], {"role": invite["role"]})
        return {"tenant_id": tenant_id, "role": invite["role"], "department": roles.department_for(invite["role"])}

    return _transaction(conn, run)
