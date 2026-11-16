"""
Tiny multinomial Naive Bayes on narration tokens. No dependencies.

Tokens: each word ('w:salary') plus its character trigrams with word
boundaries ('#sa', 'sal', ..., 'ry#'). Trigrams make it tolerant of
typos ('SATFF', 'RCEHARGE'). Digits are dropped (reference numbers carry
no meaning) and so is the trailing 'REF' marker some banks add.

Saved as JSON (model.json): per class the document count, the token
total and the token counts. Prediction only scores classes that agree
with the debit/credit side.
"""

import json
import math
import re
from typing import Dict, Iterable, List, Optional, Tuple

from .taxonomy import agrees

_WORD = re.compile(r"[a-z]+")
_STOP = {"ref"}
# Payment-channel and filler words appear on every kind of row, so they say
# nothing about whether the narration itself is familiar (coverage only).
_GENERIC = {"upi", "neft", "rtgs", "imps", "cr", "dr", "credit", "debit", "by", "to",
            "transfer", "trf", "and", "of", "ac"}


def words(text: str) -> List[str]:
    return [w for w in _WORD.findall((text or "").lower()) if len(w) >= 2 and w not in _STOP]


def tokens(text: str) -> List[str]:
    out = []
    for w in words(text):
        out.append("w:" + w)
        padded = "#" + w + "#"
        out.extend(padded[i:i + 3] for i in range(len(padded) - 2))
    return out


class NaiveBayes:
    def __init__(self, alpha: float = 0.5):
        self.alpha = alpha
        self.doc_counts: Dict[str, int] = {}
        self.totals: Dict[str, int] = {}
        self.counts: Dict[str, Dict[str, int]] = {}
        self.vocab_size = 0
        self.known_words: set = set()

    # ---- training ----
    def fit(self, samples: Iterable[Tuple[str, str]]) -> "NaiveBayes":
        """samples: (narration, label) pairs."""
        vocab = set()
        for text, label in samples:
            self.doc_counts[label] = self.doc_counts.get(label, 0) + 1
            bucket = self.counts.setdefault(label, {})
            for t in tokens(text):
                bucket[t] = bucket.get(t, 0) + 1
                vocab.add(t)
        self.totals = {c: sum(b.values()) for c, b in self.counts.items()}
        self.vocab_size = len(vocab)
        self.known_words = {t[2:] for t in vocab if t.startswith("w:")}
        return self

    # ---- prediction ----
    def coverage(self, text: str) -> float:
        """Share of the narration's content words (channel words ignored)
        seen in training (0..1)."""
        ws = [w for w in words(text) if w not in _GENERIC]
        if not ws:
            return 0.0
        return sum(1 for w in ws if w in self.known_words) / len(ws)

    def predict_proba(self, text: str, side: Optional[str] = None) -> Dict[str, float]:
        """Posterior over classes that agree with the side (sums to 1)."""
        classes = [c for c in self.doc_counts if agrees(c, side)]
        if not classes:
            return {}
        n_docs = sum(self.doc_counts[c] for c in classes)
        toks = tokens(text)
        logp = {}
        for c in classes:
            bucket = self.counts.get(c, {})
            denom = self.totals.get(c, 0) + self.alpha * (self.vocab_size + 1)
            lp = math.log(self.doc_counts[c] / n_docs)
            for t in toks:
                lp += math.log((bucket.get(t, 0) + self.alpha) / denom)
            logp[c] = lp
        top = max(logp.values())
        exp = {c: math.exp(v - top) for c, v in logp.items()}
        z = sum(exp.values())
        return {c: v / z for c, v in exp.items()}

    def predict(self, text: str, side: Optional[str] = None) -> Tuple[Optional[str], float]:
        proba = self.predict_proba(text, side)
        if not proba:
            return None, 0.0
        best = max(proba, key=proba.get)
        return best, proba[best]

    # ---- persistence ----
    def to_dict(self) -> dict:
        return {
            "version": 1,
            "alpha": self.alpha,
            "vocab_size": self.vocab_size,
            "classes": {
                c: {"docs": self.doc_counts[c], "total": self.totals[c], "counts": self.counts[c]}
                for c in sorted(self.doc_counts)
            },
        }

    @classmethod
    def from_dict(cls, data: dict) -> "NaiveBayes":
        m = cls(alpha=data["alpha"])
        m.vocab_size = data["vocab_size"]
        for c, d in data["classes"].items():
            m.doc_counts[c] = d["docs"]
            m.totals[c] = d["total"]
            m.counts[c] = d["counts"]
        m.known_words = {t[2:] for b in m.counts.values() for t in b if t.startswith("w:")}
        return m

    def save(self, path: str) -> None:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, sort_keys=True, separators=(",", ":"))

    @classmethod
    def load(cls, path: str) -> "NaiveBayes":
        with open(path, encoding="utf-8") as f:
            return cls.from_dict(json.load(f))
