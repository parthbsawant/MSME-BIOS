import re
from datetime import datetime, date
from typing import Optional, Union

from bank_parser.detector import is_digital_pdf
from bank_parser.structured_extractor import extract_raw_rows
from bank_parser.ai_extractor import extract_from_scanned
from bank_parser.validator import validate_all
from bank_parser.models import BankTransaction, BankStatementResult
from msme_bios_shared import config


def _clean_amount(raw: Union[str, float, None]) -> float:
    """Convert an extracted amount into a float."""

    if raw is None:
        return 0.0

    if isinstance(raw, (int, float)):
        return float(raw)

    cleaned = re.sub(r"[^\d.]", "", str(raw))

    return float(cleaned) if cleaned else 0.0


def _parse_date(raw: Union[str, date]) -> date:
    """Parse common Indian bank statement date formats."""

    if isinstance(raw, date):
        return raw

    formats = [
        "%d-%b-%Y",
        "%d %b %Y",
        "%d/%m/%Y",
        "%d-%m-%Y",
        "%d/%m/%y",
        "%d-%b-%y",
    ]

    for fmt in formats:
        try:
            return datetime.strptime(str(raw).strip(), fmt).date()
        except ValueError:
            continue

    raise ValueError(f"Could not parse date: '{raw}'")


def parse(file_path: str, tenant_id: str) -> BankStatementResult:
    """
    Parse a bank statement PDF.

    Digital PDFs use structured extraction.
    Scanned PDFs use the AI vision extraction path.
    """

    # ---------------------------------------------------------
    # STEP 1: Extract raw rows
    # ---------------------------------------------------------

    if is_digital_pdf(file_path):
        raw_rows = extract_raw_rows(file_path)
        extraction_method = "structured"
    else:
        if not config.ENABLE_CLAUDE_VISION_BANK:
            raise NotImplementedError(
                "This looks like a scanned statement, which needs AI vision - "
                "not yet enabled for the bank parser. Set ENABLE_CLAUDE_VISION_BANK=true "
                "in .env once this parser's AI path is approved and ready to use."
            )
        raw_rows = extract_from_scanned(file_path)
        extraction_method = "ai_vision"

    # ---------------------------------------------------------
    # STEP 2: Find opening balance and remove summary rows
    # ---------------------------------------------------------

    opening_balance = None
    transaction_rows = []

    for row in raw_rows:
        description = (row.get("description") or "").strip().upper()
        date_value = (row.get("date") or "").strip()

        # Detect OPENING BALANCE row
        if "OPENING BALANCE" in description:
            opening_balance = _clean_amount(row.get("balance"))
            continue

        # Detect CLOSING BALANCE row
        if "CLOSING BALANCE" in description:
            continue

    # Detect brought-forward balance row
        if description in {"B/F", "B/F BALANCE", "BROUGHT FORWARD"}:
            continue

    # Detect SBI statement metadata row
        if "BALANCE AS ON" in description:
            continue

        # Ignore completely empty rows
        if not date_value and not description:
            continue

        transaction_rows.append(row)

    # ---------------------------------------------------------
    # STEP 3: Convert raw rows into BankTransaction objects
    # ---------------------------------------------------------

    transactions = []

    for row in transaction_rows:
        try:
            transactions.append(
                BankTransaction(
                    txn_date=_parse_date(row["date"]),
                    description=" ".join((row["description"] or "").split()),
                    debit=_clean_amount(row["debit"]),
                    credit=_clean_amount(row["credit"]),
                    balance=_clean_amount(row["balance"]),
                )
            )

        except (ValueError, TypeError) as e:
            transactions.append(
                BankTransaction(
                    txn_date=date.today(),
                    description=str(row.get("description", "")),
                    balance=0.0,
                    needs_review=True,
                    review_reason=f"Row failed to parse cleanly: {e}",
                )
            )

    # ---------------------------------------------------------
    # STEP 4: Validate transactions
    # ---------------------------------------------------------

    transactions = validate_all(
        transactions,
        opening_balance=opening_balance,
    )

    # ---------------------------------------------------------
    # STEP 5: Build final parser result
    # ---------------------------------------------------------

    return BankStatementResult(
        tenant_id=tenant_id,
        source_file=file_path,
        extraction_method=extraction_method,
        extracted_at=datetime.now(),
        transactions=transactions,
        needs_review=any(
            transaction.needs_review
            for transaction in transactions
        ),
    )