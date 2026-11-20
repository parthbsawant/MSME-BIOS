"""
Tests for GET /api/revenue-concentration - revenue concentration endpoint.
Follows the style of test_receivables_api.py and test_cash_dashboard_api.py.
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


def _new_identity(prefix="conc"):
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
    """Creates a user and buys a plan. Intelligence tier includes revenue_concentration."""
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


def _insert_document(tenant_id: str, source_type="invoice_bill", department="finance") -> str:
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


# a) shares and ranking for one tenant (use 3 customers)
def test_shares_and_ranking_for_three_customers(client):
    uid, email, tenant_id = _owner_with_plan(client, tier_id="intelligence")
    doc_1 = _insert_document(tenant_id, "invoice_bill")
    doc_2 = _insert_document(tenant_id, "invoice_bill")
    doc_3 = _insert_document(tenant_id, "invoice_bill")

    _insert_invoice(doc_1, tenant_id, "INV-001", date(2025, 4, 1),
                    total=500.0, direction="sale", party_name="Customer A")
    _insert_invoice(doc_2, tenant_id, "INV-002", date(2025, 4, 2),
                    total=300.0, direction="sale", party_name="Customer B")
    _insert_invoice(doc_3, tenant_id, "INV-003", date(2025, 4, 3),
                    total=200.0, direction="sale", party_name="Customer C")

    res = client.get("/api/revenue-concentration")
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["has_data"] is True
    assert data["total_sales"] == 1000.0
    assert data["customer_count"] == 3
    assert data["invoice_count"] == 3
    assert data["top1_pct"] == 50.0
    assert data["top3_pct"] == 100.0
    assert [c["customer"] for c in data["top_customers"]] == ["Customer A", "Customer B", "Customer C"]
    assert data["top_customers"][0]["sales"] == 500.0
    assert data["top_customers"][0]["share_pct"] == 50.0
    assert data["top_customers"][1]["cumulative_pct"] == 80.0
    assert data["top_customers"][2]["cumulative_pct"] == 100.0
    assert data["data_from"] == "2025-04-01"
    assert data["data_to"] == "2025-04-03"
    assert data["from"] is None
    assert data["to"] is None


# b) cash and UPI sale invoices are included in the totals
def test_cash_and_upi_sales_included(client):
    uid, email, tenant_id = _owner_with_plan(client, tier_id="intelligence")
    doc_1 = _insert_document(tenant_id, "invoice_bill")
    doc_2 = _insert_document(tenant_id, "invoice_bill")
    doc_3 = _insert_document(tenant_id, "invoice_bill")

    _insert_invoice(doc_1, tenant_id, "INV-CR", date(2025, 4, 1),
                    total=500.0, direction="sale", party_name="Alpha", payment_mode="credit")
    _insert_invoice(doc_2, tenant_id, "INV-CS", date(2025, 4, 2),
                    total=300.0, direction="sale", party_name="Alpha", payment_mode="cash")
    _insert_invoice(doc_3, tenant_id, "INV-UP", date(2025, 4, 3),
                    total=200.0, direction="sale", party_name="Beta", payment_mode="upi")

    res = client.get("/api/revenue-concentration")
    assert res.status_code == 200
    data = res.json()

    assert data["total_sales"] == 1000.0
    assert data["customer_count"] == 2
    assert data["top_customers"][0]["customer"] == "Alpha"
    assert data["top_customers"][0]["sales"] == 800.0
    assert data["top_customers"][0]["invoice_count"] == 2
    assert data["top_customers"][1]["customer"] == "Beta"
    assert data["top_customers"][1]["sales"] == 200.0


# c) a purchase invoice is NOT included
def test_purchase_invoice_excluded(client):
    uid, email, tenant_id = _owner_with_plan(client, tier_id="intelligence")
    doc_1 = _insert_document(tenant_id, "invoice_bill")
    doc_2 = _insert_document(tenant_id, "invoice_bill")

    _insert_invoice(doc_1, tenant_id, "INV-SALE", date(2025, 4, 1),
                    total=600.0, direction="sale", party_name="Customer A")
    _insert_invoice(doc_2, tenant_id, "INV-PUR", date(2025, 4, 2),
                    total=400.0, direction="purchase", party_name="Supplier B")

    res = client.get("/api/revenue-concentration")
    assert res.status_code == 200
    data = res.json()

    assert data["total_sales"] == 600.0
    assert data["customer_count"] == 1
    assert data["top_customers"][0]["customer"] == "Customer A"


# d) walk-in customer invoices are counted in total sales but not ranked as a customer
def test_walkin_customer_counted_not_ranked(client):
    uid, email, tenant_id = _owner_with_plan(client, tier_id="intelligence")
    doc_1 = _insert_document(tenant_id, "invoice_bill")
    doc_2 = _insert_document(tenant_id, "invoice_bill")

    _insert_invoice(doc_1, tenant_id, "INV-WALK", date(2025, 4, 1),
                    total=200.0, direction="sale", party_name="Walk-in Customer")
    _insert_invoice(doc_2, tenant_id, "INV-REAL", date(2025, 4, 2),
                    total=800.0, direction="sale", party_name="Real Customer")

    res = client.get("/api/revenue-concentration")
    assert res.status_code == 200
    data = res.json()

    assert data["total_sales"] == 1000.0
    assert data["customer_count"] == 1
    assert data["unattributed_pct"] == 20.0
    assert len(data["top_customers"]) == 1
    assert data["top_customers"][0]["customer"] == "Real Customer"
    assert data["top_customers"][0]["share_pct"] == 80.0


# e) from/to date filter works; a bad date gives 422
def test_from_to_filter_and_validation(client):
    uid, email, tenant_id = _owner_with_plan(client, tier_id="intelligence")
    doc_1 = _insert_document(tenant_id, "invoice_bill")
    doc_2 = _insert_document(tenant_id, "invoice_bill")
    doc_3 = _insert_document(tenant_id, "invoice_bill")

    _insert_invoice(doc_1, tenant_id, "INV-1", date(2025, 1, 10),
                    total=100.0, direction="sale", party_name="A")
    _insert_invoice(doc_2, tenant_id, "INV-2", date(2025, 2, 10),
                    total=200.0, direction="sale", party_name="B")
    _insert_invoice(doc_3, tenant_id, "INV-3", date(2025, 3, 10),
                    total=300.0, direction="sale", party_name="C")

    # Bad date -> 422
    bad_from = client.get("/api/revenue-concentration?from=invalid")
    assert bad_from.status_code == 422
    assert bad_from.json()["error"] == "invalid_date"

    bad_to = client.get("/api/revenue-concentration?to=invalid")
    assert bad_to.status_code == 422
    assert bad_to.json()["error"] == "invalid_date"

    # Filter 2025-02-01 to 2025-03-15 -> only B and C
    res = client.get("/api/revenue-concentration?from=2025-02-01&to=2025-03-15")
    assert res.status_code == 200
    data = res.json()

    assert data["total_sales"] == 500.0
    assert data["customer_count"] == 2
    assert data["from"] == "2025-02-01"
    assert data["to"] == "2025-03-15"
    assert data["data_from"] == "2025-01-10"
    assert data["data_to"] == "2025-03-10"


# f) tenant isolation
def test_tenant_isolation(client):
    uid_a, email_a, tenant_a = _owner_with_plan(client, tier_id="intelligence")
    doc_a = _insert_document(tenant_a, "invoice_bill")
    _insert_invoice(doc_a, tenant_a, "INV-A", date(2025, 4, 1),
                    total=1000.0, direction="sale", party_name="A")

    uid_b, email_b, tenant_b = _owner_with_plan(client, tier_id="intelligence")
    assert tenant_a != tenant_b

    res_b = client.get("/api/revenue-concentration")
    assert res_b.status_code == 200
    data_b = res_b.json()

    assert data_b["has_data"] is False
    assert data_b["total_sales"] == 0.0
    assert data_b["customer_count"] == 0
    assert data_b["top_customers"] == []


# g) 402 without a plan
def test_access_guard_402_without_plan(client):
    uid_unpaid, email_unpaid = _new_identity("unpaid")
    _as(uid_unpaid, email_unpaid)
    client.get("/api/me")
    res = client.get("/api/revenue-concentration")
    assert res.status_code == 402
    assert res.json()["error"] == "payment_required"


# h) 403 on a plan without the feature
def test_access_guard_403_plan_without_feature(client):
    # Growth plan does NOT include revenue_concentration (only intelligence & full_suite)
    uid_growth, email_growth, _ = _owner_with_plan(client, tier_id="growth")
    res = client.get("/api/revenue-concentration")
    assert res.status_code == 403
    assert res.json()["error"] == "feature_not_available"


# i) finance-role member gets 403
def test_access_guard_403_finance_role(client):
    uid_intel, email_intel, tenant_intel = _owner_with_plan(client, tier_id="intelligence")
    fin_uid, fin_email = _add_member(tenant_intel, "finance")
    _as(fin_uid, fin_email)
    res = client.get("/api/revenue-concentration")
    assert res.status_code == 403
    assert res.json()["error"] == "feature_not_available"


# j) sales-role member gets 200
def test_access_200_sales_role(client):
    uid_intel, email_intel, tenant_intel = _owner_with_plan(client, tier_id="intelligence")
    doc_id = _insert_document(tenant_intel, department="sales")
    _insert_invoice(doc_id, tenant_intel, "INV-S1", date(2025, 4, 1),
                    total=500.0, direction="sale", party_name="Sales Customer", department="sales")

    sales_uid, sales_email = _add_member(tenant_intel, "sales")
    _as(sales_uid, sales_email)
    res = client.get("/api/revenue-concentration")
    assert res.status_code == 200
    data = res.json()
    assert data["has_data"] is True
    assert data["total_sales"] == 500.0
    assert data["top_customers"][0]["customer"] == "Sales Customer"
