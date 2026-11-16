"""
reconcile(conn, tenant_id) -> summary dict

Links bank transactions to invoices in invoice_payments, for ONE tenant.
Every query filters on tenant_id. Money is Decimal. The caller commits
(so Step 5 can run this inside the upload's transaction).

SALES (credit invoices we issued, still open)
  For each unlinked 'customer_receipt' bank row, oldest first:
    party = open sale invoices whose party_name is similar to the receipt's
            counterparty (difflib ratio >= 0.80), dated on/before the receipt,
            oldest first.
    a. amount equals one party invoice (within Rs 1)       -> matched
    b. amount equals the sum of the 2-4 oldest              -> all matched
    c. amount smaller than the oldest                       -> partial (FIFO)
    d. amount larger (none of the above)                    -> FIFO across the
       oldest: fully covered ones matched, the last partial; surplus ignored
    e. no party invoice: amount equals exactly ONE open sale invoice
       (within Rs 1) dated 0-60 days before                 -> possible
  Linked receipt -> category 'collection'; nothing to link -> 'sales_upi'.
  So every dated receipt is resolved in one run.

PURCHASES (supplier bills, still open)
  Pass 1: a 'supplier_payment' whose narration contains an open purchase
          invoice's number -> linked (matched, or partial if smaller).
  Pass 2: the rest: same party name (>= 0.80) and amount equals one open
          purchase invoice (within Rs 1) -> matched.
  Category stays 'supplier_payment'.

PAID
  Any invoice whose outstanding (total - linked amounts) is <= 0.50 gets
  paid_at = date of its latest linked bank row.

Idempotent: linked rows are never candidates again, resolved receipts
change category, and a second run finds nothing new.
"""

import re
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from difflib import SequenceMatcher
from typing import Dict, List, Optional

from psycopg2.extras import RealDictCursor

from categorizer.categorize import extract_counterparty

NAME_THRESHOLD = 0.80
AMOUNT_TOLERANCE = Decimal("1.00")
PAID_THRESHOLD = Decimal("0.50")
POSSIBLE_WINDOW_DAYS = 60
MAX_SUM_INVOICES = 4

_NOISE = {"m", "s", "ms", "pvt", "private", "ltd", "limited", "llp", "co", "the"}
_THOUSANDTH = Decimal("0.001")


# ---------------------------------------------------------------- helpers

def normalize_name(name: Optional[str]) -> str:
    words = re.findall(r"[a-z0-9]+", (name or "").casefold())
    return " ".join(w for w in words if w not in _NOISE)


def name_similarity(a: Optional[str], b: Optional[str]) -> float:
    na, nb = normalize_name(a), normalize_name(b)
    if not na or not nb:
        return 0.0
    return SequenceMatcher(None, na, nb).ratio()


def _score(x: float) -> Decimal:
    return Decimal(str(x)).quantize(_THOUSANDTH)


def _alnum(text: Optional[str]) -> str:
    return re.sub(r"[^A-Z0-9]", "", (text or "").upper())


@dataclass
class _Invoice:
    id: str
    number: Optional[str]
    date: Optional[date]
    party: Optional[str]
    outstanding: Decimal


@dataclass
class _Link:
    invoice: _Invoice
    amount: Decimal
    status: str


def _open_invoices(cur, tenant_id, direction: str) -> List[_Invoice]:
    credit_only = "AND i.payment_mode = 'credit'" if direction == "sale" else ""
    cur.execute(
        f"""
        SELECT i.id, i.invoice_number, i.invoice_date, i.party_name, i.total,
               COALESCE(SUM(ip.amount), 0) AS paid
          FROM invoices i
          LEFT JOIN invoice_payments ip
                 ON ip.invoice_id = i.id AND ip.tenant_id = i.tenant_id
         WHERE i.tenant_id = %s
           AND i.direction = %s
           {credit_only}
           AND i.paid_at IS NULL
           AND i.total IS NOT NULL
         GROUP BY i.id
         ORDER BY i.invoice_date NULLS LAST, i.invoice_number, i.id
        """,
        (tenant_id, direction),
    )
    out = []
    for r in cur.fetchall():
        outstanding = Decimal(r["total"]) - Decimal(r["paid"])
        if outstanding > PAID_THRESHOLD:
            out.append(_Invoice(str(r["id"]), r["invoice_number"], r["invoice_date"], r["party_name"], outstanding))
    return out


def _unlinked_bank_rows(cur, tenant_id, category: str, amount_col: str):
    cur.execute(
        f"""
        SELECT bt.id, bt.txn_date, bt.description, bt.counterparty, bt.{amount_col} AS amount
          FROM bank_transactions bt
         WHERE bt.tenant_id = %s
           AND bt.category = %s
           AND bt.{amount_col} > 0
           AND NOT EXISTS (
                 SELECT 1 FROM invoice_payments ip
                  WHERE ip.bank_transaction_id = bt.id AND ip.tenant_id = %s)
         ORDER BY bt.txn_date NULLS LAST, bt.line_no, bt.id
        """,
        (tenant_id, category, tenant_id),
    )
    return cur.fetchall()


def _fifo(invoices: List[_Invoice], amount: Decimal) -> List[_Link]:
    links, left = [], amount
    for inv in invoices:
        if left <= 0:
            break
        take = min(left, inv.outstanding)
        status = "matched" if inv.outstanding - take <= PAID_THRESHOLD else "partial"
        links.append(_Link(inv, take, status))
        left -= take
    return links


def _match_receipt(amount: Decimal, party: List[_Invoice]) -> List[_Link]:
    # a. one invoice, exact amount
    for inv in party:
        if abs(inv.outstanding - amount) <= AMOUNT_TOLERANCE:
            return [_Link(inv, min(amount, inv.outstanding), "matched")]
    # b. the 2-4 oldest add up to the amount
    for k in range(2, min(MAX_SUM_INVOICES, len(party)) + 1):
        if abs(sum(i.outstanding for i in party[:k]) - amount) <= AMOUNT_TOLERANCE:
            return [_Link(i, i.outstanding, "matched") for i in party[:k - 1]] + [
                _Link(party[k - 1], min(party[k - 1].outstanding, amount - sum(i.outstanding for i in party[:k - 1])), "matched")
            ]
    # c / d. FIFO from the oldest (partial if smaller, surplus ignored if larger)
    return _fifo(party, amount)


def _insert_link(cur, tenant_id, link: _Link, bank_id, score: Decimal) -> bool:
    cur.execute(
        """
        INSERT INTO invoice_payments (tenant_id, invoice_id, bank_transaction_id, amount, match_score, status)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (invoice_id, bank_transaction_id) DO NOTHING
        """,
        (tenant_id, link.invoice.id, bank_id, link.amount, score, link.status),
    )
    if cur.rowcount:
        link.invoice.outstanding -= link.amount
        return True
    return False


# ---------------------------------------------------------------- main

def reconcile(conn, tenant_id) -> Dict[str, int]:
    tenant_id = str(tenant_id)
    summary = {"links": 0, "collection": 0, "sales_upi": 0, "possible": 0,
               "supplier_links": 0, "invoices_paid": 0}

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        # One reconcile per tenant at a time (released at commit/rollback).
        cur.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", ("reconcile:" + tenant_id,))

        # ---------------- sales ----------------
        sales = _open_invoices(cur, tenant_id, "sale")
        for row in _unlinked_bank_rows(cur, tenant_id, "customer_receipt", "credit"):
            txn_date = row["txn_date"]
            if txn_date is None:
                continue  # cannot apply the date rules; left for review
            amount = Decimal(row["amount"])
            who = row["counterparty"] or extract_counterparty(row["description"])

            open_now = [i for i in sales if i.outstanding > PAID_THRESHOLD]
            scored = [(i, name_similarity(i.party, who)) for i in open_now
                      if i.date is not None and i.date <= txn_date]
            party = [i for i, s in scored if s >= NAME_THRESHOLD]
            sim = {i.id: s for i, s in scored}

            links: List[_Link] = []
            if party:
                links = _match_receipt(amount, party)
            else:
                near = [i for i, _ in scored
                        if (txn_date - i.date).days <= POSSIBLE_WINDOW_DAYS
                        and abs(i.outstanding - amount) <= AMOUNT_TOLERANCE]
                if len(near) == 1:
                    links = [_Link(near[0], min(amount, near[0].outstanding), "possible")]

            made = 0
            for link in links:
                if _insert_link(cur, tenant_id, link, row["id"], _score(sim.get(link.invoice.id, 0.0))):
                    made += 1
                    summary["links"] += 1
                    summary["possible"] += link.status == "possible"

            new_category = "collection" if made else "sales_upi"
            cur.execute(
                "UPDATE bank_transactions SET category = %s WHERE id = %s AND tenant_id = %s",
                (new_category, row["id"], tenant_id),
            )
            summary[new_category] += 1

        # ---------------- purchases ----------------
        purchases = _open_invoices(cur, tenant_id, "purchase")
        payments = _unlinked_bank_rows(cur, tenant_id, "supplier_payment", "debit")
        linked = set()

        # pass 1: invoice / PO number written in the narration
        for row in payments:
            narration = _alnum(row["description"])
            amount = Decimal(row["amount"])
            for inv in purchases:
                number = _alnum(inv.number)
                if inv.outstanding > PAID_THRESHOLD and len(number) >= 4 and number in narration:
                    take = min(amount, inv.outstanding)
                    status = "matched" if inv.outstanding - take <= AMOUNT_TOLERANCE else "partial"
                    # The document number itself is the evidence: score 1.000.
                    if _insert_link(cur, tenant_id, _Link(inv, take, status), row["id"], Decimal("1.000")):
                        summary["links"] += 1
                        summary["supplier_links"] += 1
                        linked.add(row["id"])
                    break

        # pass 2: party name + exact amount
        for row in payments:
            if row["id"] in linked or row["txn_date"] is None:
                continue
            amount = Decimal(row["amount"])
            who = row["counterparty"] or extract_counterparty(row["description"])
            for inv in purchases:
                if inv.outstanding <= PAID_THRESHOLD or inv.date is None or inv.date > row["txn_date"]:
                    continue
                s = name_similarity(inv.party, who)
                if s >= NAME_THRESHOLD and abs(inv.outstanding - amount) <= AMOUNT_TOLERANCE:
                    if _insert_link(cur, tenant_id, _Link(inv, min(amount, inv.outstanding), "matched"),
                                    row["id"], _score(s)):
                        summary["links"] += 1
                        summary["supplier_links"] += 1
                    break

        # ---------------- paid_at ----------------
        cur.execute(
            """
            UPDATE invoices i
               SET paid_at = s.last_date
              FROM (SELECT ip.invoice_id, SUM(ip.amount) AS paid, MAX(bt.txn_date) AS last_date
                      FROM invoice_payments ip
                      JOIN bank_transactions bt
                        ON bt.id = ip.bank_transaction_id AND bt.tenant_id = %s
                     WHERE ip.tenant_id = %s
                     GROUP BY ip.invoice_id) s
             WHERE i.id = s.invoice_id
               AND i.tenant_id = %s
               AND i.paid_at IS NULL
               AND i.total IS NOT NULL
               AND i.total - s.paid <= %s
            """,
            (tenant_id, tenant_id, tenant_id, PAID_THRESHOLD),
        )
        summary["invoices_paid"] = cur.rowcount

    return summary
