"""
Step 3: checkout, payment verification, webhook and the paywall
(SPEC.md sections 4, 5 and 9).

Runs against the test database with the mock provider. Same
dependency_overrides approach as the other API tests.
"""

import json
import uuid
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from api import app
from firebase_auth import verify_firebase_token
from db_pool import get_connection
from payments import MockProvider
from checkout_helpers import buy_plan

pytestmark = pytest.mark.db  # uses the test database - see conftest.py


@pytest.fixture(autouse=True)
def clean_overrides():
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    return TestClient(app)


def _sign_in(client):
    """Signs in as a brand-new user; returns their tenant_id."""
    n = uuid.uuid4().hex[:10]
    app.dependency_overrides[verify_firebase_token] = lambda: {"uid": f"uid_pay_{n}", "email": f"pay_{n}@test.com", "name": "Pay"}
    return client.get("/api/me").json()["tenant_id"]


def _row(sql, params):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchone()
    finally:
        conn.close()


def _payments(tenant_id):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT status, amount FROM payments WHERE tenant_id = %s ORDER BY created_at", (tenant_id,))
            return cur.fetchall()
    finally:
        conn.close()


# ---- the happy path ----

def test_successful_payment_activates_the_plan(client):
    tenant_id = _sign_in(client)
    order, verify = buy_plan(client, tier_id="growth", extra_seats=2)

    assert verify.status_code == 200
    assert verify.json() == {"status": "active", "paid": True}
    assert order["amount"] == 6999 + 2 * 499
    assert order["seats_total"] == 6

    me = client.get("/api/me").json()
    assert me["subscription"]["status"] == "active"
    assert me["subscription"]["seats_purchased"] == 6
    assert me["subscription"]["paid_at"]
    assert me["plan"]["seats_included"] == 4 and me["plan"]["extra_seats"] == 2

    assert [(p["status"], p["amount"]) for p in _payments(tenant_id)] == [("paid", Decimal("7997.00"))]
    assert client.get("/api/documents").status_code == 200  # paywall lifted


def test_order_amount_ignores_any_client_price(client):
    tenant_id = _sign_in(client)
    r = client.post("/api/checkout/order", data={
        "plan_type": "tier", "tier_id": "full_suite", "extra_seats": "0",
        "price": "1", "amount": "1", "total": "1", "tenant_id": str(uuid.uuid4()),
    })
    assert r.status_code == 200
    assert r.json()["amount"] == 24999
    sub = _row("SELECT amount FROM subscriptions WHERE tenant_id = %s", (tenant_id,))
    assert sub["amount"] == Decimal("24999.00")
    plan = _row("SELECT price FROM plans WHERE tenant_id = %s", (tenant_id,))
    assert plan["price"] == Decimal("24999.00")


def test_custom_plan_checkout(client):
    _sign_in(client)
    order, verify = buy_plan(client, plan_type="custom", tier_id="", feature_ids="document_parser,whatsapp_alerts", extra_seats=1)
    assert order["amount"] == 1499 + 599 + 499
    assert order["seats_total"] == 3
    assert verify.json()["status"] == "active"


# ---- nothing but a verified payment activates ----

def test_failed_payment_does_not_activate(client):
    tenant_id = _sign_in(client)
    _, verify = buy_plan(client, outcome="fail")
    assert verify.status_code == 200
    assert verify.json() == {"status": "failed", "paid": False}
    assert client.get("/api/me").json()["subscription"]["status"] == "failed"
    assert [p["status"] for p in _payments(tenant_id)] == ["failed"]
    assert client.get("/api/documents").status_code == 402

    # Trying again after a failure works.
    _, verify = buy_plan(client)
    assert verify.json()["status"] == "active"


def test_forged_signature_does_not_activate(client):
    _sign_in(client)
    order = client.post("/api/checkout/order", data={"plan_type": "tier", "tier_id": "starter"}).json()
    r = client.post("/api/checkout/verify", data={"order_id": order["order_id"], "payment_id": "mock_pay_x", "signature": "0" * 64})
    assert r.json()["status"] == "failed"
    assert client.get("/api/me").json()["subscription"]["status"] == "failed"


def test_mock_pay_alone_does_not_activate(client):
    _sign_in(client)
    order = client.post("/api/checkout/order", data={"plan_type": "tier", "tier_id": "starter"}).json()
    client.post("/api/checkout/mock-pay", data={"order_id": order["order_id"], "outcome": "success"})
    assert client.get("/api/me").json()["subscription"]["status"] == "pending"


def test_a_paid_order_cannot_be_verified_twice(client):
    tenant_id = _sign_in(client)
    order = client.post("/api/checkout/order", data={"plan_type": "tier", "tier_id": "starter"}).json()
    paid = client.post("/api/checkout/mock-pay", data={"order_id": order["order_id"], "outcome": "success"}).json()
    form = {"order_id": order["order_id"], "payment_id": paid["payment_id"], "signature": paid["signature"]}
    assert client.post("/api/checkout/verify", data=form).status_code == 200
    assert client.post("/api/checkout/verify", data=form).status_code == 409
    assert len(_payments(tenant_id)) == 1


def test_another_business_cannot_verify_my_order(client):
    my_tenant = _sign_in(client)
    order = client.post("/api/checkout/order", data={"plan_type": "tier", "tier_id": "starter"}).json()
    paid = client.post("/api/checkout/mock-pay", data={"order_id": order["order_id"], "outcome": "success"}).json()

    _sign_in(client)  # someone else
    r = client.post("/api/checkout/verify", data={"order_id": order["order_id"], "payment_id": paid["payment_id"], "signature": paid["signature"]})
    assert r.status_code == 404
    assert _row("SELECT status FROM subscriptions WHERE tenant_id = %s", (my_tenant,))["status"] == "pending"


def test_new_checkout_refused_while_plan_is_active(client):
    _sign_in(client)
    buy_plan(client)
    r = client.post("/api/checkout/order", data={"plan_type": "tier", "tier_id": "growth"})
    assert r.status_code == 409
    assert client.get("/api/me").json()["subscription"]["status"] == "active"


@pytest.mark.parametrize("form", [
    {"plan_type": "tier", "tier_id": "starter", "extra_seats": "21"},
    {"plan_type": "tier", "tier_id": "starter", "extra_seats": "-1"},
    {"plan_type": "tier", "tier_id": "platinum"},
    {"plan_type": "custom", "feature_ids": ""},
])
def test_invalid_order_is_rejected(client, form):
    _sign_in(client)
    assert client.post("/api/checkout/order", data=form).status_code in (400, 422)


# ---- the paywall ----

def test_unpaid_business_is_blocked_from_parse_and_documents(client, tmp_path):
    _sign_in(client)
    client.post("/api/plan", data={"plan_type": "tier", "tier_id": "starter"})  # plan chosen, never paid
    pdf = "tests/sample_statements/test_statement.pdf"
    with open(pdf, "rb") as f:
        r = client.post("/api/parse", files={"file": ("s.pdf", f, "application/pdf")}, data={"document_type": "bank_statement"})
    assert r.status_code == 402
    assert r.json()["error"] == "payment_required"
    assert client.get("/api/documents").status_code == 402
    assert client.get(f"/api/documents/{uuid.uuid4()}").status_code == 402


def test_legacy_subscription_counts_as_active(client):
    tenant_id = _sign_in(client)
    client.post("/api/plan", data={"plan_type": "tier", "tier_id": "growth"})
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO subscriptions (tenant_id, plan_id, seats_purchased, status, amount, provider, paid_at)
                   SELECT tenant_id, id, 4, 'active', price, 'legacy', now() FROM plans WHERE tenant_id = %s""",
                (tenant_id,),
            )
        conn.commit()
    finally:
        conn.close()
    assert client.get("/api/documents").status_code == 200


def test_checkout_endpoints_require_a_token(client):
    assert client.post("/api/checkout/order", data={"plan_type": "tier", "tier_id": "starter"}).status_code == 401
    assert client.post("/api/checkout/verify", data={"order_id": "x", "payment_id": "y"}).status_code == 401
    assert client.post("/api/checkout/mock-pay", data={"order_id": "x", "outcome": "success"}).status_code == 401


# ---- webhook ----

def _webhook(client, payload, signature=None):
    body = json.dumps(payload).encode()
    sig = MockProvider().sign_webhook(body) if signature is None else signature
    return client.post("/api/payments/webhook", content=body, headers={"X-Payment-Signature": sig, "Content-Type": "application/json"})


def test_signed_webhook_activates_and_repeat_is_ignored(client):
    tenant_id = _sign_in(client)
    order = client.post("/api/checkout/order", data={"plan_type": "tier", "tier_id": "starter"}).json()
    app.dependency_overrides.clear()  # the provider calls without any user token

    event = {"order_id": order["order_id"], "payment_id": "mock_pay_hook", "status": "paid"}
    assert _webhook(client, event).json() == {"status": "ok"}
    assert _row("SELECT status FROM subscriptions WHERE tenant_id = %s", (tenant_id,))["status"] == "active"

    assert _webhook(client, event).json()["status"] == "ignored"
    assert len(_payments(tenant_id)) == 1


def test_unsigned_webhook_is_rejected_and_changes_nothing(client):
    tenant_id = _sign_in(client)
    order = client.post("/api/checkout/order", data={"plan_type": "tier", "tier_id": "starter"}).json()
    app.dependency_overrides.clear()

    event = {"order_id": order["order_id"], "payment_id": "mock_pay_evil", "status": "paid"}
    assert _webhook(client, event, signature="forged").status_code == 400
    assert _webhook(client, event, signature="").status_code == 400
    assert _row("SELECT status FROM subscriptions WHERE tenant_id = %s", (tenant_id,))["status"] == "pending"
    assert _payments(tenant_id) == []
