"""
main.py — The single entry point for this parser, matching the shared
contract from docs/MASTER_REFERENCE.md Section 4.1.

CURRENT STATE: local, on-system extraction (Tesseract via
structured_extractor.py) runs first, always. AI vision escalation exists
in the code but is OFF by default, controlled by
ENABLE_CLAUDE_VISION_HANDWRITTEN in .env - so right now, with that flag
unset, behavior is identical to fully-standalone: Tesseract only,
ai_extractor.py never called. When that flag is set true (once approved)
AND a result needs review, the AI path runs automatically - no other
code here needs to change for that switch to take effect.

THE TRUST DECISION: after the local extraction attempt, the SAME
validator.py used everywhere else in this parser decides whether the
result is trustworthy - not a separate, new check. If validation finds
no problems (line items sum to the total, nothing illegible), the result
comes back with needs_review=False and AI is never touched, regardless
of the flag. If validation flags anything, the AI path runs only if the
flag is on; otherwise the flagged result is returned as-is for a human
to look at.
"""

from datetime import datetime, date
from typing import Optional
from PIL import Image, UnidentifiedImageError

from handwritten_parser.preprocessor import preprocess
from handwritten_parser.structured_extractor import extract_from_bill_local
from handwritten_parser.ai_extractor import extract_from_photo
from handwritten_parser.validator import validate_all
from handwritten_parser.models import HandwrittenLineItem, HandwrittenBillResult
from msme_bios_shared import config


def validate_input_image(file_path: str) -> None:
    """
    Checks the uploaded file is actually a readable image before doing
    anything else with it. Rejects broken uploads early with a clear
    error, rather than passing a corrupt file all the way to extraction.
    """
    try:
        with Image.open(file_path) as img:
            img.verify()
    except (UnidentifiedImageError, OSError) as e:
        raise ValueError(f"'{file_path}' is not a readable image file: {e}") from e


def _parse_date(raw) -> Optional[date]:
    if raw is None:
        return None
    if isinstance(raw, date):
        return raw
    for fmt in ["%d-%b-%Y", "%d/%m/%Y", "%d-%m-%Y"]:
        try:
            return datetime.strptime(str(raw).strip(), fmt).date()
        except ValueError:
            continue
    return None  # unparseable - leave None rather than guess


def _build_result(raw: dict, tenant_id: str, file_path: str, extraction_method: str) -> HandwrittenBillResult:
    """Shared conversion from a raw extraction dict into the validated
    result shape. Only one path calls this right now (local/Tesseract),
    but keeping this as a separate function means adding the AI path
    later just means calling this same function again with its output -
    nothing here needs to change."""
    line_items = [
        HandwrittenLineItem(
            description=item.get("description"),
            qty=item.get("qty"),
            rate=item.get("rate"),
            amount=item.get("amount"),
            confidence=item.get("confidence"),
        )
        for item in raw.get("line_items", [])
    ]

    result = HandwrittenBillResult(
        tenant_id=tenant_id,
        source_file=file_path,
        extraction_method=extraction_method,
        extracted_at=datetime.now(),
        vendor_or_customer_name=raw.get("vendor_or_customer_name"),
        bill_date=_parse_date(raw.get("bill_date")),
        line_items=line_items,
        total=raw.get("total"),
    )
    return validate_all(result)


def parse(file_path: str, tenant_id: str) -> HandwrittenBillResult:
    """
    Parses a photographed handwritten bill into a structured, validated
    record, using ONLY local Tesseract-based extraction right now - no AI
    involved. Always returns a result; check result.needs_review to see
    whether it was trusted or needs a human look.
    """
    validate_input_image(file_path)

    preprocessed_image = preprocess(file_path)
    local_raw = extract_from_bill_local(preprocessed_image)
    result = _build_result(local_raw, tenant_id, file_path, extraction_method="structured")

    # AI vision escalation - OFF by default. Only runs if
    # ENABLE_CLAUDE_VISION_HANDWRITTEN=true in .env AND the local
    # extraction needed review. With the flag off (the current default),
    # behavior is identical to before this was added - Tesseract-only,
    # ai_extractor.py never touched. Once approved, flip the flag; no
    # other change needed here.
    if result.needs_review and config.ENABLE_CLAUDE_VISION_HANDWRITTEN:
        ai_raw = extract_from_photo(file_path)
        result = _build_result(ai_raw, tenant_id, file_path, extraction_method="ai_vision")

    return result

