"""
Tests for GET /api/anomalies - anomaly detection endpoint.
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


def _new_identity(prefix="anom"):
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
    """Creates a user and buys a plan. Intelligence and Full Suite include anomaly_detection."""
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


# a. Owner role on a full plan with a planted 50,000 owner_drawing debit: it is returned as large_owner_withdrawal, severity high
def test_large_owner_withdrawal_severity_high(client):
    uid, email, tenant_id = _owner_with_plan(client, tier_id="intelligence")
    doc_id = _insert_document(tenant_id, "bank_statement")

    _insert_bank_row(doc_id, tenant_id, 1, date(2025, 11, 10), debit=50000.0,
                     category="owner_drawing", description="ATM CASH WDL SELF")

    res = client.get("/api/anomalies")
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["has_data"] is True
    assert data["total"] == 1
    assert data["by_rule"]["large_owner_withdrawal"] == 1
    assert data["by_severity"]["high"] == 1

    a = data["anomalies"][0]
    assert a["rule"] == "large_owner_withdrawal"
    assert a["severity"] == "high"
    assert a["amount"] == 50000.0
    assert "withdrawn by the owner" in a["reason"]


# b. A 68,000 debit with category "other": returned as unusual_expense
def test_unusual_expense_category_other(client):
    uid, email, tenant_id = _owner_with_plan(client, tier_id="intelligence")
    doc_id = _insert_document(tenant_id, "bank_statement")

    _insert_bank_row(doc_id, tenant_id, 1, date(2026, 1, 22), debit=68000.0,
                     category="other", description="NEFT DR SHINDE AUTO WORKS")

    res = client.get("/api/anomalies")
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["has_data"] is True
    assert data["total"] == 1
    assert data["by_rule"]["unusual_expense"] == 1

    a = data["anomalies"][0]
    assert a["rule"] == "unusual_expense"
    assert a["amount"] == 68000.0
    assert "not classified" in a["reason"]
    assert "NEFT DR SHINDE" in a["reference"]


# c. Two debits with PO-2025-08-0023 in the description and category supplier_payment: one duplicate_payment (the later one)
def test_duplicate_payment_flags_later_one(client):
    uid, email, tenant_id = _owner_with_plan(client, tier_id="intelligence")
    doc_id = _insert_document(tenant_id, "bank_statement")

    _insert_bank_row(doc_id, tenant_id, 1, date(2025, 8, 26), debit=8249.82,
                     category="supplier_payment", description="NEFT DR PO-2025-08-0023 TASGAON PULSES")
    _insert_bank_row(doc_id, tenant_id, 2, date(2025, 8, 29), debit=8249.82,
                     category="supplier_payment", description="NEFT DR PO-2025-08-0023 TASGAON PULSES")

    res = client.get("/api/anomalies")
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["has_data"] is True
    assert data["total"] == 1
    assert data["by_rule"]["duplicate_payment"] == 1

    a = data["anomalies"][0]
    assert a["rule"] == "duplicate_payment"
    assert a["severity"] == "high"
    assert a["date"] == "2025-08-29"
    assert a["amount"] == 8249.82
    assert "PO-2025-08-0023" in a["reason"]


# d. A sale invoice 100+ days overdue with 15,000 outstanding: overdue_customer
def test_overdue_customer_rule(client):
    uid, email, tenant_id = _owner_with_plan(client, tier_id="intelligence")
    doc_id = _insert_document(tenant_id, "invoice_bill")

    _insert_invoice(doc_id, tenant_id, "INV-OD", date(2025, 1, 1), total=15000.0,
                    direction="sale", party_name="Ravi Traders", payment_mode="credit",
                    due_date=date(2025, 1, 15))

    # as_of is 2025-05-01 -> (2025-05-01 - 2025-01-15) = 106 days overdue
    res = client.get("/api/anomalies?as_of=2025-05-01")
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["has_data"] is True
    assert data["total"] == 1
    assert data["by_rule"]["overdue_customer"] == 1

    a = data["anomalies"][0]
    assert a["rule"] == "overdue_customer"
    assert a["amount"] == 15000.0
    assert a["reference"] == "Ravi Traders"
    assert a["date"] == "2025-05-01"


# e. Tenant isolation: tenant B never sees tenant A's anomalies
def test_tenant_isolation(client):
    uid_a, email_a, tenant_a = _owner_with_plan(client, tier_id="intelligence")
    doc_a = _insert_document(tenant_a, "bank_statement")
    _insert_bank_row(doc_a, tenant_a, 1, date(2025, 11, 10), debit=50000.0,
                     category="owner_drawing", description="ATM CASH WDL")

    uid_b, email_b, tenant_b = _owner_with_plan(client, tier_id="intelligence")
    assert tenant_a != tenant_b

    res_b = client.get("/api/anomalies")
    assert res_b.status_code == 200, res_b.text
    data_b = res_b.json()

    assert data_b["has_data"] is False
    assert data_b["total"] == 0
    assert data_b["anomalies"] == []


# f. 402 when the plan lacks the feature (starter plan) or unpaid
def test_access_guard_plan_lacks_feature(client):
    # Unpaid -> 402
    uid_unpaid, email_unpaid = _new_identity("unpaid")
    _as(uid_unpaid, email_unpaid)
    client.get("/api/me")
    res_unpaid = client.get("/api/anomalies")
    assert res_unpaid.status_code == 402
    assert res_unpaid.json()["error"] == "payment_required"

    # Starter plan (lacks anomaly_detection) -> 402 or 403
    uid_starter, email_starter, _ = _owner_with_plan(client, tier_id="starter")
    res_starter = client.get("/api/anomalies")
    assert res_starter.status_code in (402, 403)


# g. 403 for a role that is not allowed (sales or hr)
def test_access_guard_disallowed_role(client):
    uid_intel, email_intel, tenant_id = _owner_with_plan(client, tier_id="intelligence")

    # sales member -> 403
    sales_uid, sales_email = _add_member(tenant_id, "sales")
    _as(sales_uid, sales_email)
    res_sales = client.get("/api/anomalies")
    assert res_sales.status_code == 403
    assert res_sales.json()["error"] == "feature_not_available"

    # hr member -> 403
    hr_uid, hr_email = _add_member(tenant_id, "hr")
    _as(hr_uid, hr_email)
    res_hr = client.get("/api/anomalies")
    assert res_hr.status_code == 403
    assert res_hr.json()["error"] == "feature_not_available"

    # finance member -> 200
    fin_uid, fin_email = _add_member(tenant_id, "finance")
    _as(fin_uid, fin_email)
    res_fin = client.get("/api/anomalies")
    assert res_fin.status_code == 200


# h. Empty tenant gives has_data false
def test_empty_tenant_has_data_false(client):
    uid, email, tenant_id = _owner_with_plan(client, tier_id="intelligence")
    res = client.get("/api/anomalies")
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["has_data"] is False
    assert data["total"] == 0
    assert data["anomalies"] == []


# i. Invalid as_of gives 422
def test_invalid_as_of_gives_422(client):
    uid, email, tenant_id = _owner_with_plan(client, tier_id="intelligence")
    res = client.get("/api/anomalies?as_of=invalid-date")
    assert res.status_code == 422
    assert res.json()["error"] == "invalid_date"
