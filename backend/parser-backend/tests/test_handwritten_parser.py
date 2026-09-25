"""
Tests for handwritten_parser. Run with:
    /Library/Developer/CommandLineTools/usr/bin/python3 -m pytest tests/ -v

Covers the parser as it currently works: fully standalone, Tesseract-only,
no AI involved. parse() always returns a HandwrittenBillResult - check
result.needs_review to see whether it was trusted or needs a human look.
"""

import pytest
from datetime import date
from PIL import Image, ImageDraw

from handwritten_parser.models import HandwrittenLineItem, HandwrittenBillResult
from handwritten_parser.preprocessor import preprocess, preprocess_to_bytes
from handwritten_parser.structured_extractor import (
    parse_line_items, extract_from_bill_local, group_into_lines, extract_word_data,
)
from handwritten_parser.validator import validate_line_items_sum_to_total, flag_illegible_fields
from handwritten_parser.main import validate_input_image, parse


# ---- models.py ----

def test_line_item_allows_all_nulls():
    item = HandwrittenLineItem()
    assert item.description is None
    assert item.amount is None


def test_bill_result_defaults():
    r = HandwrittenBillResult(tenant_id="t1", source_file="x.jpg", extraction_method="structured",
                               extracted_at="2025-04-25T00:00:00")
    assert r.source_type == "photo_bill"


# ---- preprocessor.py: real image processing, testable now ----

@pytest.fixture
def sample_image_path(tmp_path):
    """Creates a tiny real test image so preprocessing can run against it."""
    path = tmp_path / "test_bill.jpg"
    img = Image.new("RGB", (200, 300), color=(180, 180, 170))
    img.save(path)
    return str(path)


def test_preprocess_returns_valid_image(sample_image_path):
    result = preprocess(sample_image_path)
    assert isinstance(result, Image.Image)
    assert result.mode == "RGB"


def test_preprocess_to_bytes_produces_valid_jpeg(sample_image_path):
    result_bytes = preprocess_to_bytes(sample_image_path)
    assert isinstance(result_bytes, bytes)
    assert len(result_bytes) > 0
    assert result_bytes[:2] == b'\xff\xd8'  # JPEG magic bytes


# ---- main.py: input validation, real and working ----

def test_validate_input_image_accepts_real_image(sample_image_path):
    validate_input_image(sample_image_path)  # should not raise


def test_validate_input_image_rejects_non_image(tmp_path):
    fake_path = tmp_path / "not_an_image.txt"
    fake_path.write_text("this is just text, not an image")
    with pytest.raises(ValueError, match="not a readable image"):
        validate_input_image(str(fake_path))


# ---- validator.py: real logic, no AI needed to test ----

def test_validate_sum_computes_total_when_none_stated():
    bill = HandwrittenBillResult(
        tenant_id="t1", source_file="x.jpg", extraction_method="structured",
        extracted_at="2025-04-25T00:00:00",
        line_items=[
            HandwrittenLineItem(description="Rice", amount=100.0),
            HandwrittenLineItem(description="Dal", amount=50.0),
        ],
        total=None,
    )
    result = validate_line_items_sum_to_total(bill)
    assert result.total == 150.0
    assert result.needs_review is False


def test_validate_sum_flags_mismatch():
    bill = HandwrittenBillResult(
        tenant_id="t1", source_file="x.jpg", extraction_method="structured",
        extracted_at="2025-04-25T00:00:00",
        line_items=[HandwrittenLineItem(description="Rice", amount=100.0)],
        total=999.0,
    )
    result = validate_line_items_sum_to_total(bill)
    assert result.needs_review is True


def test_flag_illegible_fields():
    bill = HandwrittenBillResult(
        tenant_id="t1", source_file="x.jpg", extraction_method="structured",
        extracted_at="2025-04-25T00:00:00",
        line_items=[HandwrittenLineItem(description=None, amount=100.0)],
    )
    result = flag_illegible_fields(bill)
    assert result.needs_review is True
    assert "illegible" in result.review_reason.lower()


def test_flag_illegible_fields_passes_clean_data():
    bill = HandwrittenBillResult(
        tenant_id="t1", source_file="x.jpg", extraction_method="structured",
        extracted_at="2025-04-25T00:00:00",
        line_items=[HandwrittenLineItem(description="Rice", amount=100.0)],
    )
    result = flag_illegible_fields(bill)
    assert result.needs_review is False


# ---- structured_extractor.py: real, working Tesseract-based extraction ----

def _make_bill_image(path, lines):
    img = Image.new('RGB', (400, 40 * len(lines) + 20), color='white')
    d = ImageDraw.Draw(img)
    y = 10
    for line in lines:
        d.text((10, y), line, fill='black')
        y += 40
    img.save(path)
    return img


def test_group_into_lines_keeps_separate_lines_separate(tmp_path):
    """Regression test for a real bug found during development: grouping
    by Tesseract's line_num ALONE silently merged unrelated lines from
    different blocks into one garbled line, since line_num resets to 1
    at the start of every new block. Must group by the full
    (block_num, par_num, line_num) tuple instead."""
    path = tmp_path / "three_lines.png"
    _make_bill_image(path, ["Dahi Masala   380", "Chilli Flakes   238", "Total   618"])
    img = preprocess(str(path))
    word_data = extract_word_data(img)
    lines = group_into_lines(word_data)
    assert len(lines) == 3  # NOT 1 - this is exactly what broke before the fix


def test_parse_line_items_extracts_description_and_amount():
    lines = [{'text': 'Rice Bag 500', 'avg_confidence': 90}, {'text': 'Sugar 120', 'avg_confidence': 90}]
    items = parse_line_items(lines)
    assert len(items) == 2
    assert items[0]['amount'] == 500.0
    assert items[1]['amount'] == 120.0


def test_parse_line_items_uses_real_tesseract_confidence():
    """Confidence should reflect Tesseract's OWN reported score, not a
    fixed placeholder - confirmed during development that a genuinely
    misread word ('Dahi' -> 'ahi') got a genuinely lower confidence score
    (59) than correctly-read words (90) in the same test."""
    high_conf_line = [{'text': 'Rice Bag 500', 'avg_confidence': 90}]
    low_conf_line = [{'text': 'Rice Bag 500', 'avg_confidence': 40}]
    assert parse_line_items(high_conf_line)[0]['confidence'] == 'high'
    assert parse_line_items(low_conf_line)[0]['confidence'] == 'low'


def test_extract_from_bill_local_separates_total_from_line_items(tmp_path):
    path = tmp_path / "clean_bill.png"
    _make_bill_image(path, ["Dahi Masala   380", "Chilli Flakes   238", "Total   618"])
    img = preprocess(str(path))
    result = extract_from_bill_local(img)
    assert len(result['line_items']) == 2  # "Total" line correctly pulled out separately
    assert result['total'] == 618.0


# ---- main.py: parse() always returns a result, no AI involved ----

def test_parse_returns_result_never_raises_on_valid_image(tmp_path):
    """The parser works fully standalone right now - parse() should
    always return a HandwrittenBillResult for a valid image, never raise
    (there's no AI escalation to fail into)."""
    path = tmp_path / "any_bill.png"
    _make_bill_image(path, ["Item One   100", "Total   100"])
    result = parse(str(path), tenant_id="test_tenant")
    assert isinstance(result, HandwrittenBillResult)
    assert result.extraction_method == "structured"


def test_parse_trusts_clean_extraction_when_math_reconciles(tmp_path):
    path = tmp_path / "clean_bill.png"
    _make_bill_image(path, ["Dahi Masala   380", "Chilli Flakes   238", "Total   618"])
    result = parse(str(path), tenant_id="test_tenant")
    assert result.needs_review is False


def test_parse_flags_for_review_when_math_does_not_reconcile(tmp_path):
    """When the stated total doesn't match the line items (e.g. from a
    misread digit), the result should come back flagged - not silently
    trusted, and not crashing - since there's no AI to escalate to yet."""
    path = tmp_path / "bad_bill.png"
    _make_bill_image(path, ["Dahi Masala   380", "Chilli Flakes   238", "Total   999"])
    result = parse(str(path), tenant_id="test_tenant")
    assert result.needs_review is True
    assert result.review_reason is not None
