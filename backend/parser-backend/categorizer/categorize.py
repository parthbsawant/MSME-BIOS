"""
categorize(narration, debit, credit) -> CategoryResult

Order:
  1. rules  -> source 'rule',  confidence 1.000
  2. model  -> source 'model', accepted only if probability >= 0.80 and
               most of the narration's words were seen in training
               (an unfamiliar narration is not forced into a category)
  3. 'other', needs_review = True (source None: nothing recognised it)

Confidence is a Decimal with 3 places, ready for NUMERIC(4,3).
"""

import os
import re
from dataclasses import dataclass
from decimal import Decimal
from typing import Optional

from .model import NaiveBayes
from .rules import match_rule
from .taxonomy import side_of

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.json")
MODEL_THRESHOLD = 0.80
MIN_COVERAGE = 0.60

_THOUSANDTH = Decimal("0.001")


@dataclass(frozen=True)
class CategoryResult:
    category: str
    source: Optional[str]          # 'rule' | 'model' | None
    confidence: Decimal
    counterparty: Optional[str]
    needs_review: bool = False


_model: Optional[NaiveBayes] = None
_model_loaded = False


def get_model() -> Optional[NaiveBayes]:
    """Loads model.json once. Missing file -> None (rules only)."""
    global _model, _model_loaded
    if not _model_loaded:
        _model = NaiveBayes.load(MODEL_PATH) if os.path.exists(MODEL_PATH) else None
        _model_loaded = True
    return _model


# ---- counterparty ----
_REF_TAIL = re.compile(r"\s+REF\s*\d+\s*$", re.IGNORECASE)
_UPI_CR = re.compile(r"\bUPI\W*(?:CR|CREDIT)\W*\d+\W*(.+)$", re.IGNORECASE)
_UPI_DR = re.compile(r"\bUPI\W*(?:DR|DEBIT)\W*\d+\W*(.+)$", re.IGNORECASE)
_PO = re.compile(r"\bPO\W?\d{4}\W?\d{2}\W?\d{4}\W*(.+)$", re.IGNORECASE)


def extract_counterparty(narration: str) -> Optional[str]:
    """Name after UPI/CR/<ref>/ or UPI/DR/<ref>, or supplier text after a PO number."""
    text = _REF_TAIL.sub("", (narration or "").strip())
    for pattern in (_UPI_CR, _UPI_DR, _PO):
        m = pattern.search(text)
        if m:
            name = " ".join(m.group(1).split()).upper()
            return name or None
    return None


def categorize(narration: str, debit=None, credit=None) -> CategoryResult:
    side = side_of(debit, credit)
    counterparty = extract_counterparty(narration)

    category = match_rule(narration, side)
    if category:
        return CategoryResult(category, "rule", Decimal("1.000"), counterparty)

    model = get_model()
    confidence = Decimal("0.000")
    if model is not None:
        best, p = model.predict(narration, side)
        confidence = Decimal(str(p)).quantize(_THOUSANDTH)
        if best and best != "other" and p >= MODEL_THRESHOLD and model.coverage(narration) >= MIN_COVERAGE:
            return CategoryResult(best, "model", confidence, counterparty)

    return CategoryResult("other", None, confidence, counterparty, needs_review=True)
