"""
validator.py — Validates extracted invoices. Reuses gst_utils.py (now a
proper submodule at invoice_parser/vendor/) for tax math rather than
reimplementing CGST/SGST logic.
"""

from invoice_parser.vendor.gst_utils import split_cgst_sgst
from invoice_parser.models import InvoiceResult


def validate_line_items_sum_to_subtotal(invoice: InvoiceResult, tolerance: float = 0.5) -> InvoiceResult:
    """Line items should sum to the declared subtotal. A small tolerance
    (default Rs0.50) allows for real-world rounding differences without
    letting genuine extraction errors slip through."""
    if not invoice.line_items:
        invoice.needs_review = True
        invoice.review_reason = "No line items extracted"
        return invoice

    computed_subtotal = round(sum(item.amount for item in invoice.line_items), 2)
    if abs(computed_subtotal - invoice.subtotal) > tolerance:
        invoice.needs_review = True
        invoice.review_reason = (
            f"Line items sum to {computed_subtotal}, but stated subtotal is {invoice.subtotal}"
        )
    return invoice


def validate_gst_math(invoice: InvoiceResult, tolerance: float = 0.5) -> InvoiceResult:
    """Checks that the invoice's CGST/SGST amounts are consistent with a
    correct intra-state split, using the same gst_utils.split_cgst_sgst()
    logic the invoice generation engine itself uses."""
    if not invoice.line_items:
        return invoice  # already flagged by the subtotal check above

    expected_cgst = 0.0
    expected_sgst = 0.0
    for item in invoice.line_items:
        taxable = item.qty * item.rate
        _, cgst_amt, _, sgst_amt = split_cgst_sgst(taxable, item.gst_pct)
        expected_cgst += cgst_amt
        expected_sgst += sgst_amt

    expected_cgst = round(expected_cgst, 2)
    expected_sgst = round(expected_sgst, 2)

    if abs(expected_cgst - invoice.cgst_amount) > tolerance or abs(expected_sgst - invoice.sgst_amount) > tolerance:
        invoice.needs_review = True
        reason = (
            f"GST math mismatch: expected CGST {expected_cgst}/SGST {expected_sgst}, "
            f"invoice shows CGST {invoice.cgst_amount}/SGST {invoice.sgst_amount}"
        )
        invoice.review_reason = (
            (invoice.review_reason + " | " if invoice.review_reason else "") + reason
        )
    return invoice


def validate_all(invoice: InvoiceResult) -> InvoiceResult:
    """The one entry point main.py should call for validation."""
    invoice = validate_line_items_sum_to_subtotal(invoice)
    invoice = validate_gst_math(invoice)
    return invoice
