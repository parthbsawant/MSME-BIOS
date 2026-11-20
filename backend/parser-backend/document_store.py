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

from datetime import date
from decimal import Decimal
import json
from typing import Any, Dict, List, Optional, Tuple

import invoice_gen
import invoice_pdf
from enrichment import post_save

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
        # Categorize / enrich / reconcile in the same transaction. A failure
        # there is rolled back to a savepoint and flags the document; it
        # never loses the saved document (enrichment/post_save.py).
        post_save.analyze_safely(conn, tenant_id, document_id, result)
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


def list_bank_rows_for_cash(conn, tenant_id: str, department: Optional[str] = None) -> list:
    """Returns normalized bank transaction rows for cash summary calculation."""
    where, params = _scope("b", tenant_id, department)
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT b.txn_date, b.line_no, b.description, b.debit, b.credit, b.balance, b.category
            FROM bank_transactions b
            WHERE {where}
            ORDER BY b.txn_date, b.line_no
            """,
            params,
        )
        return cur.fetchall()


def count_documents(conn, tenant_id: str, department: Optional[str] = None) -> int:
    """Number of documents for this tenant and department scoping."""
    where, params = _scope("d", tenant_id, department)
    with conn.cursor() as cur:
        cur.execute(f"SELECT count(*) AS count FROM documents d WHERE {where}", params)
        row = cur.fetchone()
        return row["count"] if row else 0


def list_invoices_for_aging(conn, tenant_id: str, department: Optional[str], direction: str) -> list:
    """
    Returns invoice rows for aging calculation (direction = 'sale' or 'purchase').
    For 'sale', only credit payment_mode is included.
    Paid amounts from matched/partial status in invoice_payments are summed,
    and count of possible status links is returned.
    """
    where, params = _scope("i", tenant_id, department)
    sql = f"""
        SELECT i.id, i.party_name, i.invoice_number, i.invoice_date, i.due_date, i.total,
               COALESCE(SUM(p.amount) FILTER (WHERE p.status IN ('matched', 'partial')), 0) AS paid,
               COUNT(p.id) FILTER (WHERE p.status = 'possible') AS possible
        FROM invoices i
        LEFT JOIN invoice_payments p ON p.invoice_id = i.id AND p.tenant_id = i.tenant_id
        WHERE {where} AND i.direction = %s
    """
    params.append(direction)
    if direction == "sale":
        sql += " AND i.payment_mode = 'credit'"
    sql += " GROUP BY i.id"
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


def list_supplier_rows(conn, tenant_id: str, department: Optional[str] = None) -> list:
    """Returns bank transaction rows for supplier payments."""
    where, params = _scope("b", tenant_id, department)
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT b.txn_date, b.debit, b.category, b.counterparty
            FROM bank_transactions b
            WHERE {where} AND b.category = 'supplier_payment'
            ORDER BY b.txn_date DESC
            """,
            params,
        )
        return cur.fetchall()


def get_data_as_of(conn, tenant_id: str, department: Optional[str] = None):
    """The latest of max(bank txn_date) and max(invoice_date); None if neither exists."""
    where_b, params_b = _scope("b", tenant_id, department)
    where_i, params_i = _scope("i", tenant_id, department)
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT GREATEST(
                (SELECT MAX(b.txn_date) FROM bank_transactions b WHERE {where_b}),
                (SELECT MAX(i.invoice_date) FROM invoices i WHERE {where_i})
            ) AS as_of
            """,
            params_b + params_i,
        )
        row = cur.fetchone()
        return row["as_of"] if row else None


def list_sale_invoices_for_concentration(
    conn, tenant_id: str, department: Optional[str] = None,
    from_date: Optional[date] = None, to_date: Optional[date] = None
) -> list:
    """Returns sale invoices (all payment modes) for revenue concentration."""
    where, params = _scope("i", tenant_id, department)
    sql = f"""
        SELECT i.party_name, i.invoice_date, i.total
        FROM invoices i
        WHERE {where} AND i.direction = 'sale'
    """
    if from_date is not None:
        sql += " AND i.invoice_date >= %s"
        params.append(from_date)
    if to_date is not None:
        sql += " AND i.invoice_date <= %s"
        params.append(to_date)
    sql += " ORDER BY i.invoice_date DESC"
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


def get_sales_date_range(conn, tenant_id: str, department: Optional[str] = None):
    """Returns (min_invoice_date, max_invoice_date) for sale invoices; (None, None) if none."""
    where, params = _scope("i", tenant_id, department)
    sql = f"""
        SELECT MIN(i.invoice_date) AS min_date, MAX(i.invoice_date) AS max_date
        FROM invoices i
        WHERE {where} AND i.direction = 'sale'
    """
    with conn.cursor() as cur:
        cur.execute(sql, params)
        row = cur.fetchone()
        if not row:
            return None, None
        return row["min_date"], row["max_date"]


def next_invoice_number(conn, tenant_id: str, fy: str) -> int:
    """Atomic, gapless per-tenant invoice sequence counter inside the caller's transaction."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO invoice_sequences (tenant_id, fy, last_number)
            VALUES (%s, %s, 1)
            ON CONFLICT (tenant_id, fy) DO UPDATE SET last_number = invoice_sequences.last_number + 1
            RETURNING last_number
            """,
            (tenant_id, fy),
        )
        row = cur.fetchone()
        return int(row["last_number"])


def get_business_profile(conn, tenant_id: str) -> Optional[dict]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT business_name, owner_name, business_type, annual_turnover, city, gstin,
                   address, phone, tagline, upi_id, bank_name, bank_branch, terms, invoice_prefix
            FROM businesses
            WHERE tenant_id = %s
            """,
            (tenant_id,),
        )
        return cur.fetchone()


def update_business_profile(conn, tenant_id: str, data: dict) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO businesses (tenant_id, address, phone, tagline, upi_id, bank_name, bank_branch, terms, invoice_prefix)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (tenant_id) DO UPDATE
            SET address = EXCLUDED.address,
                phone = EXCLUDED.phone,
                tagline = EXCLUDED.tagline,
                upi_id = EXCLUDED.upi_id,
                bank_name = EXCLUDED.bank_name,
                bank_branch = EXCLUDED.bank_branch,
                terms = EXCLUDED.terms,
                invoice_prefix = EXCLUDED.invoice_prefix,
                updated_at = now()
            """,
            (
                tenant_id,
                data.get("address"), data.get("phone"), data.get("tagline"), data.get("upi_id"),
                data.get("bank_name"), data.get("bank_branch"), data.get("terms"), data.get("invoice_prefix") or "",
            ),
        )


def list_customer_names(conn, tenant_id: str, department: Optional[str] = None, q: Optional[str] = None) -> list:
    where, params = _scope("i", tenant_id, department)
    sql = f"""
        SELECT DISTINCT i.party_name
        FROM invoices i
        WHERE {where} AND i.direction = 'sale' AND i.party_name IS NOT NULL AND i.party_name != ''
    """
    if q and q.strip():
        sql += " AND i.party_name ILIKE %s"
        params.append(f"%{q.strip()}%")
    sql += " ORDER BY i.party_name ASC LIMIT 20"
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return [row["party_name"] for row in cur.fetchall()]


def save_generated_invoice(conn, tenant_id: str, user_id: Optional[str], department: str,
                           built: dict, header: dict, biz_name: str, gstin: Optional[str]) -> str:
    """Saves a generated invoice, document, and line items in the caller's transaction. Returns invoice_id."""
    meta = json.dumps({
        "customer_address": header.get("customer_address", "") or "",
        "customer_gstin": header.get("customer_gstin", "") or "",
    })
    filename = f"Invoice_{built['invoice_number'].replace('/', '_')}.pdf"
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO documents (tenant_id, source_type, source_file, extraction_method,
                                   needs_review, review_reason, extracted_at, department, uploaded_by)
            VALUES (%s, 'invoice_bill', %s, 'generated', false, %s, now(), %s, %s)
            RETURNING id
            """,
            (tenant_id, filename, meta, department, user_id),
        )
        doc_id = str(cur.fetchone()["id"])

        cur.execute(
            """
            INSERT INTO invoices (document_id, tenant_id, vendor_name, invoice_number, invoice_date, gstin,
                                  subtotal, cgst_amount, sgst_amount, total, department, uploaded_by,
                                  direction, party_name, payment_mode, due_date, paid_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'sale', %s, %s, %s, %s)
            RETURNING id
            """,
            (
                doc_id, tenant_id, biz_name, built["invoice_number"], built["invoice_date"], gstin,
                _money(built["totals"]["subtotal"]), _money(built["totals"]["cgst_total"]),
                _money(built["totals"]["sgst_total"]), _money(built["totals"]["grand_total"]),
                department, user_id, header["customer_name"], built["payment_mode"],
                built["due_date"], built["paid_at"],
            ),
        )
        invoice_id = str(cur.fetchone()["id"])

        for line_no, item in enumerate(built["lines"], start=1):
            cur.execute(
                """
                INSERT INTO invoice_line_items (invoice_id, tenant_id, line_no, description, qty, rate, amount, gst_pct,
                                                department, uploaded_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    invoice_id, tenant_id, line_no, item["name"], _money(item["qty"]),
                    _money(item["rate"]), _money(item["taxable_value"]), _money(item["gst_pct"]),
                    department, user_id,
                ),
            )
        return invoice_id


def list_generated_invoices(conn, tenant_id: str, department: Optional[str] = None, limit: int = 50) -> list:
    where, params = _scope("i", tenant_id, department)
    sql = f"""
        SELECT i.id, i.invoice_number, i.invoice_date, i.due_date, i.party_name,
               i.payment_mode, i.total, i.paid_at, d.created_at
        FROM invoices i
        JOIN documents d ON d.id = i.document_id
        WHERE {where} AND d.extraction_method = 'generated'
        ORDER BY d.created_at DESC, i.invoice_date DESC
        LIMIT %s
    """
    params.append(limit)
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


def get_invoice_for_pdf(conn, invoice_id: str, tenant_id: str, department: Optional[str] = None) -> Optional[dict]:
    where, params = _scope("i", tenant_id, department)
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT i.id, i.document_id, i.tenant_id, i.vendor_name, i.invoice_number, i.invoice_date,
                   i.due_date, i.party_name, i.payment_mode, i.subtotal, i.cgst_amount, i.sgst_amount,
                   i.total, i.paid_at, d.review_reason,
                   b.business_name, b.address, b.phone, b.gstin, b.tagline, b.upi_id,
                   b.bank_name, b.bank_branch, b.terms, b.invoice_prefix
            FROM invoices i
            JOIN documents d ON d.id = i.document_id
            LEFT JOIN businesses b ON b.tenant_id = i.tenant_id
            WHERE {where} AND i.id = %s
            """,
            params + [invoice_id],
        )
        inv = cur.fetchone()
        if not inv:
            return None

        cur.execute(
            """
            SELECT line_no, description, qty, rate, amount, gst_pct
            FROM invoice_line_items
            WHERE invoice_id = %s AND tenant_id = %s
            ORDER BY line_no ASC
            """,
            (invoice_id, tenant_id),
        )
        items = cur.fetchall()
        return {"invoice": inv, "items": items}


def render_pdf_from_invoice_data(inv_data: dict) -> bytes:
    inv = inv_data["invoice"]
    items = inv_data["items"]

    lines = [
        {
            "name": it["description"] or "Item",
            "qty": it["qty"] if it["qty"] is not None else Decimal(1),
            "rate": it["rate"] if it["rate"] is not None else Decimal(0),
            "gst_pct": it["gst_pct"] if it["gst_pct"] is not None else Decimal(0),
        }
        for it in items
    ]
    if not lines:
        lines = [{"name": "Item", "qty": Decimal(1), "rate": Decimal(0), "gst_pct": Decimal(0)}]

    enriched_lines, totals = invoice_gen.compute_totals(lines)
    days = (inv["due_date"] - inv["invoice_date"]).days if (inv["due_date"] and inv["invoice_date"] and inv["payment_mode"] == "credit") else 0
    payment_label = (
        f"Credit ({days} days)"
        if inv["payment_mode"] == "credit"
        else inv["payment_mode"].upper() if inv["payment_mode"] == "upi" else "Cash"
    )

    built = {
        "invoice_number": inv["invoice_number"],
        "invoice_date": inv["invoice_date"],
        "due_date": inv["due_date"] or inv["invoice_date"],
        "payment_mode": inv["payment_mode"],
        "payment_label": payment_label,
        "paid_at": inv["paid_at"],
        "lines": enriched_lines,
        "totals": totals,
    }

    terms_raw = inv.get("terms") or ""
    terms_list = [t.strip() for t in terms_raw.splitlines() if t.strip()] if isinstance(terms_raw, str) else (terms_raw or [])

    biz_dict = {
        "business_name": inv.get("business_name") or inv.get("vendor_name") or "My Business",
        "address": inv.get("address") or "",
        "phone": inv.get("phone") or "",
        "gstin": inv.get("gstin") or "",
        "tagline": inv.get("tagline") or "",
        "upi_id": inv.get("upi_id") or "",
        "bank_name": inv.get("bank_name") or "",
        "bank_branch": inv.get("bank_branch") or "",
        "terms": terms_list,
    }

    cust_addr = ""
    cust_gstin = ""
    if inv.get("review_reason"):
        try:
            m = json.loads(inv["review_reason"])
            if isinstance(m, dict):
                cust_addr = m.get("customer_address", "") or ""
                cust_gstin = m.get("customer_gstin", "") or ""
        except Exception:
            pass

    header_dict = {
        "customer_name": inv["party_name"] or "Customer",
        "customer_address": cust_addr,
        "customer_gstin": cust_gstin,
    }

    return invoice_pdf.render_invoice_pdf(biz_dict, header_dict, built)


