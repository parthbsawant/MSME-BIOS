"""
Reconciliation (docs/CATEGORIZER_PLAN.md, Step 4), against the test database.

Small synthetic cases, each in its own throwaway tenant (deleted at the
end, ON DELETE CASCADE): exact, partial then complete, one transfer paying
two invoices, FIFO with surplus, a possible match, no match -> sales_upi,
receipt before the invoice, supplier payment by PO number and by
name + amount, another tenant never touched, idempotent second run.
"""

from datetime import date, datetime, timezone
from decimal import Decimal

import pytest

from db_pool import get_connection
from reconciliation.matcher import name_similarity, reconcile

pytestmark = pytest.mark.db  # uses the test database - see conftest.py


class Tenant:
    """Builds rows for one throwaway tenant."""

    def __init__(self, conn):
        self.conn = conn
        self.cur = conn.cursor()
        self.cur.execute("INSERT INTO tenants DEFAULT VALUES RETURNING id")
        self.id = self.cur.fetchone()["id"]
        now = datetime.now(timezone.utc)
        self.cur.execute(
            "INSERT INTO documents (tenant_id, source_type, source_file, extraction_method, extracted_at, department) "
            "VALUES (%s, 'bank_statement', 'stmt.pdf', 'test', %s, 'finance') RETURNING id", (self.id, now))
        self.stmt_doc = self.cur.fetchone()["id"]
        self.line = 0

    def invoice(self, number, inv_date, total, party, direction="sale", mode="credit"):
        self.cur.execute(
            "INSERT INTO documents (tenant_id, source_type, source_file, extraction_method, extracted_at, department) "
            "VALUES (%s, 'invoice_bill', %s, 'test', now(), 'finance') RETURNING id", (self.id, number + ".pdf"))
        doc = self.cur.fetchone()["id"]
        self.cur.execute(
            "INSERT INTO invoices (document_id, tenant_id, invoice_number, invoice_date, total, department, "
            "direction, party_name, payment_mode, vendor_name) "
            "VALUES (%s, %s, %s, %s, %s, 'finance', %s, %s, %s, %s) RETURNING id",
            (doc, self.id, number, inv_date, Decimal(total), direction, party, mode,
             "MAULI TRADERS" if direction == "sale" else party))
        return self.cur.fetchone()["id"]

    def bank(self, txn_date, description, category, credit=None, debit=None, counterparty=None):
        self.line += 1
        self.cur.execute(
            "INSERT INTO bank_transactions (document_id, tenant_id, txn_date, description, debit, credit, "
            "department, line_no, category, category_source, category_confidence, counterparty) "
            "VALUES (%s, %s, %s, %s, %s, %s, 'finance', %s, %s, 'rule', 1.000, %s) RETURNING id",
            (self.stmt_doc, self.id, txn_date, description,
             Decimal(debit) if debit else None, Decimal(credit) if credit else None,
             self.line, category, counterparty))
        return self.cur.fetchone()["id"]

    def receipt(self, txn_date, name, amount):
        return self.bank(txn_date, f"UPI/CR/{self.line + 100000}/{name}", "customer_receipt",
                         credit=amount, counterparty=name.upper())

    # ---- reads (always filtered on this tenant) ----
    def links(self):
        self.cur.execute(
            "SELECT invoice_id, bank_transaction_id, amount, status, match_score FROM invoice_payments "
            "WHERE tenant_id = %s ORDER BY created_at, invoice_id", (self.id,))
        return self.cur.fetchall()

    def category(self, bank_id):
        self.cur.execute("SELECT category FROM bank_transactions WHERE tenant_id = %s AND id = %s", (self.id, bank_id))
        return self.cur.fetchone()["category"]

    def paid_at(self, invoice_id):
        self.cur.execute("SELECT paid_at FROM invoices WHERE tenant_id = %s AND id = %s", (self.id, invoice_id))
        return self.cur.fetchone()["paid_at"]

    def snapshot(self):
        self.cur.execute("SELECT id, category FROM bank_transactions WHERE tenant_id = %s ORDER BY id", (self.id,))
        cats = [tuple(r.values()) for r in self.cur.fetchall()]
        self.cur.execute("SELECT id, paid_at FROM invoices WHERE tenant_id = %s ORDER BY id", (self.id,))
        paid = [tuple(r.values()) for r in self.cur.fetchall()]
        self.cur.execute(
            "SELECT invoice_id, bank_transaction_id, amount, status, match_score FROM invoice_payments "
            "WHERE tenant_id = %s ORDER BY invoice_id, bank_transaction_id", (self.id,))
        return cats, paid, [tuple(r.values()) for r in self.cur.fetchall()]


@pytest.fixture
def db():
    conn = get_connection()
    made = []

    def new_tenant():
        t = Tenant(conn)
        made.append(t.id)
        return t

    try:
        yield conn, new_tenant
    finally:
        conn.rollback()
        if made:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM tenants WHERE id = ANY(%s::uuid[])", (made,))
            conn.commit()
        conn.close()


def _run(conn, tenant):
    summary = reconcile(conn, tenant.id)
    conn.commit()
    return summary


# ---------------------------------------------------------------- sales

def test_exact_match(db):
    conn, new = db
    t = new()
    inv = t.invoice("INV-1", date(2026, 1, 2), "1000.00", "Annapurna Upahar Kendra")
    r = t.receipt(date(2026, 1, 10), "ANNAPURNA UPAHAR KENDRA", "1000.00")
    _run(conn, t)

    [link] = t.links()
    assert (link["invoice_id"], link["bank_transaction_id"]) == (inv, r)
    assert link["amount"] == Decimal("1000.00")
    assert link["status"] == "matched"
    assert link["match_score"] == Decimal("1.000")
    assert t.category(r) == "collection"
    assert t.paid_at(inv) == date(2026, 1, 10)


def test_partial_then_complete(db):
    conn, new = db
    t = new()
    inv = t.invoice("INV-1", date(2026, 1, 2), "1000.00", "Highway Chaha Kendra")
    r1 = t.receipt(date(2026, 1, 5), "HIGHWAY CHAHA KENDRA", "400.00")
    _run(conn, t)
    [link] = t.links()
    assert link["status"] == "partial" and link["amount"] == Decimal("400.00")
    assert t.category(r1) == "collection"
    assert t.paid_at(inv) is None  # 600 still outstanding

    r2 = t.receipt(date(2026, 1, 20), "HIGHWAY CHAHA KENDRA", "600.00")
    _run(conn, t)
    second = [l for l in t.links() if l["bank_transaction_id"] == r2]
    assert len(second) == 1 and second[0]["status"] == "matched" and second[0]["amount"] == Decimal("600.00")
    assert t.paid_at(inv) == date(2026, 1, 20)  # date of the last receipt


def test_one_transfer_pays_two_invoices(db):
    conn, new = db
    t = new()
    a = t.invoice("INV-1", date(2026, 1, 1), "300.00", "Shree Sai Hotel")
    b = t.invoice("INV-2", date(2026, 1, 3), "500.50", "Shree Sai Hotel")
    c = t.invoice("INV-3", date(2026, 1, 4), "999.00", "Shree Sai Hotel")
    r = t.receipt(date(2026, 1, 15), "SHREE SAI HOTEL", "800.50")
    _run(conn, t)

    got = {l["invoice_id"]: (l["amount"], l["status"]) for l in t.links()}
    assert got == {a: (Decimal("300.00"), "matched"), b: (Decimal("500.50"), "matched")}
    assert t.paid_at(a) == t.paid_at(b) == date(2026, 1, 15)
    assert t.paid_at(c) is None
    assert t.category(r) == "collection"


def test_larger_amount_fifo_surplus_ignored(db):
    conn, new = db
    t = new()
    a = t.invoice("INV-1", date(2026, 1, 1), "300.00", "Chavan Traders")
    b = t.invoice("INV-2", date(2026, 1, 2), "500.00", "Chavan Traders")
    t.receipt(date(2026, 1, 10), "CHAVAN TRADERS", "1000.00")  # 200 more than everything open
    _run(conn, t)

    got = {l["invoice_id"]: (l["amount"], l["status"]) for l in t.links()}
    assert got == {a: (Decimal("300.00"), "matched"), b: (Decimal("500.00"), "matched")}
    assert sum(v[0] for v in got.values()) == Decimal("800.00")  # surplus not invented


def test_possible_match_and_unmatched_becomes_sales_upi(db):
    conn, new = db
    t = new()
    inv = t.invoice("INV-1", date(2026, 1, 1), "750.00", "Kulkarni General Store")
    possible = t.receipt(date(2026, 2, 10), "RAMESH DATTATRAY DESAI", "750.00")  # 40 days, other name
    walk_in = t.receipt(date(2026, 2, 11), "WALK-IN CUSTOMER - GENERAL", "212.00")
    _run(conn, t)

    [link] = t.links()
    assert link["bank_transaction_id"] == possible and link["invoice_id"] == inv
    assert link["status"] == "possible"
    assert t.category(possible) == "collection"
    assert t.category(walk_in) == "sales_upi"


def test_possible_needs_window_and_uniqueness(db):
    conn, new = db
    t = new()
    t.invoice("INV-1", date(2025, 10, 1), "750.00", "Kulkarni General Store")   # > 60 days before
    t.invoice("INV-2", date(2026, 1, 20), "420.00", "Amit Tea Point")
    t.invoice("INV-3", date(2026, 1, 21), "420.00", "Chavan Traders")          # two candidates -> ambiguous
    late = t.receipt(date(2026, 2, 10), "SOMEONE ELSE", "750.00")
    ambiguous = t.receipt(date(2026, 2, 10), "ANOTHER PERSON", "420.00")
    _run(conn, t)

    assert t.links() == []
    assert t.category(late) == "sales_upi"
    assert t.category(ambiguous) == "sales_upi"


def test_receipt_before_invoice_is_not_matched(db):
    conn, new = db
    t = new()
    inv = t.invoice("INV-1", date(2026, 3, 1), "500.00", "Amit Tea Point")
    r = t.receipt(date(2026, 2, 1), "AMIT TEA POINT", "500.00")
    _run(conn, t)
    assert t.links() == []
    assert t.category(r) == "sales_upi"
    assert t.paid_at(inv) is None


def test_cash_and_upi_invoices_are_not_open(db):
    conn, new = db
    t = new()
    t.invoice("INV-1", date(2026, 1, 1), "90.00", "Balaji Chaha Center", mode="cash")
    r = t.receipt(date(2026, 1, 2), "BALAJI CHAHA CENTER", "90.00")
    _run(conn, t)
    assert t.links() == []
    assert t.category(r) == "sales_upi"


# ---------------------------------------------------------------- purchases

def test_supplier_payment_linked_by_po_number(db):
    conn, new = db
    t = new()
    inv = t.invoice("PO-2025-12-0021", date(2025, 12, 1), "45000.00", "Sangli APMC Grain Merchants",
                    direction="purchase")
    other = t.invoice("PO-2025-12-0022", date(2025, 12, 1), "45000.00", "Sangli APMC Grain Merchants",
                      direction="purchase")
    pay = t.bank(date(2025, 12, 20), "NEFT/DR/PO-2025-12-0021 SANGLI APMC GRAIN MERCHA", "supplier_payment",
                 debit="45000.00", counterparty="SANGLI APMC GRAIN MERCHA")
    _run(conn, t)

    [link] = t.links()
    assert (link["invoice_id"], link["bank_transaction_id"], link["status"]) == (inv, pay, "matched")
    assert t.category(pay) == "supplier_payment"
    assert t.paid_at(inv) == date(2025, 12, 20)
    assert t.paid_at(other) is None  # same party and amount, but the PO number decides


def test_supplier_payment_by_name_and_amount(db):
    conn, new = db
    t = new()
    inv = t.invoice("TPW/889", date(2025, 11, 3), "12500.00", "Tasgaon Pulses Wholesale", direction="purchase")
    pay = t.bank(date(2025, 11, 25), "NEFT DR TASGAON PULSES WHOLESALE", "supplier_payment",
                 debit="12500.00", counterparty="TASGAON PULSES WHOLESALE")
    wrong_amount = t.bank(date(2025, 11, 26), "NEFT DR TASGAON PULSES WHOLESALE", "supplier_payment",
                          debit="999.00", counterparty="TASGAON PULSES WHOLESALE")
    _run(conn, t)

    [link] = t.links()
    assert (link["invoice_id"], link["bank_transaction_id"]) == (inv, pay)
    assert t.paid_at(inv) == date(2025, 11, 25)
    assert t.category(wrong_amount) == "supplier_payment"


# ---------------------------------------------------------------- isolation and idempotency

def test_other_tenant_is_never_touched(db):
    conn, new = db
    a, b = new(), new()
    for t in (a, b):
        t.invoice("INV-1", date(2026, 1, 2), "1000.00", "Annapurna Upahar Kendra")
        t.receipt(date(2026, 1, 10), "ANNAPURNA UPAHAR KENDRA", "1000.00")
    conn.commit()
    before_b = b.snapshot()

    _run(conn, a)
    assert len(a.links()) == 1
    assert b.snapshot() == before_b
    assert b.links() == []


def test_second_run_changes_nothing(db):
    conn, new = db
    t = new()
    t.invoice("INV-1", date(2026, 1, 1), "300.00", "Shree Sai Hotel")
    t.invoice("INV-2", date(2026, 1, 3), "500.00", "Shree Sai Hotel")
    t.invoice("INV-3", date(2026, 1, 5), "1000.00", "Highway Chaha Kendra")
    t.invoice("INV-4", date(2026, 1, 6), "650.00", "Kulkarni General Store")
    t.invoice("PO-2026-01-0004", date(2026, 1, 2), "5000.00", "Amul Rural Distributor", direction="purchase")
    t.receipt(date(2026, 1, 10), "SHREE SAI HOTEL", "800.00")
    t.receipt(date(2026, 1, 11), "HIGHWAY CHAHA KENDRA", "400.00")
    t.receipt(date(2026, 1, 12), "UNKNOWN PAYER", "650.00")
    t.receipt(date(2026, 1, 13), "WALK-IN CUSTOMER", "55.00")
    t.bank(date(2026, 1, 14), "NEFT DR PO-2026-01-0004 AMUL RURAL DIS", "supplier_payment", debit="2000.00")
    t.bank(date(2026, 1, 15), "NEFT DR SOMEONE", "supplier_payment", debit="77.00")

    first = _run(conn, t)
    assert first["links"] > 0
    after_first = t.snapshot()

    second = _run(conn, t)
    assert second == {"links": 0, "collection": 0, "sales_upi": 0, "possible": 0,
                      "supplier_links": 0, "invoices_paid": 0}
    assert t.snapshot() == after_first


def test_name_similarity():
    assert name_similarity("Annapurna Upahar Kendra", "ANNAPURNA UPAHAR KENDRA") == 1.0
    assert name_similarity("Annapurna Upahar Kendra", "annapurna upahar kedra") >= 0.8
    assert name_similarity("Sangli APMC Grain Merchants", "SANGLI APMC GRAIN MERCHA") >= 0.8
    assert name_similarity("Amit Tea Point", "Chavan Traders") < 0.8
    assert name_similarity(None, "X") == 0.0
