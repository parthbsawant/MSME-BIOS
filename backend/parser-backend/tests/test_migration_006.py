"""
Migration 006 (docs/CATEGORIZER_PLAN.md, Step 1).

Against the test database: one invoice_payments link can be inserted,
a duplicate (same invoice, same bank row) is rejected by the UNIQUE
constraint, a tenant_id filter never returns another tenant's link, the
new bank_transactions category columns accept values, and documents get
data_source = 'parsed' by default. Everything is created under two
throwaway tenants and deleted at the end (ON DELETE CASCADE).
"""

from datetime import date, datetime, timezone
from decimal import Decimal

import psycopg2
import pytest

from db_pool import get_connection

pytestmark = pytest.mark.db  # uses the test database - see conftest.py


def _make_tenant_with_rows(cur):
    """One tenant with one bank statement document + one bank row and one
    invoice document + one invoice. Returns ids."""
    cur.execute("INSERT INTO tenants DEFAULT VALUES RETURNING id")
    tenant_id = cur.fetchone()["id"]
    now = datetime.now(timezone.utc)

    cur.execute(
        "INSERT INTO documents (tenant_id, source_type, source_file, extraction_method, extracted_at, department) "
        "VALUES (%s, 'bank_statement', 'stmt.pdf', 'test', %s, 'finance') RETURNING id, data_source",
        (tenant_id, now),
    )
    doc = cur.fetchone()
    cur.execute(
        "INSERT INTO bank_transactions (document_id, tenant_id, txn_date, description, credit, department, line_no, "
        "category, category_source, category_confidence, counterparty) "
        "VALUES (%s, %s, %s, 'UPI/CR/123/RAMESH', %s, 'finance', 1, 'customer_receipt', 'rule', %s, 'RAMESH') "
        "RETURNING id",
        (doc["id"], tenant_id, date(2026, 1, 5), Decimal("1180.00"), Decimal("1.000")),
    )
    bank_id = cur.fetchone()["id"]

    cur.execute(
        "INSERT INTO documents (tenant_id, source_type, source_file, extraction_method, extracted_at, department) "
        "VALUES (%s, 'invoice_bill', 'inv.pdf', 'test', %s, 'finance') RETURNING id",
        (tenant_id, now),
    )
    inv_doc_id = cur.fetchone()["id"]
    cur.execute(
        "INSERT INTO invoices (document_id, tenant_id, invoice_number, invoice_date, total, department) "
        "VALUES (%s, %s, 'INV-1', %s, %s, 'finance') RETURNING id",
        (inv_doc_id, tenant_id, date(2026, 1, 1), Decimal("1180.00")),
    )
    invoice_id = cur.fetchone()["id"]
    return tenant_id, doc, bank_id, invoice_id


def test_invoice_payments_link_unique_and_tenant_filter():
    conn = get_connection()
    tenants = []
    try:
        with conn.cursor() as cur:
            t1, doc1, bank1, inv1 = _make_tenant_with_rows(cur)
            t2, _, bank2, inv2 = _make_tenant_with_rows(cur)
            tenants = [t1, t2]
            conn.commit()

            # documents.data_source defaults to 'parsed'
            assert doc1["data_source"] == "parsed"

            # category columns stored
            cur.execute(
                "SELECT category, category_source, category_confidence, counterparty "
                "FROM bank_transactions WHERE tenant_id = %s AND id = %s", (t1, bank1))
            row = cur.fetchone()
            assert row["category"] == "customer_receipt"
            assert row["category_source"] == "rule"
            assert row["category_confidence"] == Decimal("1.000")
            assert row["counterparty"] == "RAMESH"

            # one link per tenant
            for t, inv, bank in ((t1, inv1, bank1), (t2, inv2, bank2)):
                cur.execute(
                    "INSERT INTO invoice_payments (tenant_id, invoice_id, bank_transaction_id, amount, match_score, status) "
                    "VALUES (%s, %s, %s, %s, %s, 'matched')",
                    (t, inv, bank, Decimal("1180.00"), Decimal("0.950")),
                )
            conn.commit()

            # same (invoice, bank row) twice -> UNIQUE violation
            with pytest.raises(psycopg2.errors.UniqueViolation):
                cur.execute(
                    "INSERT INTO invoice_payments (tenant_id, invoice_id, bank_transaction_id, amount, status) "
                    "VALUES (%s, %s, %s, %s, 'partial')",
                    (t1, inv1, bank1, Decimal("10.00")),
                )
            conn.rollback()

            # bad status rejected by CHECK
            with pytest.raises(psycopg2.errors.CheckViolation):
                cur.execute(
                    "INSERT INTO invoice_payments (tenant_id, invoice_id, bank_transaction_id, amount, status) "
                    "VALUES (%s, %s, %s, %s, 'paid')",
                    (t1, inv1, bank1, Decimal("10.00")),
                )
            conn.rollback()

            # tenant filter: each tenant sees exactly its own link
            cur.execute("SELECT invoice_id, bank_transaction_id, amount, status FROM invoice_payments WHERE tenant_id = %s", (t1,))
            rows = cur.fetchall()
            assert len(rows) == 1
            assert rows[0]["invoice_id"] == inv1
            assert rows[0]["bank_transaction_id"] == bank1
            assert rows[0]["amount"] == Decimal("1180.00")
            assert rows[0]["status"] == "matched"
            cur.execute("SELECT invoice_id FROM invoice_payments WHERE tenant_id = %s", (t2,))
            assert [r["invoice_id"] for r in cur.fetchall()] == [inv2]
    finally:
        conn.rollback()
        if tenants:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM tenants WHERE id = ANY(%s::uuid[])", ([str(t) for t in tenants],))
            conn.commit()
        conn.close()
