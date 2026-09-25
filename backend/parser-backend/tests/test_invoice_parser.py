"""
Tests for invoice_parser. Run with: pytest tests/ -v
"""

import pytest
from datetime import date
from invoice_parser.models import InvoiceLineItem, InvoiceResult
from invoice_parser.structured_extractor import (
    extract_header_fields, extract_totals, identify_line_item_columns,
)
from invoice_parser.validator import validate_line_items_sum_to_subtotal, validate_gst_math
from invoice_parser.main import _clean_amount, _parse_date


# ---- models.py ----

def test_invoice_result_defaults():
    r = InvoiceResult(tenant_id="t1", source_file="x.pdf", extraction_method="structured",
                       extracted_at="2025-04-25T00:00:00")
    assert r.source_type == "invoice_bill"
    assert r.needs_review is False


# ---- structured_extractor.py: header field extraction ----

def test_extract_header_fields():
    text = "Invoice Number : 00446/25-26\nInvoice Date : 28-Aug-2025\nGSTIN: 27ABCDE1234F1Z5\nName: Test Vendor"
    fields = extract_header_fields(text)
    assert fields["invoice_number"] == "00446/25-26"
    assert fields["invoice_date"] == "28-Aug-2025"
    assert fields["gstin"] == "27ABCDE1234F1Z5"


def test_extract_totals():
    text = "Taxable Value 1908.00\nTotal CGST 47.70\nTotal SGST 47.70\nTotal Rs 2003.40"
    totals = extract_totals(text)
    assert totals["subtotal"] == 1908.00
    assert totals["cgst_amount"] == 47.70
    assert totals["sgst_amount"] == 47.70
    assert totals["total"] == 2003.40


def test_identify_line_item_columns():
    header = ["Sr.", "Item Description", "HSN/SAC", "Qty", "Unit", "Rate (Rs)", "Taxable Value",
              "CGST %", "CGST Amt", "SGST %", "SGST Amt", "Total (Rs)"]
    cols = identify_line_item_columns(header)
    assert cols["description"] == 1
    assert cols["qty"] == 3
    assert cols["rate"] == 5


# ---- validator.py: reuses real gst_utils.py ----

def test_validate_line_items_sum_correct():
    invoice = InvoiceResult(
        tenant_id="t1", source_file="x.pdf", extraction_method="structured",
        extracted_at="2025-04-25T00:00:00",
        line_items=[InvoiceLineItem(description="Item A", qty=1, rate=380.0, amount=380.0, gst_pct=5.0)],
        subtotal=380.0, cgst_amount=9.5, sgst_amount=9.5,
    )
    result = validate_line_items_sum_to_subtotal(invoice)
    assert result.needs_review is False


def test_validate_line_items_sum_mismatch():
    invoice = InvoiceResult(
        tenant_id="t1", source_file="x.pdf", extraction_method="structured",
        extracted_at="2025-04-25T00:00:00",
        line_items=[InvoiceLineItem(description="Item A", qty=1, rate=380.0, amount=380.0, gst_pct=5.0)],
        subtotal=999.0,  # wrong on purpose
    )
    result = validate_line_items_sum_to_subtotal(invoice)
    assert result.needs_review is True


def test_validate_gst_math_correct():
    # 380 taxable @ 5% GST -> CGST 9.5, SGST 9.5 (matches gst_utils.split_cgst_sgst exactly)
    invoice = InvoiceResult(
        tenant_id="t1", source_file="x.pdf", extraction_method="structured",
        extracted_at="2025-04-25T00:00:00",
        line_items=[InvoiceLineItem(description="Item A", qty=1, rate=380.0, amount=380.0, gst_pct=5.0)],
        subtotal=380.0, cgst_amount=9.5, sgst_amount=9.5,
    )
    result = validate_gst_math(invoice)
    assert result.needs_review is False


def test_validate_gst_math_catches_wrong_split():
    invoice = InvoiceResult(
        tenant_id="t1", source_file="x.pdf", extraction_method="structured",
        extracted_at="2025-04-25T00:00:00",
        line_items=[InvoiceLineItem(description="Item A", qty=1, rate=380.0, amount=380.0, gst_pct=5.0)],
        subtotal=380.0, cgst_amount=19.0, sgst_amount=0.0,  # wrong split
    )
    result = validate_gst_math(invoice)
    assert result.needs_review is True
    assert "GST math mismatch" in result.review_reason


# ---- main.py helpers ----

def test_clean_amount():
    assert _clean_amount("1,908.00") == 1908.00
    assert _clean_amount(None) == 0.0


def test_parse_date():
    assert _parse_date("28-Aug-2025") == date(2025, 8, 28)
    assert _parse_date(None) is None
