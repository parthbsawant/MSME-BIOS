"""
Tests for GET /api/dashboard/cash - cash dashboard endpoint.
Follows the style of test_access.py and test_tenant_isolation.py.
"""

import uuid
from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from api import app
from checkout_helpers import buy_plan
from db_pool import get_connection
from firebase_auth import verify_firebase_token

pytestmark = pytest.mark.db  # uses the test database - see conftest.py


@pytest.fixture(autouse=True)
def clean_overrides():
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    return TestClient(app)


def _as(uid: str, email: str):
    app.dependency_overrides[verify_firebase_token] = lambda: {"uid": uid, "email": email, "name": "Test User"}


def _new_identity(prefix="cash"):
    n = uuid.uuid4().hex[:10]
    return f"uid_{prefix}_{n}", f"{prefix}_{n}@test.com"


def _sql(sql: str, params=(), fetch=None):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            result = cur.fetchall() if fetch == "all" else cur.fetchone() if fetch == "one" else None
        conn.commit()
        return result
    finally:
        conn.close()


def _owner_with_plan(client, tier_id="starter"):
    """Creates a user and buys a plan. Returns (uid, email, tenant_id)."""
    uid, email = _new_identity("own")
    _as(uid, email)
    tenant_id = client.get("/api/me").json()["tenant_id"]
    order, verify = buy_plan(client, tier_id=tier_id)
    assert verify.json()["status"] == "active"
    return uid, email, tenant_id


def _add_member(tenant_id: str, role: str, status="active"):
    """Inserts a member directly into user_tenants."""
    uid, email = _new_identity(role)
    user_id = _sql("INSERT INTO users (firebase_uid, email) VALUES (%s, %s) RETURNING id", (uid, email), "one")["id"]
    _sql("INSERT INTO user_tenants (user_id, tenant_id, role, status) VALUES (%s, %s, %s, %s)", (user_id, tenant_id, role, status))
    return uid, email


def _insert_document(tenant_id: str, department="finance") -> str:
    row = _sql(
        """
        INSERT INTO documents (tenant_id, source_type, source_file, extraction_method, extracted_at, department)
        VALUES (%s, 'bank_statement', 'statement.pdf', 'pdfplumber', now(), %s)
        RETURNING id
        """,
        (tenant_id, department),
        fetch="one",
    )
    return str(row["id"])


def _insert_bank_row(document_id: str, tenant_id: str, line_no: int, txn_date: date,
                     debit=None, credit=None, balance=None, category=None, department="finance"):
    _sql(
        """
        INSERT INTO bank_transactions (document_id, tenant_id, line_no, txn_date, description,
                                       debit, credit, balance, category, department)
        VALUES (%s, %s, %s, %s, 'Txn description', %s, %s, %s, %s, %s)
        """,
        (
            document_id, tenant_id, line_no, txn_date,
            Decimal(str(debit)) if debit is not None else None,
            Decimal(str(credit)) if credit is not None else None,
            Decimal(str(balance)) if balance is not None else None,
            category, department,
        ),
    )


# a) tenant A with bank rows gets the right money_in, money_out and closing_balance
def test_tenant_with_bank_rows_gets_correct_summary(client):
    uid, email, tenant_id = _owner_with_plan(client, tier_id="starter")
    doc_id = _insert_document(tenant_id, department="finance")

    _insert_bank_row(doc_id, tenant_id, line_no=1, txn_date=date(2025, 4, 1),
                     credit=10000.00, debit=None, balance=10000.00, category="customer_receipt")
    _insert_bank_row(doc_id, tenant_id, line_no=2, txn_date=date(2025, 4, 5),
                     credit=None, debit=4000.00, balance=6000.00, category="supplier_payment")

    res = client.get("/api/dashboard/cash")
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["has_data"] is True
    assert data["money_in"] == 10000.0
    assert data["money_out"] == 4000.0
    assert data["closing_balance"] == 6000.0
    assert data["net"] == 6000.0
    assert data["as_of"] == "2025-04-05"
    assert data["documents_count"] == 1
    assert data["row_count"] == 2
    assert len(data["months"]) == 1
    assert data["months"][0]["month"] == "2025-04"
    assert data["months"][0]["closing_balance"] == 6000.0


# b) tenant B with no rows gets has_data false
def test_tenant_with_no_rows_gets_has_data_false(client):
    uid, email, tenant_id = _owner_with_plan(client, tier_id="starter")

    res = client.get("/api/dashboard/cash")
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["has_data"] is False
    assert data["closing_balance"] == 0.0
    assert data["money_in"] == 0.0
    assert data["money_out"] == 0.0
    assert data["net"] == 0.0
    assert data["as_of"] is None
    assert data["months"] == []
    assert data["documents_count"] == 0


# c) tenant B can NOT see tenant A's data (isolation test)
def test_tenant_b_cannot_see_tenant_a_cash_data(client):
    # Setup Tenant A with bank rows
    uid_a, email_a, tenant_a = _owner_with_plan(client, tier_id="starter")
    doc_a = _insert_document(tenant_a, department="finance")
    _insert_bank_row(doc_a, tenant_a, line_no=1, txn_date=date(2025, 4, 1),
                     credit=50000.00, balance=50000.00, category="customer_receipt")

    # Verify Tenant A sees the data
    res_a = client.get("/api/dashboard/cash")
    assert res_a.status_code == 200
    assert res_a.json()["money_in"] == 50000.0
    assert res_a.json()["documents_count"] == 1

    # Setup Tenant B with no rows
    uid_b, email_b, tenant_b = _owner_with_plan(client, tier_id="starter")
    assert tenant_a != tenant_b

    # Verify Tenant B sees NO data from Tenant A
    res_b = client.get("/api/dashboard/cash")
    assert res_b.status_code == 200
    data_b = res_b.json()
    assert data_b["has_data"] is False
    assert data_b["money_in"] == 0.0
    assert data_b["closing_balance"] == 0.0
    assert data_b["documents_count"] == 0
    assert data_b["row_count"] == 0


# d) a business without the cash_dashboard feature gets 403, and a business with no active plan gets 402
def test_no_plan_gets_402_and_plan_without_feature_gets_403(client):
    # Unpaid business -> 402
    uid_unpaid, email_unpaid = _new_identity("unpaid")
    _as(uid_unpaid, email_unpaid)
    client.get("/api/me")  # creates business/tenant
    res_unpaid = client.get("/api/dashboard/cash")
    assert res_unpaid.status_code == 402
    assert res_unpaid.json()["error"] == "payment_required"

    # Business with custom plan without cash_dashboard -> 403
    uid_custom, email_custom = _new_identity("custom")
    _as(uid_custom, email_custom)
    client.get("/api/me")
    order, verify = buy_plan(client, plan_type="custom", tier_id="", feature_ids="invoice_generator")
    assert verify.json()["status"] == "active"
    res_custom = client.get("/api/dashboard/cash")
    assert res_custom.status_code == 403
    assert res_custom.json()["error"] == "feature_not_available"


# e) a member with the sales role gets 403
def test_member_with_sales_role_gets_403(client):
    _, _, tenant_id = _owner_with_plan(client, tier_id="growth")
    sales_uid, sales_email = _add_member(tenant_id, "sales")
    _as(sales_uid, sales_email)

    res = client.get("/api/dashboard/cash")
    assert res.status_code == 403
    assert res.json()["error"] == "feature_not_available"
