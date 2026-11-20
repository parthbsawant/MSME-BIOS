"""
Categorizer (docs/CATEGORIZER_PLAN.md, Step 2). No database.

Scores the committed categorizer/model.json on the test split of
tests/fixtures/categorizer/bank_labeled.csv (label_stage1).
"""

import ast
import os
from decimal import Decimal

import pytest

import categorizer
from categorizer.categorize import MODEL_PATH, categorize, extract_counterparty
from categorizer.evaluate import accuracy, score
from categorizer.model import NaiveBayes
from categorizer.rules import match_rule
from categorizer.taxonomy import SIDE, STAGE1_CATEGORIES, side_of


@pytest.fixture(scope="module")
def scored():
    return score()


def test_clean_test_accuracy_at_least_99(scored):
    clean = [p for p in scored if p[0]["variant"] == "clean"]
    assert len(clean) > 500
    assert accuracy(clean) >= 0.99


def test_messy_test_accuracy_at_least_90(scored):
    messy = [p for p in scored if p[0]["variant"] == "messy"]
    assert len(messy) > 500
    assert accuracy(messy) >= 0.90


def test_other_rows_are_flagged_for_review(scored):
    others = [res for r, res in scored if r["label_stage1"] == "other"]
    assert others
    flagged = sum(1 for res in others if res.category == "other" and res.needs_review)
    assert flagged / len(others) >= 0.85


def test_model_alone_handles_messy_text(scored):
    """The Naive Bayes backup must be useful without the rules."""
    model = NaiveBayes.load(MODEL_PATH)
    rows = [r for r, _ in scored if r["variant"] == "messy" and r["label_stage1"] != "other"]
    ok = sum(1 for r in rows if model.predict(r["narration"], side_of(r["debit"], r["credit"]))[0] == r["label_stage1"])
    assert ok / len(rows) >= 0.90


# ---- debit / credit side ----

def test_side_of():
    assert side_of("100.00", "0") == "debit"
    assert side_of(None, Decimal("5")) == "credit"
    assert side_of(0, 0) is None
    assert side_of("", "abc") is None


def test_rule_ignored_on_wrong_side():
    # A UPI credit narration on the debit side is not a customer receipt.
    assert match_rule("UPI/CR/123456/RAMESH", "credit") == "customer_receipt"
    assert match_rule("UPI/CR/123456/RAMESH", "debit") is None
    # Salary is a debit; on the credit side the rule is skipped.
    assert match_rule("NEFT DR SALARY TRANSFER STAFF", "debit") == "salary"
    assert match_rule("NEFT DR SALARY TRANSFER STAFF", "credit") is None


def test_categorize_never_returns_wrong_side():
    res = categorize("NEFT DR SALARY TRANSFER STAFF", debit=None, credit="5000")
    assert SIDE[res.category] in (None, "credit")


def test_every_category_has_a_side_entry():
    assert set(STAGE1_CATEGORIES) <= set(SIDE)
    assert "collection" not in STAGE1_CATEGORIES and "sales_upi" not in STAGE1_CATEGORIES


# ---- result shape ----

def test_rule_result_shape():
    res = categorize("UPI/CR/650929674642/SHARMA CATERERS", 0, "2258.10")
    assert res.category == "customer_receipt"
    assert res.source == "rule"
    assert res.confidence == Decimal("1.000")
    assert res.counterparty == "SHARMA CATERERS"
    assert res.needs_review is False


def test_unknown_text_goes_to_other_with_review():
    res = categorize("POS PURCHASE AMAZON PAY 4258", "999", 0)
    assert res.category == "other"
    assert res.source is None
    assert res.needs_review is True


def test_counterparty_extraction():
    assert extract_counterparty("UPI/CR/650929674642/SHARMA CATERERS") == "SHARMA CATERERS"
    assert extract_counterparty("upi-cr-539704878636/annapurna upahar kedra REF853223") == "ANNAPURNA UPAHAR KEDRA"
    assert extract_counterparty("BY TRANSFER-UPI/CR/4318877999/SHREE SAI HOTEL REF746010") == "SHREE SAI HOTEL"
    assert extract_counterparty("UPI/DR/0615887269 MOBILE AND BROADBAND RECHARGE") == "MOBILE AND BROADBAND RECHARGE"
    assert extract_counterparty("NEFT DR PO-2025-12-0021 SANGLI APMC GRAIN MERCHA") == "SANGLI APMC GRAIN MERCHA"
    assert extract_counterparty("CASH DEPOSIT SELF BRANCH") is None
    assert extract_counterparty(None) is None


# ---- model file and guards ----

def test_model_json_is_small():
    assert os.path.getsize(MODEL_PATH) < 1024 * 1024


def test_no_claude_api_in_categorizer():
    """No module in categorizer/ imports anthropic or claude_client."""
    pkg_dir = os.path.dirname(categorizer.__file__)
    banned = ("anthropic", "claude_client", "msme_bios_shared.claude_client")
    for name in os.listdir(pkg_dir):
        if not name.endswith(".py"):
            continue
        with open(os.path.join(pkg_dir, name), encoding="utf-8") as f:
            tree = ast.parse(f.read(), filename=name)
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                mods = [a.name for a in node.names]
            elif isinstance(node, ast.ImportFrom):
                mods = [node.module or ""] + [a.name for a in node.names]
            else:
                continue
            for m in mods:
                assert not any(b in m for b in banned), f"{name} imports {m}"
