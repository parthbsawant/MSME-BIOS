import uuid

import pytest
from fastapi.testclient import TestClient

from api import app
from firebase_auth import verify_firebase_token
from db_pool import get_connection
from checkout_helpers import buy_plan

pytestmark = pytest.mark.db


@pytest.fixture(autouse=True)
def clean_overrides():
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    return TestClient(app)

def _identity():
    """Generate a unique test user identity."""
    n = uuid.uuid4().hex[:10]
    return (
        f"uid_receivables_{n}",
        f"receivables_{n}@test.com",
    )


def _as_user(person):
    """Authenticate API requests as the supplied test user."""
    uid, email = person

    app.dependency_overrides[verify_firebase_token] = lambda: {
        "uid": uid,
        "email": email,
        "name": "Receivables Test",
    }


def _sql(sql, params=(), fetch=None):
    """Execute SQL using the configured test database."""
    conn = get_connection()

    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)

            if fetch == "all":
                result = cur.fetchall()
            elif fetch == "one":
                result = cur.fetchone()
            else:
                result = None

        conn.commit()
        return result

    finally:
        conn.close()

def _create_business(client, person, tenant_ids, tier_id="growth"):
    """Create a unique business with an active Growth plan."""
    _as_user(person)

    response = client.get("/api/me")
    assert response.status_code == 200, response.text

    tenant_id = response.json()["tenant_id"]
    tenant_ids.append(tenant_id)

    business_response = client.post(
        "/api/business",
        data={
            "business_name": f"Receivables Test {uuid.uuid4().hex[:6]}",
            "owner_name": "Test Owner",
        },
    )
    assert business_response.status_code == 200, business_response.text

    _, payment_response = buy_plan(client, tier_id=tier_id)
    assert payment_response.status_code == 200, payment_response.text
    assert payment_response.json()["status"] == "active"

    user = _sql(
        "SELECT id FROM users WHERE firebase_uid = %s",
        (person[0],),
        fetch="one",
    )
    assert user is not None

    return {
        "person": person,
        "user_id": str(user["id"]),
        "tenant_id": tenant_id,
    }

def _insert_invoice(tenant_id, user_id, invoice_number, amount):
    """Insert one synthetic unpaid credit-sale invoice."""
    document_id = str(uuid.uuid4())

    _sql(
        """
        INSERT INTO documents (
            id, tenant_id, source_type, source_file,
            extraction_method, needs_review, extracted_at,
            department, uploaded_by
        )
        VALUES (
            %s, %s, 'invoice_bill', %s,
            'structured', false, now(), 'finance', %s
        )
        """,
        (
            document_id,
            tenant_id,
            f"TEST_RECEIVABLES_{invoice_number}.pdf",
            user_id,
        ),
    )

    _sql(
        """
        INSERT INTO invoices (
            document_id, tenant_id, vendor_name,
            invoice_number, invoice_date, subtotal,
            cgst_amount, sgst_amount, total,
            department, uploaded_by, direction,
            party_name, payment_mode, due_date, paid_at
        )
        VALUES (
            %s, %s, %s, %s, CURRENT_DATE,
            %s, 0, 0, %s, 'finance', %s,
            'sale', %s, 'credit', CURRENT_DATE + 30, NULL
        )
        """,
        (
            document_id,
            tenant_id,
            "Test Customer",
            invoice_number,
            amount,
            amount,
            user_id,
            "Test Customer",
        ),
    )

def _cleanup_test_data(tenant_ids, firebase_uids):
    """Delete only the temporary tenants and users created by this test."""
    conn = get_connection()

    try:
        with conn.cursor() as cur:
            # Find any tenants belonging to these temporary users.
            cur.execute(
                """
                SELECT ut.tenant_id
                FROM user_tenants ut
                JOIN users u ON u.id = ut.user_id
                WHERE u.firebase_uid = ANY(%s)
                """,
                (firebase_uids,),
            )

            discovered_tenants = [
                str(row["tenant_id"]) for row in cur.fetchall()
            ]

            # Combine recorded and discovered tenant IDs.
            all_tenant_ids = set(tenant_ids + discovered_tenants)

            for tenant_id in all_tenant_ids:
                cur.execute(
                    "DELETE FROM tenants WHERE id = %s",
                    (tenant_id,),
                )

            for firebase_uid in firebase_uids:
                cur.execute(
                    "DELETE FROM users WHERE firebase_uid = %s",
                    (firebase_uid,),
                )

        conn.commit()

    except Exception:
        conn.rollback()
        raise

    finally:
        conn.close()

def test_receivables_are_isolated_between_businesses(client):
    """Each business must see only its own receivables."""

    person_a = _identity()
    person_b = _identity()

    tenant_ids = []
    firebase_uids = [person_a[0], person_b[0]]

    try:
        # Create two independent businesses.
        business_a = _create_business(client, person_a, tenant_ids)
        business_b = _create_business(client, person_b, tenant_ids)

        # Insert different invoices for each business.
        _insert_invoice(
            business_a["tenant_id"],
            business_a["user_id"],
            "TEST-INV-A",
            "5000.00",
        )

        _insert_invoice(
            business_b["tenant_id"],
            business_b["user_id"],
            "TEST-INV-B",
            "9000.00",
        )

        # Business A must see only its own invoice.
        _as_user(person_a)
        response_a = client.get(
            "/api/analytics/receivables-payables"
        )

        assert response_a.status_code == 200, response_a.text

        result_a = response_a.json()
        assert result_a["receivables"]["total_outstanding"] == 5000.00
        assert result_a["receivables"]["open_count"] == 1
        assert result_a["payables"]["total_outstanding"] == 0.00

        # Business B must see only its own invoice.
        _as_user(person_b)
        response_b = client.get(
            "/api/analytics/receivables-payables"
        )

        assert response_b.status_code == 200, response_b.text

        result_b = response_b.json()
        assert result_b["receivables"]["total_outstanding"] == 9000.00
        assert result_b["receivables"]["open_count"] == 1
        assert result_b["payables"]["total_outstanding"] == 0.00

    finally:
        _cleanup_test_data(tenant_ids, firebase_uids)

def test_receivables_feature_access_depends_on_plan(client):
    """Starter is denied; Growth is allowed to access the feature."""

    person_starter = _identity()
    person_growth = _identity()

    tenant_ids = []
    firebase_uids = [person_starter[0], person_growth[0]]

    try:
        # Create a Starter-plan business.
        _create_business(
            client, person_starter, tenant_ids, tier_id="starter"
        )

        # Create a Growth-plan business.
        _create_business(
            client, person_growth, tenant_ids
        )

        # Starter does not include receivables_payables.
        _as_user(person_starter)
        starter_response = client.get(
            "/api/analytics/receivables-payables"
        )

        assert starter_response.status_code == 403

        # Growth includes receivables_payables.
        _as_user(person_growth)
        growth_response = client.get(
            "/api/analytics/receivables-payables"
        )

        assert growth_response.status_code == 200

    finally:
        _cleanup_test_data(tenant_ids, firebase_uids)

