"""
main.py — The single entry point for this parser, matching the shared
contract from docs/MASTER_REFERENCE.md Section 4.1.
"""

import re
from datetime import datetime, date
from typing import Optional, Union

from invoice_parser.detector import is_digital_pdf
from invoice_parser.structured_extractor import extract_raw_invoice
from invoice_parser.ai_extractor import extract_from_scanned
from invoice_parser.validator import validate_all
from invoice_parser.models import InvoiceLineItem, InvoiceResult
from msme_bios_shared import config


def _clean_amount(raw) -> float:
    if raw is None:
        return 0.0
    if isinstance(raw, (int, float)):
        return float(raw)
    cleaned = re.sub(r"[^\d.]", "", str(raw))
    return float(cleaned) if cleaned else 0.0


def _parse_date(raw: Union[str, date, None]) -> Optional[date]:
    if raw is None:
        return None
    if isinstance(raw, date):
        return raw
    for fmt in ["%d-%b-%Y", "%d/%m/%Y", "%d-%m-%Y"]:
        try:
            return datetime.strptime(str(raw).strip(), fmt).date()
        except ValueError:
            continue
    return None  # unparseable date - leave None, validator will catch downstream issues


def parse(file_path: str, tenant_id: str) -> InvoiceResult:
    """
    Parses an invoice/bill PDF into a structured, validated record.

    Currently only the digital-PDF path is implemented (Phase A). Scanned
    invoices will raise NotImplementedError until Phase B (see
    ai_extractor.py) - this is intentional, not a bug.
    """
    if is_digital_pdf(file_path):
        raw = extract_raw_invoice(file_path)
        extraction_method = "structured"
    else:
        if not config.ENABLE_CLAUDE_VISION_INVOICE:
            raise NotImplementedError(
                "This looks like a scanned invoice, which needs AI vision - "
                "not yet enabled for the invoice parser. Set ENABLE_CLAUDE_VISION_INVOICE=true "
                "in .env once this parser's AI path is approved and ready to use."
            )
        raw = extract_from_scanned(file_path)
        extraction_method = "ai_vision"

    header = raw["header_fields"]
    totals = raw["totals"]

    line_items = []
    for item in raw["line_items"]:
        # A table usually shows CGST % (half the real rate) rather than a
        # combined GST %, since CGST/SGST are always shown split (see
        # validator.py). Double a CGST rate to get the full GST rate that
        # gst_utils.split_cgst_sgst() expects.
        if item.get("gst_rate") is not None:
            gst_pct = _clean_amount(item["gst_rate"])
        elif item.get("cgst_rate") is not None:
            gst_pct = _clean_amount(item["cgst_rate"]) * 2
        else:
            gst_pct = 0.0

        line_items.append(InvoiceLineItem(
            description=(item["description"] or "").strip(),
            qty=_clean_amount(item["qty"]) or 1.0,
            rate=_clean_amount(item["rate"]),
            amount=_clean_amount(item["amount"]),
            gst_pct=gst_pct,
        ))

    result = InvoiceResult(
        tenant_id=tenant_id,
        source_file=file_path,
        extraction_method=extraction_method,
        extracted_at=datetime.now(),
        vendor_name=header.get("vendor_name"),
        invoice_number=header.get("invoice_number"),
        invoice_date=_parse_date(header.get("invoice_date")),
        gstin=header.get("gstin"),
        line_items=line_items,
        subtotal=totals.get("subtotal", 0.0),
        cgst_amount=totals.get("cgst_amount", 0.0),
        sgst_amount=totals.get("sgst_amount", 0.0),
        total=totals.get("total", 0.0),
    )

    return validate_all(result)
