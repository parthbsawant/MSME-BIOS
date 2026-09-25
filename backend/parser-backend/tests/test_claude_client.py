"""
Tests for msme_bios_shared. Run with: pytest tests/ -v

These tests don't call the real Claude API or a real database - they test
the logic that doesn't need either (JSON parsing, model validation, error
handling), so they run fast and don't need any credentials configured.
"""

import pytest
from datetime import datetime
from msme_bios_shared import ParserResult, write_to_staging
from msme_bios_shared.claude_client import _parse_json_response


def test_parser_result_valid():
    r = ParserResult(
        tenant_id="tenant_001",
        source_file="test.pdf",
        source_type="bank_statement",
        extraction_method="structured",
        extracted_at=datetime.now(),
    )
    assert r.needs_review is False
    assert r.review_reason is None


def test_parser_result_rejects_invalid_source_type():
    with pytest.raises(Exception):
        ParserResult(
            tenant_id="t1",
            source_file="x.pdf",
            source_type="not_a_real_type",
            extraction_method="structured",
            extracted_at=datetime.now(),
        )


def test_parser_result_rejects_invalid_extraction_method():
    with pytest.raises(Exception):
        ParserResult(
            tenant_id="t1",
            source_file="x.pdf",
            source_type="bank_statement",
            extraction_method="magic",
            extracted_at=datetime.now(),
        )


def test_json_parsing_clean_json():
    result = _parse_json_response('{"vendor": "Test Co", "total": 500}')
    assert result == {"vendor": "Test Co", "total": 500}


def test_json_parsing_markdown_fenced():
    result = _parse_json_response('```json\n{"vendor": "Test Co", "total": 500}\n```')
    assert result == {"vendor": "Test Co", "total": 500}


def test_json_parsing_raises_clear_error_on_garbage():
    with pytest.raises(ValueError, match="not valid JSON"):
        _parse_json_response("this is not json at all")


def test_write_to_staging_empty_rows_no_db_needed():
    # Should return 0 immediately without attempting a database connection,
    # so this test passes even with no DATABASE_URL configured.
    assert write_to_staging("any_table", []) == 0
