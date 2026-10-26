"""
Step 4 (4c + 4d): roles, department separation, owner-only endpoints,
deactivated members and tenant resolution with pending invitations
(SPEC.md sections 3, 6 and 9).

Members are inserted straight into the test database here; the invite
flow that normally creates them is tested in test_team.py.
"""

import hashlib
import uuid

import pytest
from fastapi.testclient import TestClient

from api import app
from firebase_auth import verify_firebase_token
from db_pool import get_connection
from checkout_helpers import buy_plan

pytestmark = pytest.mark.db  # uses the test database - see conftest.py

BANK_PDF = "tests/sample_statements/test_statement.pdf"


@pytest.fixture(autouse=True)
def clean_overrides():
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    return TestClient(app)


def _as(uid, email):
    app.dependency_overrides[verify_firebase_token] = lambda: {"uid": uid, "email": email, "name": "T"}


def _new_identity(prefix="acc"):
    n = uuid.uuid4().hex[:10]
    return f"uid_{prefix}_{n}", f"{prefix}_{n}@test.com"


def _sql(sql, params=(), fetch=None):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            result = cur.fetchall() if fetch == "all" else cur.fetchone() if fetch == "one" else None
        conn.commit()
        return result
    finally:
        conn.close()


def _owner_with_plan(client, tier_id="growth"):
    """A paid business. Returns (owner_uid, owner_email, tenant_id)."""
    uid, email = _new_identity("own")
    _as(uid, email)
    tenant_id = client.get("/api/me").json()["tenant_id"]
    assert buy_plan(client, tier_id=tier_id)[1].json()["status"] == "active"
    return uid, email, tenant_id


def _add_member(tenant_id, role, status="active"):
    """Inserts a member directly (the invite flow is tested elsewhere)."""
    uid, email = _new_identity(role)
    user_id = _sql("INSERT INTO users (firebase_uid, email) VALUES (%s, %s) RETURNING id", (uid, email), "one")["id"]
    _sql("INSERT INTO user_tenants (user_id, tenant_id, role, status) VALUES (%s, %s, %s, %s)", (user_id, tenant_id, role, status))
    return uid, email


def _upload(client, **extra):
    with open(BANK_PDF, "rb") as f:
        return client.post("/api/parse", files={"file": ("s.pdf", f, "application/pdf")},
                           data={"document_type": "bank_statement", **extra})


# ---- /api/me tells the frontend who you are ----

def test_me_reports_owner_role_and_effective_features(client):
    _owner_with_plan(client, tier_id="growth")
    me = client.get("/api/me").json()
    assert me["role"] == "owner"
    assert me["department"] is None
    assert me["status"] == "active"
    assert me["invite_pending"] is False
    assert "receivables_payables" in me["effective_features"]
    assert me["subscription"]["amount"] == 6999  # owner sees billing data


def test_me_for_member_hides_billing_details(client):
    _, _, tenant_id = _owner_with_plan(client, tier_id="growth")
    _as(*_add_member(tenant_id, "sales"))
    me = client.get("/api/me").json()
    assert me["tenant_id"] == tenant_id
    assert me["role"] == "sales" and me["department"] == "sales"
    # Growth has invoice_generator but not revenue_concentration/demand_forecasting.
    assert me["effective_features"] == ["invoice_generator"]
    assert me["subscription"] == {"status": "active"}
    assert set(me["plan"]) == {"plan_type", "tier_id", "feature_ids"}


# ---- department separation inside one business ----

def test_finance_member_sees_only_finance_documents(client):
    owner_uid, owner_email, tenant_id = _owner_with_plan(client)
    finance_doc = _upload(client, department="finance").json()["document_id"]
    hr_doc = _upload(client, department="hr").json()["document_id"]

    _as(*_add_member(tenant_id, "finance"))
    listed = {d["document_id"] for d in client.get("/api/documents").json()["documents"]}
    assert finance_doc in listed and hr_doc not in listed
    assert client.get(f"/api/documents/{finance_doc}").status_code == 200
    assert client.get(f"/api/documents/{hr_doc}").status_code == 404  # same as nonexistent


def test_hr_member_sees_only_hr_documents(client):
    _, _, tenant_id = _owner_with_plan(client)
    finance_doc = _upload(client, department="finance").json()["document_id"]
    hr_doc = _upload(client, department="hr").json()["document_id"]

    _as(*_add_member(tenant_id, "hr"))
    listed = {d["document_id"] for d in client.get("/api/documents").json()["documents"]}
    assert listed == {hr_doc}
    assert client.get(f"/api/documents/{finance_doc}").status_code == 404


def test_owner_sees_all_departments(client):
    owner_uid, owner_email, tenant_id = _owner_with_plan(client)
    owner_docs = {_upload(client, department=d).json()["document_id"] for d in ("finance", "hr")}
    _as(*_add_member(tenant_id, "hr"))
    hr_member_doc = _upload(client).json()["document_id"]

    _as(owner_uid, owner_email)
    listed = {d["document_id"] for d in client.get("/api/documents").json()["documents"]}
    assert listed == owner_docs | {hr_member_doc}


def test_member_upload_always_goes_to_their_own_department(client):
    _, _, tenant_id = _owner_with_plan(client)
    _as(*_add_member(tenant_id, "finance"))
    r = _upload(client, department="hr")  # tries to file it under HR
    assert r.status_code == 200
    assert r.json()["department"] == "finance"
    row = _sql("SELECT department FROM documents WHERE id = %s", (r.json()["document_id"],), "one")
    assert row["department"] == "finance"


def test_member_upload_records_the_member_as_uploader(client):
    _, _, tenant_id = _owner_with_plan(client)
    uid, email = _add_member(tenant_id, "hr")
    _as(uid, email)
    document_id = _upload(client).json()["document_id"]
    row = _sql("""SELECT u.firebase_uid FROM documents d JOIN users u ON u.id = d.uploaded_by
                  WHERE d.id = %s""", (document_id,), "one")
    assert row["firebase_uid"] == uid


def test_role_without_document_parser_cannot_upload(client):
    _, _, tenant_id = _owner_with_plan(client, tier_id="full_suite")
    _as(*_add_member(tenant_id, "sales"))
    r = _upload(client)
    assert r.status_code == 403
    assert r.json()["error"] == "feature_not_available"


def test_feature_not_in_plan_blocks_even_the_owner(client):
    uid, email = _new_identity("own")
    _as(uid, email)
    client.get("/api/me")
    buy_plan(client, plan_type="custom", tier_id="", feature_ids="invoice_generator")
    r = _upload(client)
    assert r.status_code == 403
    assert r.json()["error"] == "feature_not_available"


# ---- owner-only endpoints ----

@pytest.mark.parametrize("role", ["finance", "sales", "hr", "marketing"])
def test_members_cannot_manage_business_plan_or_checkout(client, role):
    _, _, tenant_id = _owner_with_plan(client)
    _as(*_add_member(tenant_id, role))
    calls = [
        client.post("/api/business", data={"business_name": "Hijack", "owner_name": "X"}),
        client.post("/api/plan", data={"plan_type": "tier", "tier_id": "starter"}),
        client.post("/api/checkout/order", data={"plan_type": "tier", "tier_id": "starter"}),
        client.post("/api/checkout/verify", data={"order_id": "x", "payment_id": "y"}),
        client.post("/api/checkout/mock-pay", data={"order_id": "x", "outcome": "success"}),
    ]
    for r in calls:
        assert r.status_code == 403, r.text
        assert r.json()["error"] == "owner_only"
    assert _sql("SELECT count(*) AS n FROM businesses WHERE business_name = 'Hijack'", (), "one")["n"] == 0


# ---- deactivated members are locked out ----

def test_deactivated_member_gets_403_everywhere(client):
    _, _, tenant_id = _owner_with_plan(client)
    _as(*_add_member(tenant_id, "finance", status="deactivated"))
    for r in (client.get("/api/me"), client.get("/api/documents"), _upload(client)):
        assert r.status_code == 403
        assert r.json()["error"] == "deactivated"


def test_members_of_an_unpaid_business_get_402(client):
    uid, email = _new_identity("own")
    _as(uid, email)
    tenant_id = client.get("/api/me").json()["tenant_id"]  # never pays
    _as(*_add_member(tenant_id, "finance"))
    assert client.get("/api/documents").status_code == 402
    assert _upload(client).status_code == 402


# ---- tenant resolution: invitees do not get a business of their own ----

def _invite_row(tenant_id, email, expires_sql="now() + interval '7 days'", status="pending"):
    token_hash = hashlib.sha256(uuid.uuid4().bytes).hexdigest()
    _sql(f"""INSERT INTO invitations (tenant_id, email, role, token_hash, status, expires_at)
             VALUES (%s, %s, 'finance', %s, %s, {expires_sql})""", (tenant_id, email, token_hash, status))


def test_invitee_signing_in_gets_no_business_of_their_own(client):
    _, _, tenant_id = _owner_with_plan(client)
    uid, email = _new_identity("invitee")
    _invite_row(tenant_id, email)  # invitations store emails lower-case

    _as(uid, email.upper())  # the email on the sign-in can differ in case
    me = client.get("/api/me").json()
    assert me["invite_pending"] is True

    _as(uid, email)
    me = client.get("/api/me").json()
    assert me["invite_pending"] is True
    assert me["tenant_id"] is None and me["role"] is None
    assert _sql("""SELECT count(*) AS n FROM user_tenants ut JOIN users u ON u.id = ut.user_id
                   WHERE u.firebase_uid = %s""", (uid,), "one")["n"] == 0
    r = client.get("/api/documents")
    assert r.status_code == 403 and r.json()["error"] == "invite_pending"


def test_expired_or_revoked_invite_does_not_block_normal_signup(client):
    _, _, tenant_id = _owner_with_plan(client)
    for kwargs in ({"expires_sql": "now() - interval '1 day'"}, {"status": "revoked"}):
        uid, email = _new_identity("late")
        _invite_row(tenant_id, email, **kwargs)
        _as(uid, email)
        me = client.get("/api/me").json()
        assert me["invite_pending"] is False
        assert me["role"] == "owner" and me["tenant_id"] not in (None, tenant_id)
