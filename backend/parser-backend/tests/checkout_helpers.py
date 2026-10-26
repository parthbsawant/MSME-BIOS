"""
Shared by tests that need a business with an active plan: buys one
through the real endpoints (order -> mock pay -> verify), so the paywall
is satisfied the same way a real user satisfies it.
"""


def buy_plan(client, plan_type="tier", tier_id="starter", feature_ids="", extra_seats=0, outcome="success"):
    """Runs checkout for the currently signed-in test user. Returns
    (order_json, verify_response)."""
    order = client.post("/api/checkout/order", data={
        "plan_type": plan_type, "tier_id": tier_id or "", "feature_ids": feature_ids, "extra_seats": str(extra_seats),
    })
    assert order.status_code == 200, order.text
    order = order.json()
    paid = client.post("/api/checkout/mock-pay", data={"order_id": order["order_id"], "outcome": outcome}).json()
    verify = client.post("/api/checkout/verify", data={
        "order_id": order["order_id"], "payment_id": paid["payment_id"], "signature": paid["signature"] or "",
    })
    return order, verify
