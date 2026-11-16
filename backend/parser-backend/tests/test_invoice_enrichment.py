"""
Invoice enrichment (docs/CATEGORIZER_PLAN.md, Step 3). No database.

The six real generated invoices in tests/fixtures/categorizer/invoices/
go through the real invoice parser, then enrich_invoice(); the five
migration-005 fields must equal expected.json exactly.
"""

import ast
import json
import os
from datetime import date

import pytest

import enrichment
from enrichment.invoice import enrich_invoice, name_overlap
from invoice_parser.main import parse as parse_invoice

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures", "categorizer", "invoices")
BUSINESS = "Mauli Traders"

with open(os.path.join(FIXTURES, "expected.json"), encoding="utf-8") as _f:
    EXPECTED = json.load(_f)


def _d(s):
    return date.fromisoformat(s) if s else None


@pytest.fixture(scope="module")
def parsed():
    return {e["file"]: parse_invoice(os.path.join(FIXTURES, e["file"]), "tenant_test") for e in EXPECTED}


@pytest.mark.parametrize("exp", EXPECTED, ids=[e["file"] for e in EXPECTED])
def test_fixture_invoice_enrichment_matches_expected(parsed, exp):
    inv = parsed[exp["file"]]
    # parser sanity: the fields enrichment relies on
    assert inv.invoice_number == exp["invoice_number"]
    assert inv.invoice_date == _d(exp["invoice_date"])
    assert inv.raw_text

    got = enrich_invoice(inv, inv.raw_text, BUSINESS)
    paid_at = _d(exp["invoice_date"]) if exp["payment_mode"] in ("cash", "upi") else None
    assert got == {
        "direction": exp["direction"],
        "party_name": exp["party_name"],
        "payment_mode": exp["payment_mode"],
        "due_date": _d(exp["due_date"]),
        "paid_at": paid_at,
    }


def test_raw_text_not_in_api_response(parsed):
    """raw_text is for enrichment only; /api/parse returns model_dump()."""
    inv = next(iter(parsed.values()))
    assert "raw_text" not in inv.model_dump(mode="json")


# ---- direction and names ----

def test_name_overlap_ignores_case_punctuation_and_suffixes():
    assert name_overlap("MAULI TRADERS", "Mauli Traders") == 1.0
    assert name_overlap("M/s. Mauli Traders Pvt. Ltd.", "Mauli Traders") == 1.0
    assert name_overlap("Traders", "Mauli Traders") < 0.8
    assert name_overlap(None, "Mauli Traders") == 0.0


def test_purchase_invoice_party_is_vendor():
    text = "SANGLI APMC GRAIN MERCHANTS\nBilling Details\nName: Mauli Traders Invoice Date : 05-Apr-2025\nPayment Mode : Credit (30 days)\n"
    got = enrich_invoice({"vendor_name": "Sangli APMC Grain Merchants", "invoice_date": date(2025, 4, 5)}, text, BUSINESS)
    assert got["direction"] == "purchase"
    assert got["party_name"] == "Sangli APMC Grain Merchants"
    assert got["payment_mode"] == "credit"
    assert got["due_date"] == date(2025, 5, 5)  # no Due Date line: invoice date + 30 days
    assert got["paid_at"] is None


def test_settled_by_is_used_when_payment_mode_line_missing():
    text = "Billing Details\nName: Amit Tea Point\nSettled by: UPI | Invoice Balance: Rs 0.00 (Paid in full)"
    got = enrich_invoice({"vendor_name": "MAULI TRADERS", "invoice_date": "02-Apr-2025"}, text, BUSINESS)
    assert got == {"direction": "sale", "party_name": "Amit Tea Point", "payment_mode": "upi",
                   "due_date": None, "paid_at": date(2025, 4, 2)}


def test_due_date_from_settled_by_brackets():
    text = "Settled by: Credit (15 days) | Invoice Balance: Rs 614.30 (Due 13-Nov-2025)"
    got = enrich_invoice({"vendor_name": "MAULI TRADERS", "invoice_date": date(2025, 10, 29)}, text, BUSINESS)
    assert got["due_date"] == date(2025, 11, 13)


# ---- missing data never raises ----

@pytest.mark.parametrize("parsed_in,text,biz", [
    (None, None, None),
    ({}, "", BUSINESS),
    ({"vendor_name": "MAULI TRADERS"}, None, BUSINESS),
    ({"vendor_name": None, "invoice_date": "not a date"}, "Payment Mode : Credit", BUSINESS),
    (object(), 12345, BUSINESS),
])
def test_missing_fields_give_none_not_exceptions(parsed_in, text, biz):
    got = enrich_invoice(parsed_in, text, biz)
    assert set(got) == {"direction", "party_name", "payment_mode", "due_date", "paid_at"}


def test_sale_without_customer_line_has_null_party():
    got = enrich_invoice({"vendor_name": "MAULI TRADERS"}, "TAX INVOICE\nTotal Rs 90.00", BUSINESS)
    assert got["direction"] == "sale"
    assert got["party_name"] is None
    assert got["payment_mode"] is None


def test_no_claude_api_in_enrichment():
    pkg_dir = os.path.dirname(enrichment.__file__)
    for name in os.listdir(pkg_dir):
        if not name.endswith(".py"):
            continue
        with open(os.path.join(pkg_dir, name), encoding="utf-8") as f:
            tree = ast.parse(f.read(), filename=name)
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                mods = [a.name for a in node.names]
            elif isinstance(node, ast.ImportFrom):
                mods = [node.module or ""]
            else:
                continue
            assert not any("anthropic" in m or "claude_client" in m for m in mods), f"{name} imports {mods}"
