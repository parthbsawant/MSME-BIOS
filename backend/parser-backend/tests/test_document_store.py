"""
Step 2: parsed documents are saved (document_store.py via /api/parse).

Proves, against the test database, that a saved document and every one
of its rows carry the server-derived tenant_id, the uploader's user id
and the department; that a failed save leaves nothing behind; and that
client-supplied tenant_id is still ignored.

Same dependency_overrides approach as test_tenant_isolation.py (no live
Firebase needed). Unique @test.com users per run.
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from api import app
from firebase_auth import verify_firebase_token
from db_pool import get_connection
from handwritten_parser.models import HandwrittenBillResult, HandwrittenLineItem
import document_store as ds

pytestmark = pytest.mark.db  # uses the test database - see conftest.py

BANK_PDF = "tests/sample_statements/test_statement.pdf"
INVOICE_PDF = "tests/sample_invoices/test_invoice.pdf"


@pytest.fixture(autouse=True)
def clean_overrides():
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    return TestClient(app)


def _fresh_user(client):
    """Signs in as a brand-new user; returns (firebase_uid, user_id, tenant_id)."""
    n = uuid.uuid4().hex[:10]
    uid = f"uid_doc_{n}"
    app.dependency_overrides[verify_firebase_token] = lambda: {"uid": uid, "email": f"doc_{n}@test.com", "name": "Doc"}
    tenant_id = client.get("/api/me").json()["tenant_id"]
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE firebase_uid = %s", (uid,))
            user_id = str(cur.fetchone()["id"])
    finally:
        conn.close()
    return uid, user_id, tenant_id


def _upload(client, path, document_type, **extra):
    with open(path, "rb") as f:
        return client.post(
            "/api/parse",
            files={"file": (path.split("/")[-1], f, "application/pdf")},
            data={"document_type": document_type, **extra},
        )


def _rows(sql, params):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchall()
    finally:
        conn.close()


# ---- bank statement: saved, stamped, exact money ----

def test_bank_statement_is_saved_with_tenant_uploader_and_department(client):
    _, user_id, tenant_id = _fresh_user(client)

    r = _upload(client, BANK_PDF, "bank_statement")
    assert r.status_code == 200
    body = r.json()
    assert body["document_id"]
    assert body["department"] == "finance"  # the default

    docs = _rows("SELECT * FROM documents WHERE id = %s", (body["document_id"],))
    assert len(docs) == 1
    doc = docs[0]
    assert str(doc["tenant_id"]) == tenant_id
    assert str(doc["uploaded_by"]) == user_id
    assert doc["department"] == "finance"
    assert doc["source_type"] == "bank_statement"
    assert doc["source_file"] == "test_statement.pdf"

    txns = _rows(
        "SELECT * FROM bank_transactions WHERE document_id = %s ORDER BY txn_date, created_at",
        (body["document_id"],),
    )
    assert len(txns) == len(body["transactions"]) > 0
    for row in txns:
        assert str(row["tenant_id"]) == tenant_id
        assert str(row["uploaded_by"]) == user_id
        assert row["department"] == "finance"

    # Money stored as exact NUMERIC, equal to what the parser returned.
    first = body["transactions"][0]
    assert txns[0]["debit"] == Decimal(str(first["debit"]))
    assert txns[0]["balance"] == Decimal(str(first["balance"]))
    assert isinstance(txns[0]["balance"], Decimal)


def test_owner_chosen_department_is_stored_on_every_row(client):
    _fresh_user(client)
    r = _upload(client, BANK_PDF, "bank_statement", department="hr")
    assert r.status_code == 200
    document_id = r.json()["document_id"]

    assert _rows("SELECT department FROM documents WHERE id = %s", (document_id,))[0]["department"] == "hr"
    departments = {row["department"] for row in _rows(
        "SELECT department FROM bank_transactions WHERE document_id = %s", (document_id,))}
    assert departments == {"hr"}


def test_invalid_department_is_rejected_and_nothing_is_saved(client):
    _, _, tenant_id = _fresh_user(client)
    r = _upload(client, BANK_PDF, "bank_statement", department="owner")  # a role, not a department
    assert r.status_code == 400
    assert _rows("SELECT count(*) AS n FROM documents WHERE tenant_id = %s", (tenant_id,))[0]["n"] == 0


# ---- one transaction: a failure part-way leaves nothing behind ----

def test_failed_save_leaves_no_rows_behind(client, monkeypatch):
    _, _, tenant_id = _fresh_user(client)
    real_writer = ds._CHILD_WRITERS["bank_statement"]

    def write_then_fail(cur, *args):
        real_writer(cur, *args)  # documents row and transactions are inserted...
        raise RuntimeError("simulated failure after inserting rows")  # ...then this aborts

    monkeypatch.setitem(ds._CHILD_WRITERS, "bank_statement", write_then_fail)

    r = _upload(client, BANK_PDF, "bank_statement")
    assert r.status_code == 500
    assert r.json()["error"] == "save_failed"
    assert _rows("SELECT count(*) AS n FROM documents WHERE tenant_id = %s", (tenant_id,))[0]["n"] == 0
    assert _rows("SELECT count(*) AS n FROM bank_transactions WHERE tenant_id = %s", (tenant_id,))[0]["n"] == 0


# ---- invoice: invoice row plus line items ----

def test_invoice_is_saved_with_line_items(client):
    _, user_id, tenant_id = _fresh_user(client)
    r = _upload(client, INVOICE_PDF, "invoice_bill", department="sales")
    assert r.status_code == 200
    body = r.json()

    invoices = _rows("SELECT * FROM invoices WHERE document_id = %s", (body["document_id"],))
    assert len(invoices) == 1
    inv = invoices[0]
    assert str(inv["tenant_id"]) == tenant_id
    assert str(inv["uploaded_by"]) == user_id
    assert inv["department"] == "sales"
    assert inv["vendor_name"] == body["vendor_name"]
    assert inv["invoice_number"] == body["invoice_number"]
    assert inv["total"] == Decimal(str(body["total"]))

    items = _rows("SELECT * FROM invoice_line_items WHERE invoice_id = %s ORDER BY created_at", (inv["id"],))
    assert len(items) == len(body["line_items"]) > 0
    for row in items:
        assert str(row["tenant_id"]) == tenant_id
        assert str(row["uploaded_by"]) == user_id
        assert row["department"] == "sales"
    assert items[0]["amount"] == Decimal(str(body["line_items"][0]["amount"]))


# ---- handwritten: bill plus line items, including empty fields ----

def test_handwritten_upload_is_saved(client, tmp_path):
    """End to end through /api/parse with a generated image. Tesseract
    finds little on a blank image, so this proves the save path, not OCR."""
    _, user_id, tenant_id = _fresh_user(client)
    img = tmp_path / "bill.jpg"
    Image.new("RGB", (400, 600), color="white").save(img)
    with open(img, "rb") as f:
        r = client.post("/api/parse", files={"file": ("bill.jpg", f, "image/jpeg")}, data={"document_type": "photo_bill"})
    assert r.status_code == 200
    body = r.json()
    assert body["document_id"]

    bills = _rows("SELECT * FROM handwritten_bills WHERE document_id = %s", (body["document_id"],))
    assert len(bills) == 1
    assert str(bills[0]["tenant_id"]) == tenant_id
    assert str(bills[0]["uploaded_by"]) == user_id
    assert bills[0]["department"] == "finance"
    n_items = _rows("SELECT count(*) AS n FROM handwritten_line_items WHERE bill_id = %s", (bills[0]["id"],))[0]["n"]
    assert n_items == len(body["line_items"])


def test_handwritten_line_items_with_missing_values_are_saved(client):
    """Direct save of a bill whose OCR left some fields empty - those
    must be stored as NULL, not break the save or become 0."""
    _, user_id, tenant_id = _fresh_user(client)
    result = HandwrittenBillResult(
        tenant_id=tenant_id, source_file="bill.jpg", source_type="photo_bill",
        extraction_method="structured", extracted_at=datetime.now(timezone.utc),
        vendor_or_customer_name="Mauli Traders", total=450.5,
        line_items=[
            HandwrittenLineItem(description="Rice 5kg", qty=1, rate=400.5, amount=400.5, confidence="high"),
            HandwrittenLineItem(description="Sugar", qty=None, rate=None, amount=50, confidence="low"),
        ],
    )
    conn = get_connection()
    try:
        document_id = ds.save_parser_result(conn, result, tenant_id, user_id, "finance")
    finally:
        conn.close()

    bill = _rows("SELECT * FROM handwritten_bills WHERE document_id = %s", (document_id,))[0]
    assert bill["total"] == Decimal("450.50")
    items = _rows("SELECT * FROM handwritten_line_items WHERE bill_id = %s ORDER BY description", (bill["id"],))
    assert [i["description"] for i in items] == ["Rice 5kg", "Sugar"]
    assert items[0]["rate"] == Decimal("400.50")
    assert items[1]["qty"] is None and items[1]["rate"] is None
    assert items[1]["confidence"] == "low"
    assert all(str(i["tenant_id"]) == tenant_id and i["department"] == "finance" for i in items)


# ---- client cannot choose the tenant of a saved document ----

def test_client_supplied_tenant_id_is_ignored_when_saving(client):
    _, _, tenant_id = _fresh_user(client)
    fake = "00000000-0000-0000-0000-000000000000"
    r = _upload(client, BANK_PDF, "bank_statement", tenant_id=fake)
    assert r.status_code == 200
    doc = _rows("SELECT tenant_id FROM documents WHERE id = %s", (r.json()["document_id"],))[0]
    assert str(doc["tenant_id"]) == tenant_id != fake
