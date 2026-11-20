"""
Tests for GET /api/receivables-payables - receivables & payables aging endpoint.
Follows the style of test_cash_dashboard_api.py.
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


def _new_identity(prefix="rec"):
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
    """Creates a user and buys a plan. Growth tier includes receivables_payables."""
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


def _insert_bank_row(document_id: str, tenant_id: str, line_no: int, txn_date: date,
                     debit=None, credit=None, balance=None, category="supplier_payment",
                     counterparty=None, department="finance") -> str:
    row = _sql(
        """
        INSERT INTO bank_transactions (document_id, tenant_id, line_no, txn_date, description,
                                       debit, credit, balance, category, counterparty, department)
        VALUES (%s, %s, %s, %s, 'Txn', %s, %s, %s, %s, %s, %s)
        RETURNING id
        """,
        (
            document_id, tenant_id, line_no, txn_date,
            Decimal(str(debit)) if debit is not None else None,
            Decimal(str(credit)) if credit is not None else None,
            Decimal(str(balance)) if balance is not None else None,
            category, counterparty, department,
        ),
        fetch="one",
    )
    return str(row["id"])


def _insert_payment(tenant_id: str, invoice_id: str, bank_txn_id: str, amount: float, status="matched"):
    _sql(
        """
        INSERT INTO invoice_payments (tenant_id, invoice_id, bank_transaction_id, amount, match_score, status)
        VALUES (%s, %s, %s, %s, 1.0, %s)
        """,
        (tenant_id, invoice_id, bank_txn_id, Decimal(str(amount)), status),
    )


# a) outstanding = total - matched - partial payments; a 'possible' link is NOT subtracted and sets has_possible_payment
def test_outstanding_and_possible_payment_link(client):
    uid, email, tenant_id = _owner_with_plan(client, tier_id="growth")
    inv_doc = _insert_document(tenant_id, "invoice_bill")
    bank_doc = _insert_document(tenant_id, "bank_statement")

    inv_id = _insert_invoice(inv_doc, tenant_id, "INV-001", date(2025, 5, 1),
                             total=1000.0, direction="sale", party_name="Ravi Traders",
                             payment_mode="credit", due_date=date(2025, 5, 15))

    txn1 = _insert_bank_row(bank_doc, tenant_id, 1, date(2025, 5, 10), credit=300.0)
    txn2 = _insert_bank_row(bank_doc, tenant_id, 2, date(2025, 5, 12), credit=200.0)
    txn3 = _insert_bank_row(bank_doc, tenant_id, 3, date(2025, 5, 14), credit=100.0)

    # matched (300) and partial (200) count towards paid
    _insert_payment(tenant_id, inv_id, txn1, amount=300.0, status="matched")
    _insert_payment(tenant_id, inv_id, txn2, amount=200.0, status="partial")
    # possible (100) is NOT subtracted
    _insert_payment(tenant_id, inv_id, txn3, amount=100.0, status="possible")

    res = client.get("/api/receivables-payables?as_of=2025-05-20")
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["has_data"] is True
    rec = data["receivables"]
    assert rec["total_outstanding"] == 500.0  # 1000 - 300 - 200 = 500
    assert rec["invoice_count"] == 1
    inv = rec["invoices"][0]
    assert inv["total"] == 1000.0
    assert inv["paid"] == 500.0
    assert inv["outstanding"] == 500.0
    assert inv["has_possible_payment"] is True


# b) cash and UPI sale invoices are excluded from receivables
def test_cash_and_upi_sales_excluded_from_receivables(client):
    uid, email, tenant_id = _owner_with_plan(client, tier_id="growth")
    doc_1 = _insert_document(tenant_id, "invoice_bill")
    doc_2 = _insert_document(tenant_id, "invoice_bill")
    doc_3 = _insert_document(tenant_id, "invoice_bill")

    _insert_invoice(doc_1, tenant_id, "SALE-CASH", date(2025, 5, 1),
                    total=500.0, direction="sale", payment_mode="cash")
    _insert_invoice(doc_2, tenant_id, "SALE-UPI", date(2025, 5, 1),
                    total=600.0, direction="sale", payment_mode="upi")
    _insert_invoice(doc_3, tenant_id, "SALE-CREDIT", date(2025, 5, 1),
                    total=700.0, direction="sale", payment_mode="credit")

    res = client.get("/api/receivables-payables?as_of=2025-05-10")
    assert res.status_code == 200
    data = res.json()

    rec = data["receivables"]
    assert rec["invoice_count"] == 1
    assert rec["total_outstanding"] == 700.0
    assert rec["invoices"][0]["invoice_number"] == "SALE-CREDIT"


# c) a purchase invoice appears under payables
def test_purchase_invoice_appears_under_payables(client):
    uid, email, tenant_id = _owner_with_plan(client, tier_id="growth")
    doc_id = _insert_document(tenant_id, "invoice_bill")

    _insert_invoice(doc_id, tenant_id, "PUR-001", date(2025, 5, 1),
                    total=850.0, direction="purchase", party_name="Agro Supplier")

    res = client.get("/api/receivables-payables?as_of=2025-05-10")
    assert res.status_code == 200
    data = res.json()

    pay = data["payables"]
    assert pay["invoice_count"] == 1
    assert pay["total_outstanding"] == 850.0
    assert pay["invoices"][0]["invoice_number"] == "PUR-001"
    assert pay["invoices"][0]["party_name"] == "Agro Supplier"

    # Should NOT be in receivables
    assert data["receivables"]["invoice_count"] == 0


# d) tenant isolation (tenant B cannot see tenant A's invoices)
def test_tenant_isolation(client):
    uid_a, email_a, tenant_a = _owner_with_plan(client, tier_id="growth")
    doc_a = _insert_document(tenant_a, "invoice_bill")
    _insert_invoice(doc_a, tenant_a, "INV-A", date(2025, 5, 1),
                    total=1200.0, direction="sale", payment_mode="credit")

    # Tenant B has growth plan but no documents
    uid_b, email_b, tenant_b = _owner_with_plan(client, tier_id="growth")
    assert tenant_a != tenant_b

    res_b = client.get("/api/receivables-payables")
    assert res_b.status_code == 200
    data_b = res_b.json()

    assert data_b["has_data"] is False
    assert data_b["receivables"]["invoice_count"] == 0
    assert data_b["receivables"]["total_outstanding"] == 0.0
    assert data_b["payables"]["invoice_count"] == 0


# e) 402 without a plan, 403 for a plan without the feature, 403 for the sales role
def test_access_guards_402_and_403(client):
    # Unpaid business -> 402
    uid_unpaid, email_unpaid = _new_identity("unpaid")
    _as(uid_unpaid, email_unpaid)
    client.get("/api/me")
    res_unpaid = client.get("/api/receivables-payables")
    assert res_unpaid.status_code == 402
    assert res_unpaid.json()["error"] == "payment_required"

    # Plan without feature (Starter only has document_parser, cash_dashboard, invoice_generator) -> 403
    uid_starter, email_starter, _ = _owner_with_plan(client, tier_id="starter")
    res_starter = client.get("/api/receivables-payables")
    assert res_starter.status_code == 403
    assert res_starter.json()["error"] == "feature_not_available"

    # Member with sales role -> 403
    uid_growth, email_growth, tenant_growth = _owner_with_plan(client, tier_id="growth")
    sales_uid, sales_email = _add_member(tenant_growth, "sales")
    _as(sales_uid, sales_email)
    res_sales = client.get("/api/receivables-payables")
    assert res_sales.status_code == 403
    assert res_sales.json()["error"] == "feature_not_available"


# f) as_of changes days_overdue; a bad as_of gives 422
def test_as_of_handling_and_validation(client):
    uid, email, tenant_id = _owner_with_plan(client, tier_id="growth")
    doc_id = _insert_document(tenant_id, "invoice_bill")
    _insert_invoice(doc_id, tenant_id, "INV-DUE", date(2025, 5, 1),
                    total=500.0, direction="sale", payment_mode="credit",
                    due_date=date(2025, 5, 10))

    # Bad date -> 422
    bad_res = client.get("/api/receivables-payables?as_of=invalid-date")
    assert bad_res.status_code == 422
    assert bad_res.json()["error"] == "invalid_date"

    # as_of = 2025-05-20 -> 10 days overdue
    res_1 = client.get("/api/receivables-payables?as_of=2025-05-20")
    assert res_1.status_code == 200
    assert res_1.json()["receivables"]["invoices"][0]["days_overdue"] == 10

    # as_of = 2025-06-10 -> 31 days overdue
    res_2 = client.get("/api/receivables-payables?as_of=2025-06-10")
    assert res_2.status_code == 200
    assert res_2.json()["receivables"]["invoices"][0]["days_overdue"] == 31


# g) supplier_payment bank rows appear in suppliers_paid
def test_supplier_payment_bank_rows_in_suppliers_paid(client):
    uid, email, tenant_id = _owner_with_plan(client, tier_id="growth")
    doc_id = _insert_document(tenant_id, "bank_statement")

    _insert_bank_row(doc_id, tenant_id, 1, date(2025, 5, 5), debit=1500.0,
                     category="supplier_payment", counterparty="Steel Corp")
    _insert_bank_row(doc_id, tenant_id, 2, date(2025, 5, 8), debit=500.0,
                     category="supplier_payment", counterparty="Steel Corp")

    res = client.get("/api/receivables-payables?as_of=2025-05-15")
    assert res.status_code == 200
    data = res.json()

    assert data["has_data"] is True
    sup = data["suppliers_paid"]
    assert sup["total_paid"] == 2000.0
    assert sup["supplier_count"] == 1
    assert sup["top_suppliers"][0]["supplier"] == "Steel Corp"
    assert sup["top_suppliers"][0]["payments"] == 2
    assert sup["top_suppliers"][0]["last_payment"] == "2025-05-08"
