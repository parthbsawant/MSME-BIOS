"""
Tests for bank_parser. Run with: pytest tests/ -v

These test the logic that's already built (Phase A) using synthetic data,
so they run without needing real sample statements yet. As you add sample
PDFs to tests/sample_statements/, add corresponding tests that exercise
the full extract_raw_rows() -> parse() pipeline against them.
"""

import pytest
from datetime import date
from bank_parser.models import BankTransaction
from bank_parser.structured_extractor import identify_columns
from bank_parser.validator import (
    validate_running_balance,
    validate_debit_credit_exclusivity,
    validate_chronological_order,
)
from bank_parser.main import _clean_amount, _parse_date


# ---- models.py ----

def test_bank_transaction_valid():
    txn = BankTransaction(txn_date=date(2025, 4, 25), description="Test", debit=100.0, balance=500.0)
    assert txn.needs_review is False


def test_bank_transaction_rejects_negative_amounts():
    with pytest.raises(Exception):
        BankTransaction(txn_date=date(2025, 4, 25), description="Test", debit=-50.0, balance=500.0)


# ---- structured_extractor.py: header matching ----

def test_identify_columns_sbi_style():
    header = ["Date", "Narration", "Chq/Ref No", "Debit", "Credit", "Balance"]
    cols = identify_columns(header)
    assert cols == {"date": 0, "description": 1, "debit": 3, "credit": 4, "balance": 5}


def test_identify_columns_icici_style():
    header = ["Date", "Transaction Remarks", "Withdrawal", "Deposit", "Balance"]
    cols = identify_columns(header)
    assert cols == {"date": 0, "description": 1, "debit": 2, "credit": 3, "balance": 4}


def test_identify_columns_case_insensitive():
    header = ["  DATE  ", "narration", "DEBIT", "credit", "Balance"]
    cols = identify_columns(header)
    assert cols["date"] == 0 and cols["balance"] == 4


# ---- validator.py ----

def test_validate_running_balance_catches_mismatch():
    txns = [
        BankTransaction(txn_date=date(2025, 4, 1), description="Opening", balance=1000.0),
        BankTransaction(txn_date=date(2025, 4, 2), description="Payment", debit=200.0, balance=750.0),  # wrong: should be 800
    ]
    result = validate_running_balance(txns)
    assert result[1].needs_review is True
    assert "mismatch" in result[1].review_reason.lower()


def test_validate_running_balance_passes_correct_math():
    txns = [
        BankTransaction(txn_date=date(2025, 4, 1), description="Opening", balance=1000.0),
        BankTransaction(txn_date=date(2025, 4, 2), description="Payment", debit=200.0, balance=800.0),
    ]
    result = validate_running_balance(txns)
    assert result[1].needs_review is False


def test_validate_debit_credit_exclusivity():
    txns = [BankTransaction(txn_date=date(2025, 4, 1), description="Odd", debit=100.0, credit=50.0, balance=1000.0)]
    result = validate_debit_credit_exclusivity(txns)
    assert result[0].needs_review is True


def test_validate_chronological_order():
    txns = [
        BankTransaction(txn_date=date(2025, 4, 5), description="Later", balance=1000.0),
        BankTransaction(txn_date=date(2025, 4, 1), description="Earlier - out of order", balance=900.0),
    ]
    result = validate_chronological_order(txns)
    assert result[1].needs_review is True


# ---- main.py helpers ----

def test_clean_amount_handles_commas():
    assert _clean_amount("1,200.50") == 1200.50


def test_clean_amount_handles_empty():
    assert _clean_amount("") == 0.0
    assert _clean_amount(None) == 0.0


def test_parse_date_multiple_formats():
    assert _parse_date("25-Apr-2025") == date(2025, 4, 25)
    assert _parse_date("25/04/2025") == date(2025, 4, 25)


def test_parse_date_raises_on_unrecognized_format():
    with pytest.raises(ValueError):
        _parse_date("not a date at all")
