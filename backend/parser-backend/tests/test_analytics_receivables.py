
from datetime import date
from decimal import Decimal

from analytics_receivables import calculate_receivables_payables


def test_calculate_receivables_payables():
    as_of = date(2026, 3, 31)

    rows = [
        # 1. Overdue credit sale
        {
            "id": "invoice-1",
            "direction": "sale",
            "party_name": "Customer A",
            "invoice_number": "INV-001",
            "invoice_date": date(2026, 3, 1),
            "payment_mode": "credit",
            "due_date": date(2026, 3, 30),
            "paid_at": None,
            "total": Decimal("100.00"),
        },

        # 2. Credit sale due in 3 days
        {
            "id": "invoice-2",
            "direction": "sale",
            "party_name": "Customer B",
            "invoice_number": "INV-002",
            "invoice_date": date(2026, 3, 20),
            "payment_mode": "credit",
            "due_date": date(2026, 4, 3),
            "paid_at": None,
            "total": Decimal("200.00"),
        },

        # 3. Credit sale due in 40 days
        {
            "id": "invoice-3",
            "direction": "sale",
            "party_name": "Customer C",
            "invoice_number": "INV-003",
            "invoice_date": date(2026, 3, 20),
            "payment_mode": "credit",
            "due_date": date(2026, 5, 10),
            "paid_at": None,
            "total": Decimal("300.00"),
        },

        # 4. Already-paid credit sale
        {
            "id": "invoice-4",
            "direction": "sale",
            "party_name": "Customer D",
            "invoice_number": "INV-004",
            "invoice_date": date(2026, 3, 1),
            "payment_mode": "credit",
            "due_date": date(2026, 3, 10),
            "paid_at": date(2026, 3, 9),
            "total": Decimal("400.00"),
        },

        # 5. Cash sale
        {
            "id": "invoice-5",
            "direction": "sale",
            "party_name": "Customer E",
            "invoice_number": "INV-005",
            "invoice_date": date(2026, 3, 15),
            "payment_mode": "cash",
            "due_date": None,
            "paid_at": None,
            "total": Decimal("500.00"),
        },

        # 6. Credit invoice with NULL direction
        {
            "id": "invoice-6",
            "direction": None,
            "party_name": "Unknown Party",
            "invoice_number": "INV-006",
            "invoice_date": date(2026, 3, 15),
            "payment_mode": "credit",
            "due_date": date(2026, 3, 20),
            "paid_at": None,
            "total": Decimal("600.00"),
        },
    ]

    result = calculate_receivables_payables(rows, as_of)

    receivables = result["receivables"]

    assert receivables["total_outstanding"] == 600.00
    assert receivables["open_count"] == 3
    assert receivables["overdue_amount"] == 100.00
    assert receivables["due_next_7_days"] == 200.00

    assert result["payables"]["total_outstanding"] == 0.00
    assert result["net_position"] == 600.00
    assert result["as_of"] == "2026-03-31"

def test_calculate_payables():
    as_of = date(2026, 3, 31)

    rows = [
        {
            "id": "purchase-1",
            "direction": "purchase",
            "party_name": "Supplier A",
            "invoice_number": "PUR-001",
            "invoice_date": date(2026, 3, 1),
            "payment_mode": "credit",
            "due_date": date(2026, 3, 25),
            "paid_at": None,
            "total": Decimal("1500.00"),
        }
    ]

    result = calculate_receivables_payables(rows, as_of)

    assert result["payables"]["total_outstanding"] == 1500.00
    assert result["payables"]["open_count"] == 1
    assert result["payables"]["overdue_amount"] == 1500.00
    assert result["receivables"]["total_outstanding"] == 0.00
    assert result["net_position"] == -1500.00

def test_groups_multiple_invoices_by_party():
    as_of = date(2026, 3, 31)

    rows = [
        {
            "id": "invoice-1",
            "direction": "sale",
            "party_name": "Customer A",
            "invoice_number": "INV-001",
            "invoice_date": date(2026, 3, 1),
            "payment_mode": "credit",
            "due_date": date(2026, 3, 30),
            "paid_at": None,
            "total": Decimal("1000.00"),
        },
        {
            "id": "invoice-2",
            "direction": "sale",
            "party_name": "Customer A",
            "invoice_number": "INV-002",
            "invoice_date": date(2026, 3, 5),
            "payment_mode": "credit",
            "due_date": date(2026, 4, 5),
            "paid_at": None,
            "total": Decimal("2000.00"),
        },
        {
            "id": "invoice-3",
            "direction": "sale",
            "party_name": "Customer B",
            "invoice_number": "INV-003",
            "invoice_date": date(2026, 3, 10),
            "payment_mode": "credit",
            "due_date": date(2026, 4, 10),
            "paid_at": None,
            "total": Decimal("500.00"),
        },
    ]

    result = calculate_receivables_payables(rows, as_of)
    parties = result["receivables"]["parties"]

    assert len(parties) == 2
    assert parties[0]["party_name"] == "Customer A"
    assert parties[0]["outstanding"] == 3000.00
    assert len(parties[0]["invoices"]) == 2
    assert parties[1]["party_name"] == "Customer B"
    assert parties[1]["outstanding"] == 500.00