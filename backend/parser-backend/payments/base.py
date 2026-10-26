"""
payments/base.py — The interface every payment provider implements
(SPEC.md section 5). Checkout code in api.py / subscriptions.py only ever
talks to a PaymentProvider, so swapping the mock for Razorpay later is
one new class, not a change to the checkout flow.

The flow mirrors Razorpay's:
  1. create_order(amount)  -> provider order id (server side, before paying)
  2. the customer pays in the provider's own UI, which hands back
     payment_id + signature
  3. verify_payment(order_id, payment_id, signature) on the server - the
     ONLY thing that may mark a plan active
  4. handle_webhook(body, signature): the provider's server-to-server
     notice of the same outcome (reliable even if the browser closes)
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from decimal import Decimal
from typing import Optional


class WebhookSignatureError(Exception):
    """The webhook body was not signed by the provider - ignore it."""


@dataclass(frozen=True)
class WebhookEvent:
    order_id: str
    payment_id: Optional[str]
    paid: bool


class PaymentProvider(ABC):
    name: str

    @abstractmethod
    def create_order(self, amount: Decimal, receipt: str) -> str:
        """Registers an order for `amount` rupees; returns the provider's order id."""

    @abstractmethod
    def verify_payment(self, order_id: str, payment_id: str, signature: str) -> bool:
        """True only if this payment for this order is genuinely paid."""

    @abstractmethod
    def handle_webhook(self, body: bytes, signature: str) -> WebhookEvent:
        """Parses a webhook; raises WebhookSignatureError if it is not authentic."""
