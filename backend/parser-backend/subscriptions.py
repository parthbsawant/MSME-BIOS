"""
subscriptions.py — Plans, subscriptions and payments in the database
(SPEC.md sections 4, 5 and 7). Step 3 of TRACKER.md.

Rules:
  - The amount is always pricing.quote()'s, never the browser's.
  - A subscription becomes 'active' ONLY in apply_payment() with paid=True,
    which callers reach only after the provider verified the payment (or
    an authentic webhook said so). The legacy backfill in migration 003 is
    the one other way a row is active.
  - Every lookup is by the server-resolved tenant_id; an order id from
    another tenant behaves exactly like an unknown one.
"""

from typing import Optional

from pricing import Quote

# What `status` means to the rest of the app: only this unlocks the
# dashboard, uploads and documents.
ACTIVE = "active"


class OrderNotFound(Exception):
    pass


class AlreadyActive(Exception):
    pass


def get_subscription(conn, tenant_id: str) -> Optional[dict]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT status, seats_purchased, amount, provider, provider_order_id, paid_at
            FROM subscriptions WHERE tenant_id = %s
            """,
            (tenant_id,),
        )
        return cur.fetchone()


def is_active(conn, tenant_id: str) -> bool:
    sub = get_subscription(conn, tenant_id)
    return sub is not None and sub["status"] == ACTIVE


def save_plan(cur, tenant_id: str, q: Quote) -> str:
    """Upserts the tenant's plan from a server-side quote; returns plans.id."""
    cur.execute(
        """
        INSERT INTO plans (tenant_id, plan_type, tier_id, feature_ids, price, seats_included, extra_seats)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (tenant_id) DO UPDATE SET
            plan_type = EXCLUDED.plan_type,
            tier_id = EXCLUDED.tier_id,
            feature_ids = EXCLUDED.feature_ids,
            price = EXCLUDED.price,
            seats_included = EXCLUDED.seats_included,
            extra_seats = EXCLUDED.extra_seats,
            updated_at = now()
        RETURNING id
        """,
        (tenant_id, q.plan_type, q.tier_id, q.feature_ids, q.total, q.seats_included, q.extra_seats),
    )
    return str(cur.fetchone()["id"])


def start_checkout(conn, tenant_id: str, q: Quote, provider) -> dict:
    """
    Saves the chosen plan and a PENDING subscription for it, and registers
    an order with the provider. One transaction. Raises AlreadyActive if
    this business already has an active subscription (plan changes and
    upgrades are a later step - they must not switch off a paid plan).
    """
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT status FROM subscriptions WHERE tenant_id = %s FOR UPDATE", (tenant_id,))
            existing = cur.fetchone()
            if existing and existing["status"] == ACTIVE:
                raise AlreadyActive()

            plan_id = save_plan(cur, tenant_id, q)
            order_id = provider.create_order(q.total, receipt=tenant_id)
            cur.execute(
                """
                INSERT INTO subscriptions (tenant_id, plan_id, seats_purchased, status, amount, provider, provider_order_id)
                VALUES (%s, %s, %s, 'pending', %s, %s, %s)
                ON CONFLICT (tenant_id) DO UPDATE SET
                    plan_id = EXCLUDED.plan_id,
                    seats_purchased = EXCLUDED.seats_purchased,
                    status = 'pending',
                    amount = EXCLUDED.amount,
                    provider = EXCLUDED.provider,
                    provider_order_id = EXCLUDED.provider_order_id,
                    paid_at = NULL,
                    updated_at = now()
                """,
                (tenant_id, plan_id, q.seats_total, q.total, provider.name, order_id),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    return {"order_id": order_id, "amount": q.total, "provider": provider.name}


def apply_payment(conn, order_id: str, payment_id: Optional[str], paid: bool,
                  provider_name: str, tenant_id: Optional[str] = None) -> dict:
    """
    Records the outcome of a payment for an order and updates the
    subscription: paid -> 'active', not paid -> 'failed'. One transaction,
    with the subscription row locked so two concurrent verifies cannot
    both record a payment.

    tenant_id: given for browser-initiated verifies (the order must belong
    to the caller); None for webhooks, which identify the order only.
    Raises OrderNotFound (unknown order, or another tenant's) and
    AlreadyActive (this order was already paid - nothing is recorded twice).
    """
    try:
        with conn.cursor() as cur:
            sql = """
                SELECT id, tenant_id, status, amount FROM subscriptions
                WHERE provider = %s AND provider_order_id = %s
            """
            params = [provider_name, order_id]
            if tenant_id is not None:
                sql += " AND tenant_id = %s"
                params.append(tenant_id)
            cur.execute(sql + " FOR UPDATE", params)
            sub = cur.fetchone()
            if sub is None:
                raise OrderNotFound()
            if sub["status"] == ACTIVE:
                raise AlreadyActive()

            status = ACTIVE if paid else "failed"
            cur.execute(
                "UPDATE subscriptions SET status = %s, paid_at = CASE WHEN %s THEN now() END, updated_at = now() WHERE id = %s",
                (status, paid, sub["id"]),
            )
            cur.execute(
                """
                INSERT INTO payments (tenant_id, subscription_id, amount, status, provider, provider_order_id, provider_payment_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (sub["tenant_id"], sub["id"], sub["amount"], "paid" if paid else "failed", provider_name, order_id, payment_id),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    return {"status": status}
