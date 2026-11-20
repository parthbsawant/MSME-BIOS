"""
Tests for GET /api/pnl - Cash-basis Profit & Loss statement endpoint.
Follows the style of test_anomalies_api.py and test_revenue_concentration_api.py.
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


def _new_identity(prefix="pnl"):
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


def _owner_with_plan(client, tier_id="growth"):
    """Creates a user and buys a plan. Growth, Intelligence and Full Suite include pnl_statement."""
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


def _insert_document(tenant_id: str, source_type="bank_statement", department="finance") -> str:
    row = _sql(
        """
        INSERT INTO documents (tenant_id, source_type, source_file, extraction_method, extracted_at, department)
        VALUES (%s, %s, 'doc.pdf', 'pdfplumber', now(), %s)
        RETURNING id
        """,
        (tenant_id, source_type, department),
        fetch="one",
    )
    return str(row["id"])


def _insert_bank_row(document_id: str, tenant_id: str, line_no: int, txn_date: date,
                     debit=None, credit=None, balance=None, category=None,
                     description="Txn", counterparty=None, department="finance") -> str:
    row = _sql(
        """
        INSERT INTO bank_transactions (document_id, tenant_id, line_no, txn_date, description,
                                       debit, credit, balance, category, counterparty, department)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
        """,
        (
            document_id, tenant_id, line_no, txn_date, description,
            Decimal(str(debit)) if debit is not None else None,
            Decimal(str(credit)) if credit is not None else None,
            Decimal(str(balance)) if balance is not None else None,
            category, counterparty, department,
        ),
        fetch="one",
    )
    return str(row["id"])


# a. Finance (or owner) on Growth/Full plan with bank rows:
# collection credit 100000, supplier_payment debit 60000, salary debit 10000, emi debit 5000, owner_drawing debit 20000
# 200, totals.revenue 100000, gross_profit 40000, net_profit 25000, memo.owner_drawings 20000.
def test_pnl_statement_calculation(client):
    uid, email, tenant_id = _owner_with_plan(client, tier_id="growth")

    # Add and authenticate as finance member
    fin_uid, fin_email = _add_member(tenant_id, "finance")
    _as(fin_uid, fin_email)

    doc = _insert_document(tenant_id, "bank_statement")
    _insert_bank_row(doc, tenant_id, 1, date(2025, 5, 2), credit=100000.0, category="collection")
    _insert_bank_row(doc, tenant_id, 2, date(2025, 5, 5), debit=60000.0, category="supplier_payment")
    _insert_bank_row(doc, tenant_id, 3, date(2025, 5, 10), debit=10000.0, category="salary")
    _insert_bank_row(doc, tenant_id, 4, date(2025, 5, 15), debit=5000.0, category="emi")
    _insert_bank_row(doc, tenant_id, 5, date(2025, 5, 20), debit=20000.0, category="owner_drawing")

    res = client.get("/api/pnl")
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["has_data"] is True
    assert data["totals"]["revenue"] == 100000.0
    assert data["totals"]["gross_profit"] == 40000.0
    assert data["totals"]["net_profit"] == 25000.0
    assert data["memo"]["owner_drawings"] == 20000.0
    assert data["available_from"] == "2025-05-02"
    assert data["available_to"] == "2025-05-20"


# b. The from/to filter limits the totals (rows in two different months).
def test_pnl_from_to_filter(client):
    uid, email, tenant_id = _owner_with_plan(client, tier_id="growth")
    doc = _insert_document(tenant_id, "bank_statement")

    # Month 1: May 2025 (100k revenue, 50k purchases)
    _insert_bank_row(doc, tenant_id, 1, date(2025, 5, 10), credit=100000.0, category="collection")
    _insert_bank_row(doc, tenant_id, 2, date(2025, 5, 15), debit=50000.0, category="supplier_payment")

    # Month 2: June 2025 (40k revenue, 10k purchases)
    _insert_bank_row(doc, tenant_id, 3, date(2025, 6, 5), credit=40000.0, category="sales_upi")
    _insert_bank_row(doc, tenant_id, 4, date(2025, 6, 12), debit=10000.0, category="supplier_payment")

    # Filter to June only
    res = client.get("/api/pnl?from=2025-06-01&to=2025-06-30")
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["has_data"] is True
    assert data["totals"]["revenue"] == 40000.0
    assert data["totals"]["purchases"] == 10000.0
    assert data["totals"]["gross_profit"] == 30000.0
    assert data["available_from"] == "2025-05-10"
    assert data["available_to"] == "2025-06-12"


# c. Empty tenant: 200, has_data false.
def test_pnl_empty_tenant(client):
    uid, email, tenant_id = _owner_with_plan(client, tier_id="growth")
    res = client.get("/api/pnl")
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["has_data"] is False
    assert data["available_from"] is None
    assert data["available_to"] is None


# d. Tenant isolation.
def test_pnl_tenant_isolation(client):
    uid_a, email_a, tenant_a = _owner_with_plan(client, tier_id="growth")
    doc_a = _insert_document(tenant_a, "bank_statement")
    _insert_bank_row(doc_a, tenant_a, 1, date(2025, 5, 10), credit=150000.0, category="collection")

    uid_b, email_b, tenant_b = _owner_with_plan(client, tier_id="growth")
    assert tenant_a != tenant_b

    # Tenant B has no rows
    res_b = client.get("/api/pnl")
    assert res_b.status_code == 200, res_b.text
    assert res_b.json()["has_data"] is False


# e. 402 on a plan without the feature (Starter).
def test_pnl_plan_lacks_feature(client):
    # Unpaid -> 402
    uid_unpaid, email_unpaid = _new_identity("unpaid")
    _as(uid_unpaid, email_unpaid)
    client.get("/api/me")
    res_unpaid = client.get("/api/pnl")
    assert res_unpaid.status_code == 402
    assert res_unpaid.json()["error"] == "payment_required"

    # Starter plan lacks pnl_statement -> 402 or 403
    uid_starter, email_starter, _ = _owner_with_plan(client, tier_id="starter")
    res_starter = client.get("/api/pnl")
    assert res_starter.status_code in (402, 403)


# f. 403 for a non-allowed role (sales or hr).
def test_pnl_disallowed_roles(client):
    uid_growth, email_growth, tenant_id = _owner_with_plan(client, tier_id="growth")

    # sales member -> 403
    sales_uid, sales_email = _add_member(tenant_id, "sales")
    _as(sales_uid, sales_email)
    res_sales = client.get("/api/pnl")
    assert res_sales.status_code == 403
    assert res_sales.json()["error"] == "feature_not_available"

    # hr member -> 403
    hr_uid, hr_email = _add_member(tenant_id, "hr")
    _as(hr_uid, hr_email)
    res_hr = client.get("/api/pnl")
    assert res_hr.status_code == 403
    assert res_hr.json()["error"] == "feature_not_available"


# g. Invalid date gives 422 invalid_date, and from > to gives 422 invalid_range.
def test_pnl_invalid_date_and_range(client):
    uid, email, tenant_id = _owner_with_plan(client, tier_id="growth")

    # Invalid from date
    res_bad_from = client.get("/api/pnl?from=not-a-date")
    assert res_bad_from.status_code == 422
    assert res_bad_from.json()["error"] == "invalid_date"

    # Invalid to date
    res_bad_to = client.get("/api/pnl?to=2025-13-45")
    assert res_bad_to.status_code == 422
    assert res_bad_to.json()["error"] == "invalid_date"

    # from > to gives invalid_range
    res_bad_range = client.get("/api/pnl?from=2025-06-30&to=2025-06-01")
    assert res_bad_range.status_code == 422
    assert res_bad_range.json()["error"] == "invalid_range"
