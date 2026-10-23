"""
document_store.py — Saves a parser's ParserResult into the document
tables (SPEC.md section 8). Step 2 of TRACKER.md.

The parsers themselves are unchanged: they still only return a
ParserResult. This module is the one place that turns that result into
rows, so api.py never writes document SQL itself.

Rules every save follows:
  - ONE transaction per document. The documents row and all of its child
    rows commit together, or nothing is kept (a half-saved statement
    would be worse than none).
  - tenant_id, uploaded_by and department come from the caller (api.py,
    which takes them from the verified token), never from the request.
    The result's own tenant_id field is not trusted for this.
  - Every row, parent and child, carries its own tenant_id and
    department (see 001 and 002 schema comments).
  - Money: the parsers return floats; they are converted with
    Decimal(str(x)) so 2000.1 is stored as exactly 2000.10 in NUMERIC,
    not as a binary-float approximation.
"""

from decimal import Decimal
from typing import Optional

# Departments a document can belong to. "owner" is a role, not a
# department. Step 4 moves this into the central role module.
DEPARTMENTS = ("finance", "sales", "hr", "marketing")
DEFAULT_DEPARTMENT = "finance"


def _money(value) -> Optional[Decimal]:
    return None if value is None else Decimal(str(value))


def _insert_document(cur, result, tenant_id: str, user_id: str, department: str) -> str:
    cur.execute(
        """
        INSERT INTO documents (tenant_id, source_type, source_file, extraction_method,
                               needs_review, review_reason, extracted_at, department, uploaded_by)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
        """,
        (tenant_id, result.source_type, result.source_file, result.extraction_method,
         result.needs_review, result.review_reason, result.extracted_at, department, user_id),
    )
    return str(cur.fetchone()["id"])


def _insert_bank_rows(cur, result, document_id: str, tenant_id: str, user_id: str, department: str) -> None:
    for txn in result.transactions:
        cur.execute(
            """
            INSERT INTO bank_transactions (document_id, tenant_id, txn_date, description, debit, credit,
                                           balance, needs_review, review_reason, department, uploaded_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (document_id, tenant_id, txn.txn_date, txn.description, _money(txn.debit), _money(txn.credit),
             _money(txn.balance), txn.needs_review, txn.review_reason, department, user_id),
        )


def _insert_invoice_rows(cur, result, document_id: str, tenant_id: str, user_id: str, department: str) -> None:
    cur.execute(
        """
        INSERT INTO invoices (document_id, tenant_id, vendor_name, invoice_number, invoice_date, gstin,
                              subtotal, cgst_amount, sgst_amount, total, department, uploaded_by)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
        """,
        (document_id, tenant_id, result.vendor_name, result.invoice_number, result.invoice_date, result.gstin,
         _money(result.subtotal), _money(result.cgst_amount), _money(result.sgst_amount), _money(result.total),
         department, user_id),
    )
    invoice_id = cur.fetchone()["id"]
    for item in result.line_items:
        cur.execute(
            """
            INSERT INTO invoice_line_items (invoice_id, tenant_id, description, qty, rate, amount, gst_pct,
                                            department, uploaded_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (invoice_id, tenant_id, item.description, _money(item.qty), _money(item.rate), _money(item.amount),
             _money(item.gst_pct), department, user_id),
        )


def _insert_handwritten_rows(cur, result, document_id: str, tenant_id: str, user_id: str, department: str) -> None:
    cur.execute(
        """
        INSERT INTO handwritten_bills (document_id, tenant_id, vendor_or_customer_name, bill_date, total,
                                       department, uploaded_by)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING id
        """,
        (document_id, tenant_id, result.vendor_or_customer_name, result.bill_date, _money(result.total),
         department, user_id),
    )
    bill_id = cur.fetchone()["id"]
    for item in result.line_items:
        cur.execute(
            """
            INSERT INTO handwritten_line_items (bill_id, tenant_id, description, qty, rate, amount, confidence,
                                                department, uploaded_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (bill_id, tenant_id, item.description, _money(item.qty), _money(item.rate), _money(item.amount),
             item.confidence, department, user_id),
        )


# source_type -> function that inserts that type's child rows.
_CHILD_WRITERS = {
    "bank_statement": _insert_bank_rows,
    "invoice_bill": _insert_invoice_rows,
    "photo_bill": _insert_handwritten_rows,
}


def save_parser_result(conn, result, tenant_id: str, user_id: str, department: str) -> str:
    """
    Saves one parsed document and all its rows in a single transaction.
    Returns the new documents.id. On any error the transaction is rolled
    back (nothing saved) and the error is re-raised for api.py to report.
    """
    if department not in DEPARTMENTS:
        raise ValueError(f"department must be one of {DEPARTMENTS}, got {department!r}")
    write_children = _CHILD_WRITERS.get(result.source_type)
    if write_children is None:
        raise ValueError(f"Saving {result.source_type!r} documents is not supported yet")

    try:
        with conn.cursor() as cur:
            document_id = _insert_document(cur, result, tenant_id, user_id, department)
            write_children(cur, result, document_id, tenant_id, user_id, department)
        conn.commit()
        return document_id
    except Exception:
        conn.rollback()
        raise
