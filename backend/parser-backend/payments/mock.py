"""
payments/mock.py — A stand-in payment provider for development and demos.
No money moves. It behaves like Razorpay in the ways that matter for our
code: orders have ids, a paid payment comes back with an HMAC signature
over "order_id|payment_id", and only a correct signature verifies.

pay() plays the part of the provider's checkout UI. Real Razorpay has no
such server method - its widget returns payment_id and signature to the
browser - so api.py only exposes pay() while PAYMENT_PROVIDER=mock.
A deliberate failure (succeed=False) returns no signature, so it can
never verify: that is the "payment failed" demo path.
"""

import hashlib
import hmac
import json
import os
import uuid
from decimal import Decimal
from typing import Optional, Tuple

from payments.base import PaymentProvider, WebhookEvent, WebhookSignatureError


class MockProvider(PaymentProvider):
    name = "mock"

    def __init__(self, secret: Optional[str] = None):
        # Not a real secret - nothing of value is protected by the mock.
        self._secret = (secret or os.getenv("MOCK_PAYMENT_SECRET") or "msme-bios-mock-secret").encode()

    def _sign(self, message: str) -> str:
        return hmac.new(self._secret, message.encode(), hashlib.sha256).hexdigest()

    def create_order(self, amount: Decimal, receipt: str) -> str:
        return f"mock_order_{uuid.uuid4().hex[:16]}"

    def pay(self, order_id: str, succeed: bool) -> Tuple[Optional[str], Optional[str]]:
        """Simulated checkout UI: returns (payment_id, signature). A failed
        payment has a payment id but no valid signature."""
        payment_id = f"mock_pay_{uuid.uuid4().hex[:16]}"
        if not succeed:
            return payment_id, None
        return payment_id, self._sign(f"{order_id}|{payment_id}")

    def verify_payment(self, order_id: str, payment_id: str, signature: str) -> bool:
        if not (order_id and payment_id and signature):
            return False
        return hmac.compare_digest(self._sign(f"{order_id}|{payment_id}"), signature)

    def handle_webhook(self, body: bytes, signature: str) -> WebhookEvent:
        if not signature or not hmac.compare_digest(self._sign(body.decode()), signature):
            raise WebhookSignatureError("bad webhook signature")
        data = json.loads(body)
        return WebhookEvent(order_id=data["order_id"], payment_id=data.get("payment_id"), paid=data["status"] == "paid")

    def sign_webhook(self, body: bytes) -> str:
        """Test helper: what the provider would put in the signature header."""
        return self._sign(body.decode())
