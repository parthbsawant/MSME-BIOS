"""
Backend tenant-isolation tests - Milestone 2 Phase 9.

Proves the backend enforces isolation independently of the frontend,
per the project brief's explicit requirement: "the browser must never be
trusted to determine which tenant a user belongs to."

Uses FastAPI's dependency_overrides to substitute a fake-but-realistic
decoded token in place of a real Firebase verification call - this lets
these tests run without live Firebase credentials, while still
exercising every real line of tenant-resolution and persistence logic.
The one thing this CANNOT test without real credentials is Firebase's
own cryptographic verification step (a genuinely invalid signature being
rejected) - that specific case needs a real Firebase project and is
documented as a manual check, not skipped silently.

Run with:
    pytest tests/test_tenant_isolation.py -v
"""

import os

import pytest
from fastapi.testclient import TestClient

from api import app
from firebase_auth import verify_firebase_token
from db_pool import get_connection


@pytest.fixture(autouse=True)
def clean_dependency_overrides():
    """Every test starts with a clean slate - no leftover override from
    a previous test silently making this one pass for the wrong reason."""
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    return TestClient(app)


def _as_user(firebase_uid: str, email: str, name: str):
    """Returns a function suitable for app.dependency_overrides -
    simulates "this request came from a real, already-verified user
    with this identity", without touching Firebase's servers."""
    def override():
        return {"uid": firebase_uid, "email": email, "name": name}
    return override


# ---- 1-4: both users can authenticate and each gets their own tenant ----

def test_two_different_users_get_two_different_tenants(client):
    app.dependency_overrides[verify_firebase_token] = _as_user("uid_A", "a@test.com", "A")
    tenant_a = client.get("/api/me").json()["tenant_id"]

    app.dependency_overrides[verify_firebase_token] = _as_user("uid_B", "b@test.com", "B")
    tenant_b = client.get("/api/me").json()["tenant_id"]

    assert tenant_a != tenant_b


def test_same_user_always_resolves_to_the_same_tenant(client):
    user = _as_user("uid_consistent", "consistent@test.com", "Consistent")
    app.dependency_overrides[verify_firebase_token] = user
    first = client.get("/api/me").json()["tenant_id"]
    second = client.get("/api/me").json()["tenant_id"]
    assert first == second


# ---- 5-6: User A cannot access User B's data, and vice versa ----

def test_users_cannot_see_each_others_business_data(client):
    app.dependency_overrides[verify_firebase_token] = _as_user("uid_iso_A", "isoA@test.com", "Iso A")
    client.post("/api/business", data={"business_name": "Isolation Test A", "owner_name": "A"})
    tenant_a = client.get("/api/me").json()["tenant_id"]

    app.dependency_overrides[verify_firebase_token] = _as_user("uid_iso_B", "isoB@test.com", "Iso B")
    client.post("/api/business", data={"business_name": "Isolation Test B", "owner_name": "B"})
    tenant_b = client.get("/api/me").json()["tenant_id"]

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT business_name FROM businesses WHERE tenant_id = %s", (tenant_a,))
            business_a = cur.fetchone()["business_name"]
            cur.execute("SELECT business_name FROM businesses WHERE tenant_id = %s", (tenant_b,))
            business_b = cur.fetchone()["business_name"]
    finally:
        conn.close()

    assert business_a == "Isolation Test A"
    assert business_b == "Isolation Test B"
    assert business_a != business_b


# ---- 7: a client cannot override tenant_id, because there's nowhere to put one ----

def test_client_cannot_supply_a_tenant_id_to_business_endpoint(client):
    app.dependency_overrides[verify_firebase_token] = _as_user("uid_override", "override@test.com", "Override")
    # Even if a client tries to sneak a tenant_id into the form data, the
    # endpoint signature doesn't declare that field at all - FastAPI
    # simply ignores unknown form fields, so this cannot influence which
    # tenant the row is written to. The real tenant_id always comes from
    # _resolve_tenant(), not from this request body.
    r = client.post("/api/business", data={
        "business_name": "Attempted Override",
        "owner_name": "Attacker",
        "tenant_id": "00000000-0000-0000-0000-000000000000",  # ignored - not a real field
    })
    assert r.status_code == 200
    assert r.json()["tenant_id"] != "00000000-0000-0000-0000-000000000000"


def test_client_cannot_supply_a_tenant_id_to_parse_endpoint(client, tmp_path):
    app.dependency_overrides[verify_firebase_token] = _as_user("uid_parse_override", "parseoverride@test.com", "P")
    fake_pdf = tmp_path / "test.pdf"
    fake_pdf.write_bytes(b"%PDF-1.4 fake")

    with open(fake_pdf, "rb") as f:
        r = client.post(
            "/api/parse",
            files={"file": ("test.pdf", f, "application/pdf")},
            data={"document_type": "bank_statement", "tenant_id": "00000000-0000-0000-0000-000000000000"},
        )
    # The parse itself may fail on this fake file's content (not a real
    # bank statement) - what matters here is that IF a tenant_id comes
    # back at all, it's never the attempted override.
    if r.status_code == 200:
        assert r.json()["tenant_id"] != "00000000-0000-0000-0000-000000000000"


# ---- 8: missing token returns 401 ----

def test_missing_token_returns_401_on_every_protected_endpoint(client):
    assert client.get("/api/me").status_code == 401
    assert client.post("/api/business", data={"business_name": "x", "owner_name": "y"}).status_code == 401
    assert client.post("/api/plan", data={"plan_type": "tier", "feature_ids": "x", "price": "1"}).status_code == 401


def test_health_check_remains_public(client):
    """Deliberately not gated - see api.py's comment on why."""
    assert client.get("/api/health").status_code == 200


# ---- 9: invalid token returns 401 - genuinely needs real Firebase credentials ----

@pytest.mark.skipif(
    not os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH"),
    reason="Needs a real Firebase service account configured - see firebase_auth.py docstring.",
)
def test_invalid_token_returns_401(client):
    """
    This is the one isolation requirement that cannot be faked with a
    dependency override, because it's specifically testing Firebase's
    own cryptographic verification, not our business logic. Runs for
    real once FIREBASE_SERVICE_ACCOUNT_PATH is configured; skipped with
    a clear reason otherwise, rather than silently reporting green.
    """
    r = client.get("/api/me", headers={"Authorization": "Bearer not.a.real.token"})
    assert r.status_code == 401
