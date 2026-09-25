"""
validator.py — Validates extracted handwritten bill data. This is the
ONLY real correctness signal available for this parser (see
docs/PARSER_GUIDE.md Section 3) - there's no structured-extraction path to
cross-check against, so line-item math is what catches misread handwriting.
"""

from handwritten_parser.models import HandwrittenBillResult


def validate_line_items_sum_to_total(bill: HandwrittenBillResult, tolerance: float = 0.5) -> HandwrittenBillResult:
    """If a total was stated, line items should sum to it. If no total was
    written on the bill at all (common - many handwritten bills just list
    items and expect someone to add them up), compute one instead of
    treating the absence as an error."""
    known_amounts = [item.amount for item in bill.line_items if item.amount is not None]
    computed_total = round(sum(known_amounts), 2) if known_amounts else None

    if bill.total is None:
        bill.total = computed_total
        return bill

    if computed_total is not None and abs(computed_total - bill.total) > tolerance:
        bill.needs_review = True
        bill.review_reason = (
            f"Line items sum to {computed_total}, but stated total is {bill.total}"
        )
    return bill


def flag_illegible_fields(bill: HandwrittenBillResult) -> HandwrittenBillResult:
    """Any line item with a missing description or amount means something
    was illegible - flag the whole bill for human review rather than
    silently treating a None as a zero."""
    for item in bill.line_items:
        if item.description is None or item.amount is None:
            bill.needs_review = True
            reason = "At least one line item has an illegible description or amount"
            bill.review_reason = (
                (bill.review_reason + " | " if bill.review_reason else "") + reason
            )
            break
    return bill


def validate_all(bill: HandwrittenBillResult) -> HandwrittenBillResult:
    """The one entry point main.py should call for validation."""
    bill = flag_illegible_fields(bill)
    bill = validate_line_items_sum_to_total(bill)
    return bill
