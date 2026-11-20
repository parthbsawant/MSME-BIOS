"""
Tests for POST /api/cash-simulator - Cash Flow Simulator endpoint.
Follows the style of test_health_api.py and test_anomalies_api.py.
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


def _new_identity(prefix="sim"):
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


def _owner_with_plan(client, tier_id="full_suite"):
    """Creates a user and buys a plan. Full Suite includes cash_flow_simulator."""
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


# a. Finance (or owner) on Full Suite with bank rows: 200, has_data true, "baseline" and "scenario" each with `months` rows, and "headline" is a string.
def test_simulator_basic_success(client):
    uid, email, tenant_id = _owner_with_plan(client, tier_id="full_suite")

    # Add finance member
    fin_uid, fin_email = _add_member(tenant_id, "finance")
    _as(fin_uid, fin_email)

    doc_bank = _insert_document(tenant_id, "bank_statement")
    _insert_bank_row(doc_bank, tenant_id, 1, date(2025, 4, 1), credit=100000.0, balance=100000.0)
    _insert_bank_row(doc_bank, tenant_id, 2, date(2025, 4, 15), debit=40000.0, balance=60000.0)

    res = client.post("/api/cash-simulator", json={"months": 6})
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["has_data"] is True
    assert len(data["baseline"]) == 6
    assert len(data["scenario"]) == 6
    assert isinstance(data["headline"], str)
    assert data["months"] == 6


# b. With sales_change_pct = -20 the scenario end balance is lower than the baseline's.
def test_simulator_sales_change_reduces_balance(client):
    uid, email, tenant_id = _owner_with_plan(client, tier_id="full_suite")

    doc_bank = _insert_document(tenant_id, "bank_statement")
    _insert_bank_row(doc_bank, tenant_id, 1, date(2025, 4, 1), credit=100000.0, balance=100000.0)
    _insert_bank_row(doc_bank, tenant_id, 2, date(2025, 4, 15), debit=50000.0, balance=50000.0)

    res = client.post("/api/cash-simulator", json={"months": 6, "sales_change_pct": -20})
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["has_data"] is True
    scenario_end = data["scenario_summary"]["end_balance"]
    baseline_end = data["baseline_summary"]["end_balance"]
    assert scenario_end < baseline_end
    assert data["end_balance_delta"] < 0


# c. A one_time item of -50000 in month 1 reduces the scenario's month-1 closing by about 50000 versus the baseline.
def test_simulator_one_time_item(client):
    uid, email, tenant_id = _owner_with_plan(client, tier_id="full_suite")

    doc_bank = _insert_document(tenant_id, "bank_statement")
    _insert_bank_row(doc_bank, tenant_id, 1, date(2025, 4, 1), credit=100000.0, balance=100000.0)
    _insert_bank_row(doc_bank, tenant_id, 2, date(2025, 4, 15), debit=20000.0, balance=80000.0)

    one_time = [{"month": 1, "amount": -50000, "label": "Equipment"}]
    res = client.post("/api/cash-simulator", json={"months": 6, "one_time": one_time})
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["has_data"] is True
    b_m1 = data["baseline"][0]["closing"]
    s_m1 = data["scenario"][0]["closing"]
    assert pytest.approx(b_m1 - s_m1, abs=1.0) == 50000.0


# d. Empty tenant: 200, has_data false.
def test_simulator_empty_tenant(client):
    uid, email, tenant_id = _owner_with_plan(client, tier_id="full_suite")
    res = client.post("/api/cash-simulator", json={"months": 6})
    assert res.status_code == 200, res.text
    data = res.json()
    assert data == {"has_data": False}


# e. Tenant isolation.
def test_simulator_tenant_isolation(client):
    uid_a, email_a, tenant_a = _owner_with_plan(client, tier_id="full_suite")
    doc_a = _insert_document(tenant_a, "bank_statement")
    _insert_bank_row(doc_a, tenant_a, 1, date(2025, 4, 1), credit=200000.0, balance=200000.0)

    uid_b, email_b, tenant_b = _owner_with_plan(client, tier_id="full_suite")
    assert tenant_a != tenant_b

    # Tenant B has no bank rows
    res_b = client.post("/api/cash-simulator", json={"months": 6})
    assert res_b.status_code == 200, res_b.text
    assert res_b.json() == {"has_data": False}


# f. 402 when the plan lacks the feature (Intelligence plan does not include cash_flow_simulator).
def test_simulator_plan_lacks_feature(client):
    # Unpaid -> 402
    uid_unpaid, email_unpaid = _new_identity("unpaid")
    _as(uid_unpaid, email_unpaid)
    client.get("/api/me")
    res_unpaid = client.post("/api/cash-simulator", json={"months": 6})
    assert res_unpaid.status_code == 402
    assert res_unpaid.json()["error"] == "payment_required"

    # Intelligence plan lacks cash_flow_simulator -> 402 or 403
    uid_intel, email_intel, _ = _owner_with_plan(client, tier_id="intelligence")
    res_intel = client.post("/api/cash-simulator", json={"months": 6})
    assert res_intel.status_code in (402, 403)


# g. 403 for a role that is not allowed (sales or hr).
def test_simulator_disallowed_roles(client):
    uid_suite, email_suite, tenant_id = _owner_with_plan(client, tier_id="full_suite")

    # sales member -> 403
    sales_uid, sales_email = _add_member(tenant_id, "sales")
    _as(sales_uid, sales_email)
    res_sales = client.post("/api/cash-simulator", json={"months": 6})
    assert res_sales.status_code == 403
    assert res_sales.json()["error"] == "feature_not_available"

    # hr member -> 403
    hr_uid, hr_email = _add_member(tenant_id, "hr")
    _as(hr_uid, hr_email)
    res_hr = client.post("/api/cash-simulator", json={"months": 6})
    assert res_hr.status_code == 403
    assert res_hr.json()["error"] == "feature_not_available"


# h. Invalid input (sales_change_pct 80, months 99, a one_time month beyond the horizon) gives 422 with error "invalid_input".
def test_simulator_invalid_input(client):
    uid, email, tenant_id = _owner_with_plan(client, tier_id="full_suite")

    doc_bank = _insert_document(tenant_id, "bank_statement")
    _insert_bank_row(doc_bank, tenant_id, 1, date(2025, 4, 1), credit=100000.0, balance=100000.0)

    # sales_change_pct 80 (> 50)
    res_sales = client.post("/api/cash-simulator", json={"sales_change_pct": 80})
    assert res_sales.status_code == 422
    assert res_sales.json()["error"] == "invalid_input"

    # months 99 (> 12)
    res_months = client.post("/api/cash-simulator", json={"months": 99})
    assert res_months.status_code == 422
    assert res_months.json()["error"] == "invalid_input"

    # one_time month 7 beyond horizon 6
    res_onetime = client.post("/api/cash-simulator", json={"months": 6, "one_time": [{"month": 7, "amount": 1000}]})
    assert res_onetime.status_code == 422
    assert res_onetime.json()["error"] == "invalid_input"
