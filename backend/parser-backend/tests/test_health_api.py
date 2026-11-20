"""
Tests for GET /api/health-index - Business Health Index endpoint.
Follows the style of test_anomalies_api.py and test_receivables_api.py.
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


def _new_identity(prefix="hlth"):
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


def _owner_with_plan(client, tier_id="intelligence"):
    """Creates a user and buys a plan. Intelligence and Full Suite include business_health_index."""
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


def _insert_invoice(doc_id: str, tenant_id: str, invoice_number: str, invoice_date: date,
                    total: float, direction="sale", party_name="Customer A",
                    payment_mode="credit", due_date=None, department="finance") -> str:
    row = _sql(
        """
        INSERT INTO invoices (document_id, tenant_id, vendor_name, invoice_number, invoice_date,
                              total, department, direction, party_name, payment_mode, due_date)
        VALUES (%s, %s, 'Vendor', %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
        """,
        (doc_id, tenant_id, invoice_number, invoice_date, Decimal(str(total)),
         department, direction, party_name, payment_mode, due_date),
        fetch="one",
    )
    return str(row["id"])


# a. Owner on Intelligence plan with some bank rows and an overdue invoice: 200, has_data true,
# a score between 0 and 100, 5 components with keys liquidity, cash_trend, receivables, concentration, controls.
def test_health_index_components_and_score(client):
    uid, email, tenant_id = _owner_with_plan(client, tier_id="intelligence")

    doc_bank = _insert_document(tenant_id, "bank_statement")
    _insert_bank_row(doc_bank, tenant_id, 1, date(2025, 4, 1), credit=100000.0, balance=100000.0, category="customer_receipt")
    _insert_bank_row(doc_bank, tenant_id, 2, date(2025, 4, 15), debit=20000.0, balance=80000.0, category="repairs")

    doc_inv = _insert_document(tenant_id, "invoice_bill")
    _insert_invoice(doc_inv, tenant_id, "INV-01", date(2025, 1, 1), total=15000.0,
                    direction="sale", party_name="Apex Ltd", payment_mode="credit", due_date=date(2025, 1, 15))

    res = client.get("/api/health-index?as_of=2025-05-01")
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["has_data"] is True
    assert data["score"] is not None
    assert 0 <= data["score"] <= 100
    assert data["band"] in ("healthy", "watch", "at_risk")

    keys = {c["key"] for c in data["components"]}
    expected_keys = {"liquidity", "cash_trend", "receivables", "concentration", "controls"}
    assert keys == expected_keys
    assert "closing_balance" in data["inputs"]
    assert "anomaly_total" in data["inputs"]


# b. A planted 50,000 owner_drawing makes the "controls" component score below 100.
def test_planted_owner_withdrawal_lowers_controls_score(client):
    uid, email, tenant_id = _owner_with_plan(client, tier_id="intelligence")

    doc_bank = _insert_document(tenant_id, "bank_statement")
    _insert_bank_row(doc_bank, tenant_id, 1, date(2025, 4, 1), credit=100000.0, balance=100000.0)
    _insert_bank_row(doc_bank, tenant_id, 2, date(2025, 4, 10), debit=50000.0, balance=50000.0,
                     category="owner_drawing", description="ATM CASH WDL SELF")

    res = client.get("/api/health-index")
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["has_data"] is True
    controls = next(c for c in data["components"] if c["key"] == "controls")
    assert controls["score"] < 100.0


# c. Empty tenant: 200, has_data false, score null.
def test_empty_tenant_returns_no_score(client):
    uid, email, tenant_id = _owner_with_plan(client, tier_id="intelligence")
    res = client.get("/api/health-index")
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["has_data"] is False
    assert data["score"] is None
    assert data["components"] == []


# d. Tenant isolation: tenant B never sees tenant A's data.
def test_tenant_isolation(client):
    uid_a, email_a, tenant_a = _owner_with_plan(client, tier_id="intelligence")
    doc_a = _insert_document(tenant_a, "bank_statement")
    _insert_bank_row(doc_a, tenant_a, 1, date(2025, 4, 1), credit=500000.0, balance=500000.0)

    uid_b, email_b, tenant_b = _owner_with_plan(client, tier_id="intelligence")
    assert tenant_a != tenant_b

    res_b = client.get("/api/health-index")
    assert res_b.status_code == 200, res_b.text
    data_b = res_b.json()

    assert data_b["has_data"] is False
    assert data_b["score"] is None
    assert data_b["components"] == []


# e. 402 when the plan lacks the feature (starter plan).
def test_access_guard_plan_lacks_feature(client):
    # Unpaid -> 402
    uid_unpaid, email_unpaid = _new_identity("unpaid")
    _as(uid_unpaid, email_unpaid)
    client.get("/api/me")
    res_unpaid = client.get("/api/health-index")
    assert res_unpaid.status_code == 402
    assert res_unpaid.json()["error"] == "payment_required"

    # Starter plan -> 402 or 403
    uid_starter, email_starter, _ = _owner_with_plan(client, tier_id="starter")
    res_starter = client.get("/api/health-index")
    assert res_starter.status_code in (402, 403)


# f. 403 for a non-owner role (finance and sales).
def test_access_guard_non_owner_roles(client):
    uid_intel, email_intel, tenant_id = _owner_with_plan(client, tier_id="intelligence")

    # finance member -> 403
    fin_uid, fin_email = _add_member(tenant_id, "finance")
    _as(fin_uid, fin_email)
    res_fin = client.get("/api/health-index")
    assert res_fin.status_code == 403
    assert res_fin.json()["error"] == "feature_not_available"

    # sales member -> 403
    sales_uid, sales_email = _add_member(tenant_id, "sales")
    _as(sales_uid, sales_email)
    res_sales = client.get("/api/health-index")
    assert res_sales.status_code == 403
    assert res_sales.json()["error"] == "feature_not_available"


# g. Invalid as_of gives 422.
def test_invalid_as_of_gives_422(client):
    uid, email, tenant_id = _owner_with_plan(client, tier_id="intelligence")
    res = client.get("/api/health-index?as_of=bad-date")
    assert res.status_code == 422
    assert res.json()["error"] == "invalid_date"
