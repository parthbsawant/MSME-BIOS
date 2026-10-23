"""
/api/me must report this tenant's saved business and plan, so the
frontend can tell on ANY browser whether onboarding is finished.

Uses the same dependency_overrides approach as test_tenant_isolation.py
(no live Firebase needed). Uses unique @test.com users per run.
"""

import uuid

import pytest
from fastapi.testclient import TestClient

from api import app
from firebase_auth import verify_firebase_token


@pytest.fixture(autouse=True)
def clean_overrides():
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    return TestClient(app)


def _as_user(uid, email):
    app.dependency_overrides[verify_firebase_token] = lambda: {"uid": uid, "email": email, "name": "T"}


def _fresh():
    n = uuid.uuid4().hex[:10]
    return f"uid_me_{n}", f"me_{n}@test.com"


def test_new_user_has_no_business_and_no_plan(client):
    uid, email = _fresh()
    _as_user(uid, email)
    body = client.get("/api/me").json()
    assert body["business"] is None
    assert body["plan"] is None


def test_me_returns_saved_business_and_tier_plan(client):
    uid, email = _fresh()
    _as_user(uid, email)
    r = client.post("/api/business", data={
        "business_name": "Mauli Traders", "owner_name": "Parth",
        "business_type": "Wholesale trader", "annual_turnover": "₹5 crore – ₹50 crore",
        "city": "Sangli", "gstin": "27ABCDE1234F1Z5"})
    assert r.status_code == 200
    r = client.post("/api/plan", data={
        "plan_type": "tier", "tier_id": "growth",
        "feature_ids": "document_parser,cash_dashboard", "price": "6999"})
    assert r.status_code == 200

    body = client.get("/api/me").json()
    assert body["business"]["business_name"] == "Mauli Traders"
    assert body["business"]["city"] == "Sangli"
    assert body["plan"] == {"plan_type": "tier", "tier_id": "growth",
                            "feature_ids": ["document_parser", "cash_dashboard"], "price": 6999.0}


def test_me_returns_custom_plan_without_tier(client):
    uid, email = _fresh()
    _as_user(uid, email)
    client.post("/api/business", data={"business_name": "B", "owner_name": "O"})
    client.post("/api/plan", data={"plan_type": "custom", "feature_ids": "document_parser", "price": "1499"})
    plan = client.get("/api/me").json()["plan"]
    assert plan["plan_type"] == "custom"
    assert plan["tier_id"] is None


def test_me_never_leaks_another_tenants_data(client):
    a_uid, a_email = _fresh()
    _as_user(a_uid, a_email)
    client.post("/api/business", data={"business_name": "Secret A", "owner_name": "A"})
    client.post("/api/plan", data={"plan_type": "custom", "feature_ids": "document_parser", "price": "1499"})

    b_uid, b_email = _fresh()
    _as_user(b_uid, b_email)
    body = client.get("/api/me").json()
    assert body["business"] is None
    assert body["plan"] is None
