
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional


def _amount(value) -> Decimal:
    """Convert a database monetary value to Decimal safely."""
    if value is None:
        return Decimal("0.00")
    return Decimal(str(value))


def _format_amount(value: Decimal) -> float:
    """Convert Decimal to a two-decimal float for JSON output."""
    return float(value.quantize(Decimal("0.01")))


def calculate_receivables_payables(rows, as_of: date) -> dict:
    """
    Calculate outstanding receivables and payables from invoice rows.

    This is a pure function: it does not connect to the database
    or modify any data.
    """

    receivables = []
    payables = []

    for row in rows:
        # Only unpaid credit invoices are considered open.
        if row["payment_mode"] != "credit" or row["paid_at"] is not None:
            continue

        direction = row["direction"]

        # Ignore invoices that have not been classified.
        if direction not in ("sale", "purchase"):
            continue

        invoice = {
            "invoice_id": str(row["id"]),
            "invoice_number": row["invoice_number"],
            "invoice_date": row["invoice_date"].isoformat()
                if row["invoice_date"] else None,
            "due_date": row["due_date"].isoformat()
                if row["due_date"] else None,
            "amount": _amount(row["total"]),
            "party_name": row["party_name"] or "Unknown",
        }

        if direction == "sale":
            receivables.append(invoice)
        else:
            payables.append(invoice)

    def calculate_side(invoices):
        total_outstanding = Decimal("0.00")
        overdue_amount = Decimal("0.00")
        due_next_7_days = Decimal("0.00")
        parties = {}

        next_7_days = as_of + timedelta(days=7)

        for invoice in invoices:
            amount = invoice["amount"]
            due_date = (
                date.fromisoformat(invoice["due_date"])
                if invoice["due_date"] else None
            )
            party_name = invoice["party_name"]

            total_outstanding += amount

            if party_name not in parties:
                parties[party_name] = {
                    "party_name": party_name,
                    "outstanding": Decimal("0.00"),
                    "overdue": Decimal("0.00"),
                    "oldest_due_date": None,
                    "invoices": [],
                }

            party = parties[party_name]
            party["outstanding"] += amount

            if due_date is not None:
                if due_date < as_of:
                    overdue_amount += amount
                    party["overdue"] += amount

                if as_of <= due_date <= next_7_days:
                    due_next_7_days += amount

                if (
                    party["oldest_due_date"] is None
                    or due_date < party["oldest_due_date"]
                ):
                    party["oldest_due_date"] = due_date

            party["invoices"].append({
                "invoice_id": invoice["invoice_id"],
                "invoice_number": invoice["invoice_number"],
                "invoice_date": invoice["invoice_date"],
                "due_date": invoice["due_date"],
                "amount": _format_amount(amount),
            })

        party_list = []

        for party in parties.values():
            party_list.append({
                "party_name": party["party_name"],
                "outstanding": _format_amount(party["outstanding"]),
                "overdue": _format_amount(party["overdue"]),
                "oldest_due_date": (
                    party["oldest_due_date"].isoformat()
                    if party["oldest_due_date"] else None
                ),
                "invoices": party["invoices"],
            })

        party_list.sort(
            key=lambda party: Decimal(party["outstanding"]),
            reverse=True,
        )
        return {
            "total_outstanding": _format_amount(total_outstanding),
            "open_count": len(invoices),
            "overdue_amount": _format_amount(overdue_amount),
            "due_next_7_days": _format_amount(due_next_7_days),
            "parties": party_list,
        }

    receivables_result = calculate_side(receivables)
    payables_result = calculate_side(payables)

    net_position = (
        _amount(receivables_result["total_outstanding"])
        - _amount(payables_result["total_outstanding"])
    )

    return {
        "receivables": receivables_result,
        "payables": payables_result,
        "net_position": _format_amount(net_position),
        "as_of": as_of.isoformat(),
    }

import document_store as ds


def fetch_invoice_rows(conn, tenant_id: str, department: Optional[str] = None):
    """Fetch invoices belonging to the requested tenant and department."""

    where, params = ds._scope("i", tenant_id, department)

    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT
                i.id,
                i.direction,
                i.party_name,
                i.invoice_number,
                i.invoice_date,
                i.payment_mode,
                i.due_date,
                i.paid_at,
                i.total
            FROM invoices i
            WHERE {where}
              AND i.direction IN ('sale', 'purchase')
            ORDER BY i.due_date ASC NULLS LAST, i.invoice_date ASC
            """,
            params,
        )
        return cur.fetchall()
