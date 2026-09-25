"""
gst_utils.py — Shared GST math and formatting helpers.

This is copied directly from the invoice generation engine (already built
and tested this term) - not reimplemented. See docs/PARSER_GUIDE.md for
why this matters: the tax-math validation logic should exist in exactly
one place, not be rewritten per-project.
"""


def split_cgst_sgst(taxable_value, gst_rate_pct):
    """
    For INTRA-STATE supply, GST law requires the tax to be split into
    CGST + SGST shown SEPARATELY, never as one combined "GST" figure.

    Returns: (cgst_rate_pct, cgst_amount, sgst_rate_pct, sgst_amount)
    """
    half_rate = gst_rate_pct / 2
    half_amount = round(taxable_value * half_rate / 100, 2)
    return half_rate, half_amount, half_rate, half_amount


def number_to_words(amount):
    """Converts a rupee amount (float) into Indian-style words, e.g.
    2003.40 -> "Rupees Two Thousand Three and 40 Paise Only" """
    ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
            'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
            'Seventeen', 'Eighteen', 'Nineteen']
    tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

    def two_digit(x):
        if x < 20:
            return ones[x]
        return tens[x // 10] + (' ' + ones[x % 10] if x % 10 else '')

    def three_digit(x):
        if x >= 100:
            return ones[x // 100] + ' Hundred' + (' ' + two_digit(x % 100) if x % 100 else '')
        return two_digit(x)

    rupees = int(amount)
    paise = int(round((amount - rupees) * 100))

    if rupees == 0:
        rupee_words = 'Zero'
    else:
        n = rupees
        parts = []
        crore, n = divmod(n, 10000000)
        lakh, n = divmod(n, 100000)
        thousand, n = divmod(n, 1000)
        rest = n
        if crore:
            parts.append(three_digit(crore) + ' Crore')
        if lakh:
            parts.append(three_digit(lakh) + ' Lakh')
        if thousand:
            parts.append(three_digit(thousand) + ' Thousand')
        if rest:
            parts.append(three_digit(rest))
        rupee_words = ' '.join(parts)

    return f"Rupees {rupee_words} and {paise} Paise Only"


def compute_invoice_totals(line_items):
    """
    Given a list of line items (each a dict with qty, rate, gst_pct), computes
    the full set of invoice-level totals.

    Each input line item dict needs: name, hsn, qty, unit, rate, gst_pct
    Returns a new list of ENRICHED line items plus a totals dict.
    """
    enriched = []
    subtotal = 0.0
    cgst_total = 0.0
    sgst_total = 0.0

    for item in line_items:
        taxable = round(item['qty'] * item['rate'], 2)
        cgst_rate, cgst_amt, sgst_rate, sgst_amt = split_cgst_sgst(taxable, item['gst_pct'])
        line_total = round(taxable + cgst_amt + sgst_amt, 2)

        subtotal += taxable
        cgst_total += cgst_amt
        sgst_total += sgst_amt

        enriched.append({
            **item,
            'taxable_value': taxable,
            'cgst_rate': cgst_rate, 'cgst_amount': cgst_amt,
            'sgst_rate': sgst_rate, 'sgst_amount': sgst_amt,
            'line_total': line_total,
        })

    grand_total = round(subtotal + cgst_total + sgst_total, 2)

    totals = {
        'subtotal': round(subtotal, 2),
        'cgst_total': round(cgst_total, 2),
        'sgst_total': round(sgst_total, 2),
        'grand_total': grand_total,
        'amount_in_words': number_to_words(grand_total),
    }
    return enriched, totals
