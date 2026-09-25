"""
structured_extractor.py — Extracts header fields, line items, and totals
from a DIGITAL invoice PDF using pdfplumber.

This is the in-house, no-AI-needed extraction path.
"""

import re

import pdfplumber
from typing import Optional


# ============================================================
# HEADER SYNONYMS
# ============================================================

DESC_HEADERS = {
    "description",
    "item",
    "particulars",
    "item description",
}

QTY_HEADERS = {
    "qty",
    "quantity",
}

RATE_HEADERS = {
    "rate",
    "price",
    "unit price",
    "rate (rs)",
}

# Taxable Value means the PRE-TAX line amount.
# This is the amount used by InvoiceLineItem.amount.
TAXABLE_VALUE_HEADERS = {
    "taxable value",
    "taxable amount",
}

# Generic fallback amount headers.
AMOUNT_HEADERS = {
    "amount",
    "total",
    "line total",
    "total (rs)",
}

CGST_RATE_HEADERS = {
    "cgst %",
    "cgst rate",
}

GST_RATE_HEADERS = {
    "gst %",
    "gst rate",
}


# ============================================================
# FOOTER / SUMMARY ROWS
# ============================================================

# These are NOT actual invoice line items.
# Real invoices often place these rows immediately after
# the actual products/services.
SUMMARY_ROW_LABELS = {
    "taxable value",
    "subtotal",
    "total taxable value",
    "total cgst",
    "total sgst",
    "cgst",
    "sgst",
    "total",
    "total rs",
    "discount",
    "round off",
    "rounding",
    "grand total",
    "invoice total",
}


# ============================================================
# NORMALIZATION
# ============================================================

def _normalize(header_cell: Optional[str]) -> str:
    """
    Lowercase, strip whitespace, and collapse embedded
    newlines/extra spaces.

    Example:
        "Taxable\\nValue" -> "taxable value"
    """

    text = (header_cell or "").strip().lower()

    return " ".join(text.split())


# ============================================================
# HEADER FIELD EXTRACTION
# ============================================================

def extract_header_fields(text: str) -> dict:
    """
    Extracts vendor name, invoice number, date, and GSTIN
    from the raw text of an invoice header.
    """

    fields = {}

    # ---------------------------------------------------------
    # Invoice Number
    # ---------------------------------------------------------
    invoice_num_match = re.search(
        r"Invoice\s*(?:Number|No\.?)\s*:?\s*([A-Za-z0-9/-]+)",
        text,
        re.IGNORECASE,
    )

    if invoice_num_match:
        fields["invoice_number"] = invoice_num_match.group(1).strip()

    # ---------------------------------------------------------
    # Invoice Date
    # ---------------------------------------------------------
    date_match = re.search(
        r"Invoice\s*Date\s*:?\s*([0-9]{1,2}-[A-Za-z]{3}-[0-9]{4})",
        text,
        re.IGNORECASE,
    )

    if date_match:
        fields["invoice_date"] = date_match.group(1).strip()

    # ---------------------------------------------------------
    # GSTIN
    # ---------------------------------------------------------
    gstin_match = re.search(
        r"GSTIN\s*:?\s*([A-Z0-9]{15})",
        text,
        re.IGNORECASE,
    )

    if gstin_match:
        fields["gstin"] = gstin_match.group(1).strip()

    # ---------------------------------------------------------
    # Vendor Name
    #
    # BUG FIX: the previous version searched the WHOLE document for the
    # first "Name:" match - but on the real invoice template, "Name:" only
    # ever labels the CUSTOMER's name (inside "Billing Details"), never
    # the vendor's own name, which appears unlabeled as a header before
    # that section. This meant vendor_name was silently being filled with
    # the customer's name instead - confirmed on a real invoice where
    # "Zilla Parishad School Mess" (the customer) showed up as the vendor
    # instead of "Mauli Traders" (the actual vendor).
    #
    # Fix: restrict the vendor-name search to the text BEFORE "Billing
    # Details" starts, where the real invoice always puts the vendor's own
    # header. If no "Billing Details" marker is found at all (e.g. a
    # simpler document without that section), fall back to the original
    # whole-text "Name:" search, since there's no better signal available
    # to distinguish vendor from customer in that case.
    # ---------------------------------------------------------
    billing_details_pos = re.search(r"Billing\s*Details", text, re.IGNORECASE)

    if billing_details_pos:
        header_text = text[:billing_details_pos.start()]
        boilerplate_patterns = [
            r"^page\s*no", r"^tax\s*invoice", r"^original\s*for",
            r"^recipient$", r"^duplicate", r"^triplicate",
        ]
        vendor_name = None
        for line in header_text.split("\n"):
            line_stripped = " ".join(line.split())
            if not line_stripped:
                continue
            if any(re.match(p, line_stripped, re.IGNORECASE) for p in boilerplate_patterns):
                continue
            vendor_name = line_stripped
            break
        if vendor_name:
            fields["vendor_name"] = vendor_name
    else:
        name_match = re.search(
            r"Name\s*:\s*(.+?)"
            r"(?=\s+(?:GSTIN|Invoice\s*Date|Invoice\s*Number|"
            r"Invoice\s*No|Mobile|Email)\b|$)",
            text,
            re.IGNORECASE,
        )
        if name_match:
            vendor_name = " ".join(name_match.group(1).split())
            if vendor_name:
                fields["vendor_name"] = vendor_name

    return fields
# ============================================================
# LINE ITEM COLUMN IDENTIFICATION
# ============================================================

def identify_line_item_columns(
    header_row: list[Optional[str]],
) -> dict[str, int]:
    """
    Identify line-item column positions using header synonyms.

    Taxable Value is checked before generic amount headers so
    that a GST-inclusive Total column is not selected when a
    Taxable Value column is available.
    """

    columns: dict[str, int] = {}

    for idx, cell in enumerate(header_row):

        normalized = _normalize(cell)

        # Description
        if (
            normalized in DESC_HEADERS
            and "description" not in columns
        ):
            columns["description"] = idx

        # Quantity
        elif (
            normalized in QTY_HEADERS
            and "qty" not in columns
        ):
            columns["qty"] = idx

        # Rate
        elif (
            normalized in RATE_HEADERS
            and "rate" not in columns
        ):
            columns["rate"] = idx

        # Taxable Value
        elif (
            normalized in TAXABLE_VALUE_HEADERS
            and "amount" not in columns
        ):
            columns["amount"] = idx

        # CGST rate
        elif (
            normalized in CGST_RATE_HEADERS
            and "cgst_rate" not in columns
        ):
            columns["cgst_rate"] = idx

        # GST rate
        elif (
            normalized in GST_RATE_HEADERS
            and "gst_rate" not in columns
        ):
            columns["gst_rate"] = idx

    # --------------------------------------------------------
    # Generic amount fallback
    # --------------------------------------------------------

    if "amount" not in columns:

        for idx, cell in enumerate(header_row):

            normalized = _normalize(cell)

            if normalized in AMOUNT_HEADERS:
                columns["amount"] = idx
                break

    return columns


# ============================================================
# SUMMARY ROW DETECTION
# ============================================================

def _is_summary_row(description: Optional[str]) -> bool:
    """
    Returns True when a table row is a totals/summary row
    rather than an actual invoice line item.
    """

    if not description:
        return False

    normalized = _normalize(description)

    if not normalized:
        return True

    # Exact summary labels
    if normalized in SUMMARY_ROW_LABELS:
        return True

    # Summary labels with extra text, for example:
    # "Total CGST 10.20"
    # "Total SGST 10.20"
    # "Taxable Value 850.00"
    summary_prefixes = (
        "taxable value",
        "total taxable value",
        "subtotal",
        "total cgst",
        "total sgst",
        "discount",
        "round off",
        "rounding",
        "grand total",
        "invoice total",
    )

    for prefix in summary_prefixes:
        if normalized.startswith(prefix):
            return True

    return False


# ============================================================
# TOTALS EXTRACTION
# ============================================================

def extract_totals(text: str) -> dict:
    """
    Extract subtotal, CGST, SGST, and grand total
    from the invoice totals section.
    """

    totals = {}

    # --------------------------------------------------------
    # Taxable Value / Subtotal
    # --------------------------------------------------------

    subtotal_match = re.search(
        r"Taxable\s*Value\s*"
        r"([0-9][\d,]*\.\d{2})",
        text,
        re.IGNORECASE,
    )

    if subtotal_match:

        totals["subtotal"] = float(
            subtotal_match.group(1).replace(",", "")
        )

    # --------------------------------------------------------
    # Total CGST
    # --------------------------------------------------------

    cgst_match = re.search(
        r"Total\s*CGST\s*"
        r"([0-9][\d,]*\.\d{2})",
        text,
        re.IGNORECASE,
    )

    if cgst_match:

        totals["cgst_amount"] = float(
            cgst_match.group(1).replace(",", "")
        )

    # --------------------------------------------------------
    # Total SGST
    # --------------------------------------------------------

    sgst_match = re.search(
        r"Total\s*SGST\s*"
        r"([0-9][\d,]*\.\d{2})",
        text,
        re.IGNORECASE,
    )

    if sgst_match:

        totals["sgst_amount"] = float(
            sgst_match.group(1).replace(",", "")
        )

    # --------------------------------------------------------
    # Grand Total
    # --------------------------------------------------------

    total_match = re.search(
        r"Total\s*Rs\.?\s*"
        r"([0-9][\d,]*\.\d{2})",
        text,
        re.IGNORECASE,
    )

    if total_match:

        totals["total"] = float(
            total_match.group(1).replace(",", "")
        )

    return totals


# ============================================================
# MAIN STRUCTURED EXTRACTION
# ============================================================

def extract_raw_invoice(file_path: str) -> dict:
    """
    Extract everything from a digital invoice PDF:

    - header fields
    - line items
    - totals

    Returns a dictionary that main.py converts into InvoiceResult.
    """

    with pdfplumber.open(file_path) as pdf:

        # ----------------------------------------------------
        # 1. Extract all raw text from ALL pages
        # ----------------------------------------------------

        full_text = "\n".join(
            page.extract_text() or ""
            for page in pdf.pages
        )

        # ----------------------------------------------------
        # 2. Extract header fields
        # ----------------------------------------------------

        header_fields = extract_header_fields(full_text)

        # ----------------------------------------------------
        # 3. Extract totals
        # ----------------------------------------------------

        totals = extract_totals(full_text)

        # ----------------------------------------------------
        # 4. Extract line items
        # ----------------------------------------------------

        raw_line_items = []

        # IMPORTANT:
        # Iterate over EVERY page.
        # This also supports multi-page invoices.
        for page in pdf.pages:

            tables = page.extract_tables()

            for table in tables:

                # Ignore empty/small tables.
                if not table or len(table) < 2:
                    continue

                # ------------------------------------------------
                # Find the actual line-item header row
                # ------------------------------------------------

                header_index = None
                columns = {}

                for idx, candidate_header in enumerate(table):

                    candidate_columns = (
                        identify_line_item_columns(
                            candidate_header
                        )
                    )

                    # A usable invoice line-item table must
                    # have at least description + amount.
                    if (
                        "description" in candidate_columns
                        and "amount" in candidate_columns
                    ):
                        header_index = idx
                        columns = candidate_columns
                        break

                # No recognizable line-item table.
                if header_index is None:
                    continue

                # ------------------------------------------------
                # Read rows after the actual header
                # ------------------------------------------------

                for row in table[header_index + 1:]:

                    if not row:
                        continue

                    # ------------------------------------------------
                    # Description
                    # ------------------------------------------------

                    description_index = columns["description"]

                    if description_index >= len(row):
                        continue

                    desc = row[description_index]

                    if not desc or not str(desc).strip():
                        continue

                    desc = str(desc).strip()

                    # ------------------------------------------------
                    # IMPORTANT:
                    # Do NOT treat totals/footer rows as items.
                    # ------------------------------------------------

                    if _is_summary_row(desc):
                        continue

                    # ------------------------------------------------
                    # Quantity
                    # ------------------------------------------------

                    qty = None

                    if (
                        "qty" in columns
                        and columns["qty"] < len(row)
                    ):
                        qty = row[columns["qty"]]

                    # ------------------------------------------------
                    # Rate
                    # ------------------------------------------------

                    rate = None

                    if (
                        "rate" in columns
                        and columns["rate"] < len(row)
                    ):
                        rate = row[columns["rate"]]

                    # ------------------------------------------------
                    # Taxable Amount
                    # ------------------------------------------------

                    amount = None

                    if (
                        "amount" in columns
                        and columns["amount"] < len(row)
                    ):
                        amount = row[columns["amount"]]

                    # ------------------------------------------------
                    # CGST Rate
                    # ------------------------------------------------

                    cgst_rate = None

                    if (
                        "cgst_rate" in columns
                        and columns["cgst_rate"] < len(row)
                    ):
                        cgst_rate = row[columns["cgst_rate"]]

                    # ------------------------------------------------
                    # GST Rate
                    # ------------------------------------------------

                    gst_rate = None

                    if (
                        "gst_rate" in columns
                        and columns["gst_rate"] < len(row)
                    ):
                        gst_rate = row[columns["gst_rate"]]

                    # ------------------------------------------------
                    # Store actual line item
                    # ------------------------------------------------

                    raw_line_items.append(
                        {
                            "description": desc,
                            "qty": qty,
                            "rate": rate,
                            "amount": amount,
                            "cgst_rate": cgst_rate,
                            "gst_rate": gst_rate,
                        }
                    )

        # ----------------------------------------------------
        # 5. Return final raw extraction
        # ----------------------------------------------------

        return {
            "header_fields": header_fields,
            "line_items": raw_line_items,
            "totals": totals,
        }