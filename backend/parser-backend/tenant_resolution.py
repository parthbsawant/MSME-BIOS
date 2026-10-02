"""
tenant_resolution.py — Turns a VERIFIED Firebase identity into the
tenant_id the parser and persistence layers should use.

This module never touches Firebase itself - it only takes a firebase_uid
that firebase_auth.py has already verified, and answers: "which user is
this, and which tenant do they belong to?" Nothing here trusts a
tenant_id supplied by a caller; the tenant_id this module returns is
always looked up or created server-side from the verified UID alone.

Find-or-create, both steps:
  Firebase UID -> users row (create on first sign-in)
  user -> tenants row via user_tenants (create on first sign-in)

A user gets exactly one tenant today (matching the current one-business
onboarding flow) - the UNIQUE constraint on user_tenants(user_id,
tenant_id) doesn't enforce that by itself, but get_or_create_tenant_for_
user()'s own logic does, by always returning the user's EXISTING tenant
if one is found, rather than ever creating a second one for the same
user. Multiple tenants per user is a real future case (Section 2 of the
project brief), but this milestone doesn't need it yet.
"""

from typing import Optional


def get_or_create_user(conn, firebase_uid: str, email: str, display_name: Optional[str]) -> str:
    """Returns the user's id (UUID, as a string). Creates the row on
    first sign-in; on every later sign-in, refreshes email/display_name
    in case they changed on Firebase's side, but keeps the same id."""
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM users WHERE firebase_uid = %s", (firebase_uid,))
        row = cur.fetchone()
        if row:
            cur.execute(
                "UPDATE users SET email = %s, display_name = %s, updated_at = now() WHERE id = %s",
                (email, display_name, row["id"]),
            )
            conn.commit()
            return str(row["id"])

        cur.execute(
            "INSERT INTO users (firebase_uid, email, display_name) VALUES (%s, %s, %s) RETURNING id",
            (firebase_uid, email, display_name),
        )
        new_id = cur.fetchone()["id"]
        conn.commit()
        return str(new_id)


def get_or_create_tenant_for_user(conn, user_id: str) -> str:
    """Returns the tenant_id (UUID, as a string) this user has access
    to, creating a new tenant on their first call if they don't have one
    yet."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT tenant_id FROM user_tenants WHERE user_id = %s LIMIT 1",
            (user_id,),
        )
        row = cur.fetchone()
        if row:
            return str(row["tenant_id"])

        cur.execute("INSERT INTO tenants DEFAULT VALUES RETURNING id")
        new_tenant_id = cur.fetchone()["id"]

        cur.execute(
            "INSERT INTO user_tenants (user_id, tenant_id, role) VALUES (%s, %s, 'owner')",
            (user_id, new_tenant_id),
        )
        conn.commit()
        return str(new_tenant_id)


def resolve_tenant_id(conn, firebase_uid: str, email: str, display_name: Optional[str]) -> str:
    """
    The one function api.py actually calls. Given a verified Firebase
    identity, returns the tenant_id to use for every downstream
    operation - the only path by which tenant_id is ever determined.
    """
    user_id = get_or_create_user(conn, firebase_uid, email, display_name)
    return get_or_create_tenant_for_user(conn, user_id)
