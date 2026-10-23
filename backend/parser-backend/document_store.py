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
    for line_no, txn in enumerate(result.transactions, start=1):
        cur.execute(
            """
            INSERT INTO bank_transactions (document_id, tenant_id, line_no, txn_date, description, debit, credit,
                                           balance, needs_review, review_reason, department, uploaded_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (document_id, tenant_id, line_no, txn.txn_date, txn.description, _money(txn.debit), _money(txn.credit),
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
    for line_no, item in enumerate(result.line_items, start=1):
        cur.execute(
            """
            INSERT INTO invoice_line_items (invoice_id, tenant_id, line_no, description, qty, rate, amount, gst_pct,
                                            department, uploaded_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (invoice_id, tenant_id, line_no, item.description, _money(item.qty), _money(item.rate),
             _money(item.amount), _money(item.gst_pct), department, user_id),
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
    for line_no, item in enumerate(result.line_items, start=1):
        cur.execute(
            """
            INSERT INTO handwritten_line_items (bill_id, tenant_id, line_no, description, qty, rate, amount, confidence,
                                                department, uploaded_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (bill_id, tenant_id, line_no, item.description, _money(item.qty), _money(item.rate),
             _money(item.amount), item.confidence, department, user_id),
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


# ============================================================
# READING
#
# Every read goes through _scope(): tenant_id always, plus department when
# one is given. Today every caller is the owner (department=None, sees all
# departments). Step 4 passes a member's department here - this is the one
# place that filter lives.
# ============================================================

def _scope(alias: str, tenant_id: str, department: Optional[str]):
    sql = f"{alias}.tenant_id = %s"
    params = [tenant_id]
    if department is not None:
        sql += f" AND {alias}.department = %s"
        params.append(department)
    return sql, params


def _num(value) -> Optional[float]:
    # JSON output only, matching the floats /api/parse returns. Storage
    # stays exact NUMERIC.
    return None if value is None else float(value)


def list_documents(conn, tenant_id: str, department: Optional[str] = None, limit: int = 100) -> list:
    """Newest first. One summary per document: item count (transactions
    or line items) and, for invoices and bills, the total."""
    where, params = _scope("d", tenant_id, department)
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT d.id, d.source_type, d.source_file, d.extraction_method, d.department,
                   d.needs_review, d.review_reason, d.extracted_at, d.created_at,
                   CASE d.source_type
                     WHEN 'bank_statement' THEN
                       (SELECT count(*) FROM bank_transactions b
                        WHERE b.document_id = d.id AND b.tenant_id = d.tenant_id)
                     WHEN 'invoice_bill' THEN
                       (SELECT count(*) FROM invoice_line_items li JOIN invoices i ON i.id = li.invoice_id
                        WHERE i.document_id = d.id AND li.tenant_id = d.tenant_id)
                     ELSE
                       (SELECT count(*) FROM handwritten_line_items hl JOIN handwritten_bills h ON h.id = hl.bill_id
                        WHERE h.document_id = d.id AND hl.tenant_id = d.tenant_id)
                   END AS item_count,
                   COALESCE(
                     (SELECT i.total FROM invoices i WHERE i.document_id = d.id AND i.tenant_id = d.tenant_id),
                     (SELECT h.total FROM handwritten_bills h WHERE h.document_id = d.id AND h.tenant_id = d.tenant_id)
                   ) AS total
            FROM documents d
            WHERE {where}
            ORDER BY d.created_at DESC
            LIMIT %s
            """,
            params + [limit],
        )
        rows = cur.fetchall()

    return [
        {
            "document_id": str(r["id"]),
            "source_type": r["source_type"],
            "source_file": r["source_file"],
            "extraction_method": r["extraction_method"],
            "department": r["department"],
            "needs_review": r["needs_review"],
            "review_reason": r["review_reason"],
            "extracted_at": r["extracted_at"].isoformat(),
            "created_at": r["created_at"].isoformat(),
            "item_count": r["item_count"],
            "total": _num(r["total"]),
        }
        for r in rows
    ]


def get_document(conn, tenant_id: str, document_id: str, department: Optional[str] = None) -> Optional[dict]:
    """
    One document with all its rows, in the same JSON shape /api/parse
    returns (plus document_id, department, created_at), so the results
    page can show a saved document exactly like a fresh one. Returns None
    if it does not exist OR belongs to another tenant/department - the
    caller cannot tell the two apart.
    """
    where, params = _scope("d", tenant_id, department)
    with conn.cursor() as cur:
        cur.execute(f"SELECT * FROM documents d WHERE d.id = %s AND {where}", [document_id] + params)
        doc = cur.fetchone()
        if doc is None:
            return None

        out = {
            "document_id": str(doc["id"]),
            "tenant_id": str(doc["tenant_id"]),
            "source_file": doc["source_file"],
            "source_type": doc["source_type"],
            "extraction_method": doc["extraction_method"],
            "needs_review": doc["needs_review"],
            "review_reason": doc["review_reason"],
            "extracted_at": doc["extracted_at"].isoformat(),
            "department": doc["department"],
            "created_at": doc["created_at"].isoformat(),
        }

        if doc["source_type"] == "bank_statement":
            cur.execute(
                "SELECT * FROM bank_transactions WHERE document_id = %s AND tenant_id = %s ORDER BY line_no",
                (document_id, tenant_id),
            )
            out["transactions"] = [
                {
                    "txn_date": t["txn_date"].isoformat() if t["txn_date"] else None,
                    "description": t["description"],
                    "debit": _num(t["debit"]),
                    "credit": _num(t["credit"]),
                    "balance": _num(t["balance"]),
                    "needs_review": t["needs_review"],
                    "review_reason": t["review_reason"],
                }
                for t in cur.fetchall()
            ]

        elif doc["source_type"] == "invoice_bill":
            cur.execute("SELECT * FROM invoices WHERE document_id = %s AND tenant_id = %s", (document_id, tenant_id))
            inv = cur.fetchone()
            cur.execute(
                "SELECT * FROM invoice_line_items WHERE invoice_id = %s AND tenant_id = %s ORDER BY line_no",
                (inv["id"], tenant_id),
            )
            items = cur.fetchall()
            out.update({
                "vendor_name": inv["vendor_name"],
                "invoice_number": inv["invoice_number"],
                "invoice_date": inv["invoice_date"].isoformat() if inv["invoice_date"] else None,
                "gstin": inv["gstin"],
                "line_items": [
                    {"description": li["description"], "qty": _num(li["qty"]), "rate": _num(li["rate"]),
                     "amount": _num(li["amount"]), "gst_pct": _num(li["gst_pct"])}
                    for li in items
                ],
                "subtotal": _num(inv["subtotal"]),
                "cgst_amount": _num(inv["cgst_amount"]),
                "sgst_amount": _num(inv["sgst_amount"]),
                "total": _num(inv["total"]),
            })

        else:  # photo_bill
            cur.execute("SELECT * FROM handwritten_bills WHERE document_id = %s AND tenant_id = %s", (document_id, tenant_id))
            bill = cur.fetchone()
            cur.execute(
                "SELECT * FROM handwritten_line_items WHERE bill_id = %s AND tenant_id = %s ORDER BY line_no",
                (bill["id"], tenant_id),
            )
            items = cur.fetchall()
            out.update({
                "vendor_or_customer_name": bill["vendor_or_customer_name"],
                "bill_date": bill["bill_date"].isoformat() if bill["bill_date"] else None,
                "line_items": [
                    {"description": li["description"], "qty": _num(li["qty"]), "rate": _num(li["rate"]),
                     "amount": _num(li["amount"]), "confidence": li["confidence"]}
                    for li in items
                ],
                "total": _num(bill["total"]),
            })

    return out
