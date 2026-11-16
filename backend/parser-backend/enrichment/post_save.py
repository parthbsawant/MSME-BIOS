"""
post_save.py — runs after document_store saves a parsed document
(docs/CATEGORIZER_PLAN.md, Step 5):

  bank statement -> categorize each row (category, source, confidence, counterparty)
  invoice        -> enrich_invoice (direction, party_name, payment_mode, due_date, paid_at)
  then           -> reconcile(conn, tenant_id)

All of it runs in the upload's own transaction, inside a SAVEPOINT. If any
layer fails, only that work is rolled back: the document and its rows are
still saved, the error is logged and the document gets needs_review.

Never overwrites earlier work: only rows with no category are categorized
(unless recategorize=True, which still skips 'manual' and linked rows), and
invoice fields are filled only where they are NULL (seeded values stay).
Every query filters on tenant_id.
"""

import logging
from typing import Optional

from psycopg2.extras import RealDictCursor

from categorizer.categorize import categorize
from enrichment.invoice import enrich_invoice
from reconciliation.matcher import reconcile

log = logging.getLogger(__name__)

ANALYSIS_FAILED = "Automatic categorization failed; please review"
NOT_RECOGNISED = "Category not recognised"


def business_name(conn, tenant_id) -> Optional[str]:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT business_name FROM businesses WHERE tenant_id = %s", (str(tenant_id),))
        row = cur.fetchone()
    return row["business_name"] if row else None


def categorize_bank_rows(conn, tenant_id, document_id=None, recategorize: bool = False) -> int:
    """Writes the category columns. Returns the number of rows updated."""
    sql = "SELECT id, description, debit, credit FROM bank_transactions bt WHERE bt.tenant_id = %s"
    params = [str(tenant_id)]
    if document_id is not None:
        sql += " AND bt.document_id = %s"
        params.append(str(document_id))
    if recategorize:
        sql += (" AND bt.category_source IS DISTINCT FROM 'manual'"
                " AND NOT EXISTS (SELECT 1 FROM invoice_payments ip"
                "                 WHERE ip.bank_transaction_id = bt.id AND ip.tenant_id = bt.tenant_id)")
    else:
        sql += " AND bt.category IS NULL"

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(sql + " ORDER BY bt.txn_date, bt.line_no", params)
        rows = cur.fetchall()
        for r in rows:
            res = categorize(r["description"], r["debit"], r["credit"])
            cur.execute(
                """
                UPDATE bank_transactions
                   SET category = %s, category_source = %s, category_confidence = %s, counterparty = %s,
                       needs_review = needs_review OR %s,
                       review_reason = CASE WHEN %s AND review_reason IS NULL THEN %s ELSE review_reason END
                 WHERE id = %s AND tenant_id = %s
                """,
                (res.category, res.source, res.confidence, res.counterparty,
                 res.needs_review, res.needs_review, NOT_RECOGNISED, r["id"], str(tenant_id)),
            )
    return len(rows)


def enrich_invoice_rows(conn, tenant_id, document_id=None, parsed=None, raw_text: Optional[str] = None) -> int:
    """Fills the five migration-005 columns where they are NULL.
    Upload: pass the parser result and its raw_text. Reprocess: rows are
    read from the database (no raw text, so only what the row itself shows)."""
    biz = business_name(conn, tenant_id)
    sql = ("SELECT id, vendor_name, invoice_date FROM invoices i WHERE i.tenant_id = %s")
    params = [str(tenant_id)]
    if document_id is not None:
        sql += " AND i.document_id = %s"
        params.append(str(document_id))
    else:
        sql += " AND i.direction IS NULL"

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(sql, params)
        rows = cur.fetchall()
        for r in rows:
            fields = enrich_invoice(parsed if parsed is not None else r, raw_text, biz)
            cur.execute(
                """
                UPDATE invoices
                   SET direction    = COALESCE(direction, %s),
                       party_name   = COALESCE(party_name, %s),
                       payment_mode = COALESCE(payment_mode, %s),
                       due_date     = COALESCE(due_date, %s),
                       paid_at      = COALESCE(paid_at, %s)
                 WHERE id = %s AND tenant_id = %s
                """,
                (fields["direction"], fields["party_name"], fields["payment_mode"],
                 fields["due_date"], fields["paid_at"], r["id"], str(tenant_id)),
            )
    return len(rows)


def analyze_document(conn, tenant_id, document_id, result) -> dict:
    """The layers for one freshly saved document, then reconcile."""
    out = {}
    if result.source_type == "bank_statement":
        out["categorized"] = categorize_bank_rows(conn, tenant_id, document_id)
    elif result.source_type == "invoice_bill":
        out["enriched"] = enrich_invoice_rows(conn, tenant_id, document_id, parsed=result,
                                              raw_text=getattr(result, "raw_text", None))
    else:
        return out  # handwritten bills are out of scope
    out["reconcile"] = reconcile(conn, tenant_id)
    return out


def analyze_safely(conn, tenant_id, document_id, result) -> bool:
    """Runs analyze_document inside a SAVEPOINT of the caller's transaction.
    On failure: rolls back only the analysis, logs, flags the document.
    Returns True on success. Never raises."""
    with conn.cursor() as cur:
        cur.execute("SAVEPOINT post_save_analysis")
    try:
        analyze_document(conn, tenant_id, document_id, result)
        with conn.cursor() as cur:
            cur.execute("RELEASE SAVEPOINT post_save_analysis")
        return True
    except Exception:
        log.exception("post-save analysis failed for document %s (tenant %s)", document_id, tenant_id)
        with conn.cursor() as cur:
            cur.execute("ROLLBACK TO SAVEPOINT post_save_analysis")
            cur.execute(
                """
                UPDATE documents
                   SET needs_review = true,
                       review_reason = CASE WHEN review_reason IS NULL OR review_reason = '' THEN %s
                                            ELSE review_reason || '; ' || %s END
                 WHERE id = %s AND tenant_id = %s
                """,
                (ANALYSIS_FAILED, ANALYSIS_FAILED, str(document_id), str(tenant_id)),
            )
        return False
