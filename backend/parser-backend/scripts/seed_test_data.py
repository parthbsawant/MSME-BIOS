
import argparse
import random
import sys
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv


# ---------------------------------------------------------
# Configuration
# ---------------------------------------------------------

RANDOM_SEED = 42
REFERENCE_DATE = date(2026, 3, 31)

SALES_COUNT = 1500
PURCHASES_COUNT = 150
NULL_DIRECTION_COUNT = 20

TENANT_ID = None
USER_ID = None

BASE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BASE_DIR / ".env")


CUSTOMERS = [
    "Aarav Enterprises", "Aarya Stores", "Ananya Traders",
    "Blue Sky Retail", "Bright Mart", "City Corner Shop",
    "Classic Collection", "Coastal Distributors",
    "Crystal Agencies", "Deepak General Stores",
    "Evergreen Retail", "Fair Deal Stores", "Ganesh Traders",
    "Global Mart", "Green Leaf Stores", "Harsh Enterprises",
    "Ideal Retailers", "Jai Maharashtra Stores",
    "Jeevan Agencies", "Kiran Supermarket",
    "Krishna Distributors", "Lakshmi Stores",
    "Lotus Retail", "Mahalaxmi Traders", "Manasvi Enterprises",
    "Metro General Stores", "Modern Bazaar", "Navkar Agencies",
    "New India Stores", "Om Sai Traders", "Patil General Stores",
    "Pearl Distributors", "Pioneer Retail", "Prakash Stores",
    "Prime Mart", "Radha Traders", "Ravi Enterprises",
    "Reliable Agencies", "Royal Retail", "Sai Krupa Stores",
    "Sahyadri Traders", "Shivam Enterprises", "Shree Agencies",
    "Shree Ganesh Stores", "Shree Traders", "Smart Choice Mart",
    "Star Distributors", "Sunrise Retail", "Super Value Stores",
    "Surya Enterprises", "Swastik Traders", "Triveni Stores",
    "Unity General Stores", "Vaibhav Agencies",
    "Vardhman Traders", "Vijay Stores", "Vision Retail",
    "Western Distributors", "Yash Enterprises", "Zenith Mart",
]

SUPPLIERS = [
    "Maharashtra Wholesale Suppliers",
    "Shree Ganesh Distributors",
    "Western Packaging Solutions",
    "Konkan Foods and Supplies",
    "National Stationery Mart",
    "Sai Industrial Traders",
    "Reliable Paper Products",
    "Omkar General Suppliers",
    "Sunrise Consumer Goods",
    "Pioneer Packaging House",
    "Metro Wholesale Agency",
    "Aaradhya Distributors",
    "Sahyadri Supply Co.",
    "Classic Trade Links",
    "Unity Industrial Supplies",
]

GST_RATES = [Decimal("5"), Decimal("12"), Decimal("18")]
CREDIT_TERMS = [7, 15, 30]

AMOUNT_WEIGHTS = [
    (Decimal("150"), 8),
    (Decimal("500"), 15),
    (Decimal("1200"), 25),
    (Decimal("2500"), 25),
    (Decimal("4500"), 17),
    (Decimal("8000"), 8),
    (Decimal("15000"), 2),
]

DEPARTMENTS = ["finance"] * 27 + ["sales", "hr", "marketing"]

# ---------------------------------------------------------
# Utility functions
# ---------------------------------------------------------

def money(value):
    return Decimal(value).quantize(Decimal("0.01"))


def random_amount():
    value, _ = random.choices(
        AMOUNT_WEIGHTS,
        weights=[weight for _, weight in AMOUNT_WEIGHTS],
    )[0]
    return money(value * Decimal(str(random.uniform(0.85, 1.15))))



def random_invoice_date():
    start = date(2025, 4, 1)
    days = (REFERENCE_DATE - start).days

    candidate_dates = [
        start + timedelta(days=day)
        for day in range(days + 1)
    ]

    weights = []

    for selected in candidate_dates:
        weight = 1.0

        # Weekends have higher transaction frequency.
        if selected.weekday() >= 5:
            weight *= 1.5

        # October and November are busier months.
        if selected.month in (10, 11):
            weight *= 1.5

        weights.append(weight)

    return random.choices(candidate_dates, weights=weights, k=1)[0]

def random_gstin():
    state_code = random.choice(["27", "29", "30", "24", "06"])
    pan_letters = "".join(random.choices("ABCDEFGHIJKLMNOPQRSTUVWXYZ", k=5))
    pan_digits = "".join(random.choices("0123456789", k=4))
    pan_last = random.choice("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
    entity_number = random.choice("123456789")
    return (
        state_code + pan_letters + pan_digits + pan_last
        + entity_number + "Z" + random.choice("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ")
    )


def calculate_tax(subtotal):
    rate = random.choice(GST_RATES)
    total_tax = money(subtotal * rate / Decimal("100"))
    cgst = money(total_tax / Decimal("2"))
    sgst = money(total_tax - cgst)
    total = money(subtotal + cgst + sgst)
    return cgst, sgst, total


def random_department():
    return random.choice(DEPARTMENTS)


# ---------------------------------------------------------
# Invoice generation
# ---------------------------------------------------------

def build_invoice(
    invoice_number,
    direction,
    party_name,
    invoice_date,
    payment_mode,
    due_date=None,
    paid_at=None,
    department=None,
    amount=None,
):
    subtotal = amount if amount is not None else random_amount()
    cgst, sgst, total = calculate_tax(subtotal)

    return {
        "invoice_number": invoice_number,
        "direction": direction,
        "party_name": party_name,
        "vendor_name": party_name,
        "invoice_date": invoice_date,
        "gstin": random_gstin(),
        "subtotal": subtotal,
        "cgst_amount": cgst,
        "sgst_amount": sgst,
        "total": total,
        "department": department or random_department(),
        "payment_mode": payment_mode,
        "due_date": due_date,
        "paid_at": paid_at,
    }



def build_sales():
    invoices = []
    credit_customers = CUSTOMERS[:8]
    regular_customers = CUSTOMERS[:-1]

    for index in range(1, SALES_COUNT + 1):
        # First 8: one large overdue debtor.
        if index <= 8:
            invoice_date = date(2025, 10, 1) + timedelta(days=(index - 1) * 3)
            due_date = invoice_date + timedelta(days=15)

            invoices.append(
                build_invoice(
                    f"INV-2025-26-{index:05d}",
                    "sale",
                    credit_customers[0],
                    invoice_date,
                    "credit",
                    due_date,
                    None,
                    "finance",
                    Decimal("7500.00"),
                )
            )
            continue

        # Next 4: unpaid invoices due within 7 days of reference date.
        if index <= 12:
            edge_index = index - 9
            invoice_date = date(2026, 3, 25) + timedelta(days=edge_index)
            due_date = date(2026, 4, 1) + timedelta(days=edge_index)

            invoices.append(
                build_invoice(
                    f"INV-2025-26-{index:05d}",
                    "sale",
                    credit_customers[edge_index + 1],
                    invoice_date,
                    "credit",
                    due_date,
                    None,
                    "finance",
                    Decimal("3500.00"),
                )
            )
            continue

        # Next 5: fully paid invoices for one dedicated customer.
        if index <= 17:
            edge_index = index - 13
            invoice_date = date(2026, 1, 10) + timedelta(days=edge_index * 5)

            invoices.append(
                build_invoice(
                    f"INV-2025-26-{index:05d}",
                    "sale",
                    CUSTOMERS[-1],
                    invoice_date,
                    "credit",
                    invoice_date + timedelta(days=15),
                    invoice_date + timedelta(days=5),
                    "finance",
                    Decimal("1800.00"),
                )
            )
            continue

        # Remaining sales: regular synthetic transactions.
        invoice_date = random_invoice_date()

        payment_mode = random.choices(
            ["cash", "upi", "credit"],
            weights=[40, 30, 30],
        )[0]

        if payment_mode == "credit":
            customer = random.choice(credit_customers)
            terms = random.choice(CREDIT_TERMS)
            due_date = invoice_date + timedelta(days=terms)

            if random.random() < 0.82:
                paid_at = invoice_date + timedelta(
                    days=random.randint(0, terms)
                )
            else:
                paid_at = None
        else:
            customer = random.choice(regular_customers)
            due_date = None
            paid_at = invoice_date

        invoices.append(
            build_invoice(
                f"INV-2025-26-{index:05d}",
                "sale",
                customer,
                invoice_date,
                payment_mode,
                due_date,
                paid_at,
                amount=random_amount(),
            )
        )

    return invoices


def build_purchases():
    invoices = []

    # One deliberately overdue unpaid supplier invoice.
    invoice_date = date(2025, 11, 1)

    invoices.append(
        build_invoice(
            "PUR-2025-26-00001",
            "purchase",
            SUPPLIERS[0],
            invoice_date,
            "credit",
            invoice_date + timedelta(days=15),
            None,
            "finance",
            Decimal("18500.00"),
        )
    )

    # Generate the remaining 149 purchases.
    for index in range(2, PURCHASES_COUNT + 1):
        invoice_date = random_invoice_date()
        supplier = random.choice(SUPPLIERS)

        payment_mode = random.choices(
            ["credit", "upi", "cash"],
            weights=[80, 15, 5],
        )[0]

        due_date = None
        paid_at = invoice_date

        if payment_mode == "credit":
            terms = random.choice([15, 30])
            due_date = invoice_date + timedelta(days=terms)

            if random.random() < 0.75:
                paid_at = invoice_date + timedelta(
                    days=random.randint(1, terms)
                )
            else:
                paid_at = None

        invoices.append(
            build_invoice(
                f"PUR-2025-26-{index:05d}",
                "purchase",
                supplier,
                invoice_date,
                payment_mode,
                due_date,
                paid_at,
                None,
                random_amount(),
            )
        )

    return invoices


def build_null_direction_invoices():
    invoices = []

    for index in range(1, NULL_DIRECTION_COUNT + 1):
        invoice_date = random_invoice_date()
        party = random.choice(CUSTOMERS + SUPPLIERS)

        invoices.append(
            build_invoice(
                f"NULL-DIRECTION-{index:03d}",
                None,
                party,
                invoice_date,
                "cash",
                None,
                invoice_date,
                "finance",
                random_amount(),
            )
        )

    return invoices


# ---------------------------------------------------------
# Database operations
# ---------------------------------------------------------

def get_database_connection(expected_db):
    database_url = __import__("os").environ.get("DATABASE_URL")

    if not database_url:
        raise RuntimeError(
            "DATABASE_URL is missing. Check backend/parser-backend/.env."
        )

    conn = psycopg2.connect(database_url)

    with conn.cursor() as cur:
        cur.execute("SELECT current_database()")
        current_db = cur.fetchone()[0]

    if current_db != expected_db:
        conn.close()
        raise RuntimeError(
            f"Database safety check failed. Expected '{expected_db}', "
            f"but connected to '{current_db}'. No data was changed."
        )

    return conn


def find_user_and_tenant(conn, email):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT u.id, ut.tenant_id, ut.role, ut.status
            FROM users u
            JOIN user_tenants ut ON ut.user_id = u.id
            WHERE LOWER(u.email) = LOWER(%s)
            """,
            (email,),
        )
        rows = cur.fetchall()

    if not rows:
        raise RuntimeError(
            f"No business membership found for email: {email}"
        )

    if len(rows) > 1:
        raise RuntimeError(
            "This email belongs to multiple businesses. "
            "Please ask Parth which tenant to use."
        )

    user_id, tenant_id, role, status = rows[0]

    if status != "active":
        raise RuntimeError("The user's business membership is not active.")

    if role != "owner":
        raise RuntimeError("Run the seed script using a business owner account.")

    return user_id, tenant_id


def delete_previous_seed_data(conn, tenant_id):
    with conn.cursor() as cur:
        cur.execute(
            """
            DELETE FROM documents
            WHERE tenant_id = %s
              AND LEFT(source_file, 5) = 'SEED_'
            """,
            (tenant_id,),
        )

        print(f"Previous synthetic documents removed: {cur.rowcount}")


def insert_invoices(conn, tenant_id, user_id, invoices):
    document_rows = []
    invoice_rows = []

    now = datetime.now(timezone.utc)

    for index, invoice in enumerate(invoices, start=1):
        document_id = __import__("uuid").uuid4()

        document_rows.append(
            (
                str(document_id),
                str(tenant_id),
                "invoice_bill",
                f"SEED_invoice_{index:05d}.pdf",
                "structured",
                False,
                None,
                now,
                invoice["department"],
                str(user_id),
            )
        )

        invoice_rows.append(
            (
                str(document_id),
                str(tenant_id),
                invoice["vendor_name"],
                invoice["invoice_number"],
                invoice["invoice_date"],
                invoice["gstin"],
                invoice["subtotal"],
                invoice["cgst_amount"],
                invoice["sgst_amount"],
                invoice["total"],
                invoice["department"],
                str(user_id),
                invoice["direction"],
                invoice["party_name"],
                invoice["payment_mode"],
                invoice["due_date"],
                invoice["paid_at"],
            )
        )

    with conn.cursor() as cur:
        execute_values(
            cur,
            """
            INSERT INTO documents (
                id, tenant_id, source_type, source_file,
                extraction_method, needs_review, review_reason,
                extracted_at, department, uploaded_by
            ) VALUES %s
            """,
            document_rows,
            page_size=500,
        )

        execute_values(
            cur,
            """
            INSERT INTO invoices (
                document_id, tenant_id, vendor_name, invoice_number,
                invoice_date, gstin, subtotal, cgst_amount,
                sgst_amount, total, department, uploaded_by,
                direction, party_name, payment_mode, due_date, paid_at
            ) VALUES %s
            """,
            invoice_rows,
            page_size=500,
        )


# ---------------------------------------------------------
# Summary and validation
# ---------------------------------------------------------

def print_summary(conn, tenant_id):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE direction = 'sale') AS sales,
                COUNT(*) FILTER (WHERE direction = 'purchase') AS purchases,
                COUNT(*) FILTER (WHERE direction IS NULL) AS null_direction,
                COUNT(*) FILTER (
                    WHERE payment_mode = 'credit' AND paid_at IS NULL
                ) AS unpaid_credit,
                COUNT(*) FILTER (
                    WHERE payment_mode = 'credit'
                      AND paid_at IS NULL
                      AND due_date < DATE '2026-03-31'
                ) AS overdue_as_of_reference_date,
                COUNT(*) FILTER (
                    WHERE payment_mode = 'credit'
                      AND paid_at IS NULL
                      AND due_date BETWEEN DATE '2026-04-01'
                                       AND DATE '2026-04-07'
                ) AS due_next_7_days_as_of_reference_date
            FROM invoices
            WHERE tenant_id = %s
              AND document_id IN (
                  SELECT id FROM documents
                  WHERE tenant_id = %s
                    AND LEFT(source_file, 5) = 'SEED_'
              )
            """,
            (tenant_id, tenant_id),
        )

        row = cur.fetchone()

    labels = [
        "Total invoices",
        "Sales",
        "Purchases",
        "NULL direction",
        "Unpaid credit invoices",
        "Overdue as of 31 March 2026",
        "Due in next 7 days from 31 March 2026",
    ]

    print("\nSynthetic data summary")
    print("----------------------")

    for label, value in zip(labels, row):
        print(f"{label}: {value}")


# ---------------------------------------------------------
# Main
# ---------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Seed synthetic receivables/payables test data."
    )

    parser.add_argument(
        "--email",
        required=True,
        help="Email address of the business owner.",
    )

    parser.add_argument(
        "--expect-db",
        required=True,
        help="Expected PostgreSQL database name.",
    )

    args = parser.parse_args()

    random.seed(RANDOM_SEED)

    conn = None

    try:
        print("Connecting to the database...")
        conn = get_database_connection(args.expect_db)

        print("Verifying user and business membership...")
        user_id, tenant_id = find_user_and_tenant(conn, args.email)

        print(f"Verified business tenant: {tenant_id}")

        print("Generating synthetic invoices...")
        invoices = (
            build_sales()
            + build_purchases()
            + build_null_direction_invoices()
        )

        random.shuffle(invoices)

        print(f"Prepared {len(invoices)} synthetic invoices.")

        print("Starting database transaction...")

        delete_previous_seed_data(conn, tenant_id)

        insert_invoices(conn, tenant_id, user_id, invoices)

        print_summary(conn, tenant_id)

        conn.commit()

        print("\nSynthetic data inserted successfully.")
        print("Database transaction committed.")

    except Exception as exc:
        if conn is not None:
            conn.rollback()

        print(f"\nERROR: {exc}")
        print("Database transaction rolled back.")
        sys.exit(1)

    finally:
        if conn is not None:
            conn.close()


if __name__ == "__main__":
    main()
