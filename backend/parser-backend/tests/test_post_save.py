"""
Step 5 (docs/CATEGORIZER_PLAN.md): categorize, enrich and reconcile run
after document_store saves a document. Against the test database.

Real fixture invoices (parsed by the real invoice parser) and a bank
statement result are saved through document_store.save_parser_result();
then categories, enrichment, links and paid_at are checked. Also: upload
order does not matter, and a failing layer never loses the document.
"""

from datetime import date, datetime
from decimal import Decimal
import os

import pytest

import document_store as ds
from bank_parser.models import BankStatementResult, BankTransaction
from db_pool import get_connection
from enrichment import post_save
from invoice_parser.main import parse as parse_invoice

pytestmark = pytest.mark.db  # uses the test database - see conftest.py

INVOICES = os.path.join(os.path.dirname(__file__), "fixtures", "categorizer", "invoices")


@pytest.fixture
def ctx():
    """A throwaway tenant whose business is Mauli Traders. Deleted afterwards."""
    conn = get_connection()
    with conn.cursor() as cur:
        cur.execute("INSERT INTO tenants DEFAULT VALUES RETURNING id")
        tenant_id = str(cur.fetchone()["id"])
        cur.execute("INSERT INTO businesses (tenant_id, business_name, owner_name) VALUES (%s, 'Mauli Traders', 'Test')",
                    (tenant_id,))
    conn.commit()
    try:
        yield conn, tenant_id
    finally:
        conn.rollback()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM tenants WHERE id = %s", (tenant_id,))
        conn.commit()
        conn.close()


def _save_invoice(conn, tenant_id, file_name):
    result = parse_invoice(os.path.join(INVOICES, file_name), tenant_id)
    return ds.save_parser_result(conn, result, tenant_id, None, "finance")


def _save_statement(conn, tenant_id, rows):
    txns = [BankTransaction(txn_date=d, description=desc, debit=dr, credit=cr, balance=10000.0)
            for d, desc, dr, cr in rows]
    result = BankStatementResult(tenant_id=tenant_id, source_file="stmt.pdf", extraction_method="structured",
                                 extracted_at=datetime.now(), transactions=txns)
    return ds.save_parser_result(conn, result, tenant_id, None, "finance")


def _one(conn, sql, params):
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchone()


def _all(conn, sql, params):
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


def _invoice(conn, tenant_id, number):
    return _one(conn, "SELECT * FROM invoices WHERE tenant_id = %s AND invoice_number = %s", (tenant_id, number))


def _bank(conn, tenant_id, document_id):
    rows = _all(conn, "SELECT * FROM bank_transactions WHERE tenant_id = %s AND document_id = %s ORDER BY line_no",
                (tenant_id, document_id))
    return {r["description"]: r for r in rows}


def test_invoices_then_statement(ctx):
    conn, tenant_id = ctx
    _save_invoice(conn, tenant_id, "INV-2025-04-00032.pdf")   # credit, 603.15, due 2025-04-17
    _save_invoice(conn, tenant_id, "INV-2025-10-00584.pdf")   # credit, 614.30, due 2025-11-13

    # enrichment written on save
    inv1 = _invoice(conn, tenant_id, "INV-2025-04-00032")
    assert (inv1["direction"], inv1["party_name"], inv1["payment_mode"], inv1["due_date"]) == \
        ("sale", "Annapurna Upahar Kendra", "credit", date(2025, 4, 17))
    assert inv1["paid_at"] is None

    doc = _save_statement(conn, tenant_id, [
        (date(2025, 4, 20), "UPI/CR/111111111111/ANNAPURNA UPAHAR KENDRA", 0.0, 603.15),
        (date(2025, 11, 10), "upi-cr-222222222222/annapurna upahar kendra REF853223", 0.0, 614.30),
        (date(2025, 11, 11), "NEFT DR SALARY TRANSFER STAFF", 15000.0, 0.0),
        (date(2025, 11, 12), "POS PURCHASE AMAZON PAY 4258", 999.0, 0.0),
        (date(2025, 11, 12), "UPI/CR/333333333333/WALK-IN CUSTOMER - GENERAL", 0.0, 150.0),
    ])
    rows = _bank(conn, tenant_id, doc)

    r1 = rows["UPI/CR/111111111111/ANNAPURNA UPAHAR KENDRA"]
    r2 = rows["upi-cr-222222222222/annapurna upahar kendra REF853223"]
    assert r1["category"] == r2["category"] == "collection"
    assert r1["category_source"] == "rule" and r1["category_confidence"] == Decimal("1.000")
    assert r1["counterparty"] == "ANNAPURNA UPAHAR KENDRA"
    assert rows["NEFT DR SALARY TRANSFER STAFF"]["category"] == "salary"
    assert rows["UPI/CR/333333333333/WALK-IN CUSTOMER - GENERAL"]["category"] == "sales_upi"

    other = rows["POS PURCHASE AMAZON PAY 4258"]
    assert other["category"] == "other" and other["needs_review"] is True
    assert other["review_reason"] == post_save.NOT_RECOGNISED

    links = _all(conn, "SELECT invoice_id, bank_transaction_id, amount, status FROM invoice_payments WHERE tenant_id = %s",
                 (tenant_id,))
    inv2 = _invoice(conn, tenant_id, "INV-2025-10-00584")
    got = {(l["invoice_id"], l["bank_transaction_id"]): (l["amount"], l["status"]) for l in links}
    assert got == {
        (inv1["id"], r1["id"]): (Decimal("603.15"), "matched"),
        (inv2["id"], r2["id"]): (Decimal("614.30"), "matched"),
    }
    assert _invoice(conn, tenant_id, "INV-2025-04-00032")["paid_at"] == date(2025, 4, 20)
    assert inv2["paid_at"] == date(2025, 11, 10)


def test_statement_first_then_invoice_still_matches(ctx):
    conn, tenant_id = ctx
    doc = _save_statement(conn, tenant_id, [
        (date(2025, 11, 10), "UPI/CR/222222222222/ANNAPURNA UPAHAR KENDRA", 0.0, 614.30),
    ])
    [row] = _bank(conn, tenant_id, doc).values()
    assert row["category"] == "sales_upi"  # no invoice yet

    _save_invoice(conn, tenant_id, "INV-2025-10-00584.pdf")
    [row] = _bank(conn, tenant_id, doc).values()
    assert row["category"] == "collection"
    assert _invoice(conn, tenant_id, "INV-2025-10-00584")["paid_at"] == date(2025, 11, 10)


def test_cash_invoice_is_paid_on_its_date(ctx):
    conn, tenant_id = ctx
    _save_invoice(conn, tenant_id, "INV-2026-03-00330.pdf")
    inv = _invoice(conn, tenant_id, "INV-2026-03-00330")
    assert (inv["direction"], inv["party_name"], inv["payment_mode"], inv["due_date"], inv["paid_at"]) == \
        ("sale", "Balaji Chaha Center", "cash", None, date(2026, 3, 25))


def test_failure_in_layers_keeps_the_document(ctx, monkeypatch):
    conn, tenant_id = ctx

    def boom(*args, **kwargs):
        raise RuntimeError("simulated categorizer crash")

    monkeypatch.setattr(post_save, "reconcile", boom)
    doc = _save_statement(conn, tenant_id, [
        (date(2025, 11, 11), "NEFT DR SALARY TRANSFER STAFF", 15000.0, 0.0),
    ])

    d = _one(conn, "SELECT needs_review, review_reason FROM documents WHERE tenant_id = %s AND id = %s", (tenant_id, doc))
    assert d["needs_review"] is True
    assert post_save.ANALYSIS_FAILED in d["review_reason"]
    [row] = _bank(conn, tenant_id, doc).values()
    assert row["category"] is None  # categorizing was rolled back with the failed layer
    assert row["description"] == "NEFT DR SALARY TRANSFER STAFF"
