"""
payments — payment provider interface (base.py) and implementations.
get_provider() picks one from PAYMENT_PROVIDER (default "mock"); Razorpay
will be added here as another implementation of PaymentProvider.
"""

import os

from payments.base import PaymentProvider, WebhookEvent, WebhookSignatureError
from payments.mock import MockProvider

_PROVIDERS = {"mock": MockProvider}


def get_provider() -> PaymentProvider:
    name = os.getenv("PAYMENT_PROVIDER", "mock")
    if name not in _PROVIDERS:
        raise RuntimeError(f"Unknown PAYMENT_PROVIDER {name!r}; known: {list(_PROVIDERS)}")
    return _PROVIDERS[name]()
