"""
validator.py — Validates extracted bank transactions.

The validation checks are bank-independent and can be applied to
transactions extracted from any supported bank statement format.
"""

from bank_parser.models import BankTransaction
from typing import Optional


def validate_running_balance(
    transactions: list[BankTransaction],
    opening_balance: Optional[float] = None,
) -> list[BankTransaction]:
    """
    Checks that each transaction's balance correctly follows from the
    previous balance:

        previous_balance + credit - debit == current balance

    If an opening balance is provided, the first transaction is checked
    against that opening balance.
    """

    if not transactions:
        return transactions

    # Check the first transaction against the opening balance
    if opening_balance is not None:
        first = transactions[0]

        expected = round(
            opening_balance + first.credit - first.debit,
            2
        )

        if abs(expected - first.balance) > 0.01:
            first.needs_review = True
            first.review_reason = (
                f"Balance mismatch: expected {expected}, "
                f"statement shows {first.balance}"
            )

    # Check every transaction after the first one
    for i in range(1, len(transactions)):
        prev = transactions[i - 1]
        curr = transactions[i]

        expected = round(
            prev.balance + curr.credit - curr.debit,
            2
        )

        if abs(expected - curr.balance) > 0.01:
            curr.needs_review = True
            curr.review_reason = (
                f"Balance mismatch: expected {expected}, "
                f"statement shows {curr.balance}"
            )

    return transactions


def validate_debit_credit_exclusivity(
    transactions: list[BankTransaction],
) -> list[BankTransaction]:
    """
    A transaction should be either money out or money in, never both.

    If both debit and credit are non-zero, flag the transaction for review.
    """

    for txn in transactions:
        if txn.debit > 0 and txn.credit > 0:
            txn.needs_review = True
            txn.review_reason = (
                (txn.review_reason + " | " if txn.review_reason else "")
                + f"Both debit ({txn.debit}) and credit ({txn.credit}) "
                  f"are non-zero"
            )

    return transactions


def validate_chronological_order(
    transactions: list[BankTransaction],
) -> list[BankTransaction]:
    """
    Dates within a statement should never go backwards.

    If a transaction date is earlier than the previous transaction's date,
    flag it for review.
    """

    for i in range(1, len(transactions)):
        if transactions[i].txn_date < transactions[i - 1].txn_date:
            transactions[i].needs_review = True

            reason = (
                f"Date {transactions[i].txn_date} is before "
                f"previous row's {transactions[i - 1].txn_date}"
            )

            transactions[i].review_reason = (
                (transactions[i].review_reason + " | "
                 if transactions[i].review_reason else "")
                + reason
            )

    return transactions


def validate_all(
    transactions: list[BankTransaction],
    opening_balance: Optional[float] = None,
) -> list[BankTransaction]:
    """
    Runs all validation checks in sequence.

    This is the main validation entry point used by main.py.
    """

    transactions = validate_debit_credit_exclusivity(transactions)

    transactions = validate_chronological_order(transactions)

    transactions = validate_running_balance(
        transactions,
        opening_balance,
    )

    return transactions