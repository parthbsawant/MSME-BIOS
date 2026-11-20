"""
Tests for Invoice Generator feature (api.py).
Tests the numbering sequence, transaction rollback, invoice generation,
PDF generation, tenant isolation, and access controls.
"""

from datetime import date, timedelta
import uuid
import pytest
from fastapi.testclient import TestClient

from api import app
from checkout_helpers import buy_plan
from db_pool import get_connection
from firebase_auth import verify_firebase_token
import invoice_pdf

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


def _new_identity(prefix="gen"):
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
    """Creates an owner user and buys a plan. Growth tier includes invoice_generator."""
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


SAMPLE_LINES = [
    {"name": "Organic Wheat Flour 10kg", "hsn": "1101", "unit": "BAG", "qty": 2, "rate": 450, "gst_pct": 5},
    {"name": "Sunflower Oil 1L", "hsn": "1512", "unit": "BTL", "qty": 5, "rate": 140, "gst_pct": 12},
]


def test_1_create_cash_invoice_saves_row(client):
    uid, email, tenant_id = _owner_with_plan(client, tier_id="starter")

    payload = {
        "customer_name": "Ramesh General Store",
        "customer_address": "Main Bazaar, Sangli",
        "customer_gstin": "27ABCDE1234F1Z5",
        "invoice_date": "2026-02-10",
        "payment_mode": "cash",
        "lines": SAMPLE_LINES,
    }
    res = client.post("/api/invoice-generator/invoices", json=payload)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["invoice_number"] == "00001/25-26"
    assert data["total"] > 0
    assert "pdf_base64" in data
    assert len(data["pdf_base64"]) > 50

    inv_row = _sql(
        "SELECT direction, party_name, payment_mode, paid_at, invoice_date, total FROM invoices WHERE id = %s",
        (data["invoice_id"],),
        fetch="one",
    )
    assert inv_row["direction"] == "sale"
    assert inv_row["party_name"] == "Ramesh General Store"
    assert inv_row["payment_mode"] == "cash"
    assert inv_row["paid_at"] == date(2026, 2, 10)
    assert inv_row["invoice_date"] == date(2026, 2, 10)


def test_2_create_credit_invoice_appears_in_receivables(client):
    uid, email, tenant_id = _owner_with_plan(client, tier_id="growth")

    payload = {
        "customer_name": "Suresh Kirana",
        "customer_address": "Station Road",
        "customer_gstin": "",
        "invoice_date": "2026-02-10",
        "payment_mode": "credit",
        "credit_days": 30,
        "lines": SAMPLE_LINES,
    }
    res = client.post("/api/invoice-generator/invoices", json=payload)
    assert res.status_code == 200, res.text
    inv_data = res.json()

    inv_row = _sql(
        "SELECT direction, party_name, payment_mode, paid_at, due_date FROM invoices WHERE id = %s",
        (inv_data["invoice_id"],),
        fetch="one",
    )
    assert inv_row["direction"] == "sale"
    assert inv_row["party_name"] == "Suresh Kirana"
    assert inv_row["payment_mode"] == "credit"
    assert inv_row["paid_at"] is None
    assert inv_row["due_date"] == date(2026, 3, 12)

    rec_res = client.get("/api/receivables-payables?as_of=2026-02-15")
    assert rec_res.status_code == 200, rec_res.text
    receivables = rec_res.json()["receivables"]
    assert receivables["total_outstanding"] == inv_data["total"]

    rec_alias_res = client.get("/api/receivables?as_of=2026-02-15")
    assert rec_alias_res.status_code == 200
    assert rec_alias_res.json()["receivables"]["total_outstanding"] == inv_data["total"]


def test_3_consecutive_numbers_and_tenant_isolation(client):
    uid_a, email_a, tenant_a = _owner_with_plan(client, tier_id="starter")

    p = {"customer_name": "Cust 1", "lines": SAMPLE_LINES, "invoice_date": "2026-02-10"}
    res1 = client.post("/api/invoice-generator/invoices", json=p)
    assert res1.status_code == 200
    assert res1.json()["invoice_number"] == "00001/25-26"

    res2 = client.post("/api/invoice-generator/invoices", json=p)
    assert res2.status_code == 200
    assert res2.json()["invoice_number"] == "00002/25-26"

    uid_b, email_b, tenant_b = _owner_with_plan(client, tier_id="starter")
    res_b = client.post("/api/invoice-generator/invoices", json=p)
    assert res_b.status_code == 200
    assert res_b.json()["invoice_number"] == "00001/25-26"


def test_4_validation_422_cases(client):
    uid, email, tenant_id = _owner_with_plan(client, tier_id="starter")

    # 1. No lines
    r = client.post("/api/invoice-generator/invoices", json={"customer_name": "A", "lines": []})
    assert r.status_code == 422

    # 2. Bad GST
    bad_gst = [{"name": "Item", "qty": 1, "rate": 100, "gst_pct": 7}]
    r = client.post("/api/invoice-generator/invoices", json={"customer_name": "A", "lines": bad_gst})
    assert r.status_code == 422

    # 3. Qty 0
    bad_qty = [{"name": "Item", "qty": 0, "rate": 100, "gst_pct": 5}]
    r = client.post("/api/invoice-generator/invoices", json={"customer_name": "A", "lines": bad_qty})
    assert r.status_code == 422

    # 4. Bad payment mode
    r = client.post("/api/invoice-generator/invoices", json={"customer_name": "A", "payment_mode": "crypto", "lines": SAMPLE_LINES})
    assert r.status_code == 422

    # 5. Credit days 0
    r = client.post("/api/invoice-generator/invoices", json={"customer_name": "A", "payment_mode": "credit", "credit_days": 0, "lines": SAMPLE_LINES})
    assert r.status_code == 422

    # 6. Future date (> 1 day)
    future = (date.today() + timedelta(days=5)).isoformat()
    r = client.post("/api/invoice-generator/invoices", json={"customer_name": "A", "invoice_date": future, "lines": SAMPLE_LINES})
    assert r.status_code == 422

    # 7. Missing customer name
    r = client.post("/api/invoice-generator/invoices", json={"customer_name": "   ", "lines": SAMPLE_LINES})
    assert r.status_code == 422


def test_5_failure_after_number_allocated_rolls_back_gaplessly(client, monkeypatch):
    uid, email, tenant_id = _owner_with_plan(client, tier_id="starter")

    def fail_render(*args, **kwargs):
        raise RuntimeError("Simulated PDF engine crash")

    monkeypatch.setattr(invoice_pdf, "render_invoice_pdf", fail_render)

    p = {"customer_name": "Crash Test", "lines": SAMPLE_LINES, "invoice_date": "2026-02-10"}
    with pytest.raises(RuntimeError):
        client.post("/api/invoice-generator/invoices", json=p)

    inv_count = _sql("SELECT count(*) AS c FROM invoices WHERE tenant_id = %s", (tenant_id,), "one")["c"]
    assert inv_count == 0

    monkeypatch.undo()

    res = client.post("/api/invoice-generator/invoices", json=p)
    assert res.status_code == 200
    assert res.json()["invoice_number"] == "00001/25-26"


def test_6_tenant_isolation_on_pdf_and_customers(client):
    uid_a, email_a, tenant_a = _owner_with_plan(client, tier_id="starter")
    p_a = {"customer_name": "Customer Alpha", "lines": SAMPLE_LINES, "invoice_date": "2026-02-10"}
    res_a = client.post("/api/invoice-generator/invoices", json=p_a)
    inv_id_a = res_a.json()["invoice_id"]

    uid_b, email_b, tenant_b = _owner_with_plan(client, tier_id="starter")

    # Tenant B tries to fetch Tenant A's PDF -> 404
    pdf_res = client.get(f"/api/invoice-generator/invoices/{inv_id_a}/pdf")
    assert pdf_res.status_code == 404

    # Tenant B customer search cannot see Alpha
    cust_res = client.get("/api/invoice-generator/customers?q=Alpha")
    assert cust_res.status_code == 200
    assert "Customer Alpha" not in cust_res.json()["customers"]


def test_7_access_guards(client):
    # 1. No plan -> 402
    uid_unpaid, email_unpaid = _new_identity("unpaid")
    _as(uid_unpaid, email_unpaid)
    client.get("/api/me")
    r = client.get("/api/invoice-generator/profile")
    assert r.status_code == 402

    # 2. Plan without invoice_generator -> 403
    uid_nofeat, email_nofeat = _new_identity("nofeat")
    _as(uid_nofeat, email_nofeat)
    client.get("/api/me")
    buy_plan(client, plan_type="custom", feature_ids=["cash_dashboard"])
    r = client.get("/api/invoice-generator/profile")
    assert r.status_code == 403

    # 3. Paid tenant with various roles
    uid_own, email_own, tenant_id = _owner_with_plan(client, tier_id="growth")

    for disallowed_role in ("finance", "hr", "marketing"):
        uid_m, email_m = _add_member(tenant_id, disallowed_role)
        _as(uid_m, email_m)
        r = client.get("/api/invoice-generator/profile")
        assert r.status_code == 403, f"Expected 403 for {disallowed_role}, got {r.status_code}"

    # Sales role is allowed to view profile and generate invoices
    uid_sales, email_sales = _add_member(tenant_id, "sales")
    _as(uid_sales, email_sales)
    r = client.get("/api/invoice-generator/profile")
    assert r.status_code == 200

    # But Sales role cannot update business profile (owner only)
    r_put = client.put("/api/invoice-generator/profile", json={"address": "New Address"})
    assert r_put.status_code == 403


def test_8_pdf_bytes_response(client):
    uid, email, tenant_id = _owner_with_plan(client, tier_id="starter")
    p = {"customer_name": "PDF Test Store", "lines": SAMPLE_LINES, "invoice_date": "2026-02-10"}
    res = client.post("/api/invoice-generator/invoices", json=p)
    assert res.status_code == 200
    inv_id = res.json()["invoice_id"]

    pdf_res = client.get(f"/api/invoice-generator/invoices/{inv_id}/pdf")
    assert pdf_res.status_code == 200
    assert pdf_res.headers["content-type"] == "application/pdf"
    assert pdf_res.content[:5] == b"%PDF-"
