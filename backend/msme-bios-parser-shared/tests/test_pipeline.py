"""
Tests for pipeline.py - the single entry point routing to all three
parsers. Uses real sample files already in this repo (not mocks) to
prove the actual routing and detection work end to end.
"""

import pytest
from PIL import Image

from pipeline import process, detect_document_type


# ---- detect_document_type(): the reliable case (images) ----

def test_detect_image_always_goes_to_handwritten(tmp_path):
    img_path = tmp_path / "some_bill.jpg"
    Image.new("RGB", (100, 100), color="white").save(img_path)
    assert detect_document_type(str(img_path)) == "photo_bill"


def test_detect_various_image_extensions(tmp_path):
    for ext in [".png", ".jpeg", ".bmp"]:
        img_path = tmp_path / f"bill{ext}"
        Image.new("RGB", (50, 50), color="white").save(img_path)
        assert detect_document_type(str(img_path)) == "photo_bill"


# ---- detect_document_type(): the heuristic case (PDFs), using real sample files ----

def test_detect_real_bank_statement_pdf():
    result = detect_document_type("tests/sample_statements/test_statement.pdf")
    assert result == "bank_statement"


def test_detect_real_invoice_pdf():
    result = detect_document_type("tests/sample_invoices/test_invoice.pdf")
    assert result == "invoice_bill"


def test_detect_unrecognized_extension_raises(tmp_path):
    fake_path = tmp_path / "document.docx"
    fake_path.write_text("not a real docx")
    with pytest.raises(ValueError, match="Unrecognized file type"):
        detect_document_type(str(fake_path))


# ---- process(): explicit document_type is the reliable path ----

def test_process_with_explicit_bank_statement_type():
    result = process("tests/sample_statements/test_statement.pdf", tenant_id="t1",
                      document_type="bank_statement")
    assert result.source_type == "bank_statement"


def test_process_with_explicit_invoice_type():
    result = process("tests/sample_invoices/test_invoice.pdf", tenant_id="t1",
                      document_type="invoice_bill")
    assert result.source_type == "invoice_bill"


def test_process_invalid_document_type_raises():
    with pytest.raises(ValueError, match="Unknown document_type"):
        process("tests/sample_statements/test_statement.pdf", tenant_id="t1",
                document_type="not_a_real_type")


# ---- process(): auto-detection end to end, using real files ----

def test_process_auto_detects_bank_statement():
    result = process("tests/sample_statements/test_statement.pdf", tenant_id="t1")
    assert result.source_type == "bank_statement"
    assert result.extraction_method == "structured"


def test_process_auto_detects_invoice():
    result = process("tests/sample_invoices/test_invoice.pdf", tenant_id="t1")
    assert result.source_type == "invoice_bill"
    assert result.extraction_method == "structured"


def test_process_missing_file_raises_clear_error():
    with pytest.raises(FileNotFoundError):
        process("this/file/does/not/exist.pdf", tenant_id="t1")


# ---- process(): the handwritten path, confirming it correctly stays AI-free by default ----

def test_process_handwritten_bill_no_ai_by_default(tmp_path, monkeypatch):
    monkeypatch.delenv("ENABLE_CLAUDE_VISION_HANDWRITTEN", raising=False)
    img_path = tmp_path / "bill.png"
    img = Image.new("RGB", (300, 100), color="white")
    from PIL import ImageDraw
    d = ImageDraw.Draw(img)
    d.text((10, 10), "Rice   100", fill="black")
    d.text((10, 40), "Total   100", fill="black")
    img.save(img_path)

    result = process(str(img_path), tenant_id="t1")
    assert result.source_type == "photo_bill"
    assert result.extraction_method == "structured"  # never escalated to ai_vision
