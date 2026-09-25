"""
structured_extractor.py — Extracts transactions from a DIGITAL bank
statement PDF using pdfplumber. This is the "in-house, no AI needed" path.

The header-matching logic below is real and ready to use - it's general
enough to handle column-name differences across banks without hardcoding
a specific bank's layout. See docs/PARSER_GUIDE.md Section 3 for the full
reasoning.

WHAT'S LEFT TO DO: the row-extraction loop has a clear TODO marking where
you'll need real sample statements to test against and tune. Start here
once you've collected 2-3 sample PDFs (see docs/PARSER_GUIDE.md Section 6).
"""

import pdfplumber
from typing import Optional

DATE_HEADERS = {"date", "txn date","tran date","value date", "transaction date"}
DESC_HEADERS = {"narration", "description", "particulars", "transaction remarks"}
DEBIT_HEADERS = {
    "debit",
    "withdrawal",
    "withdrawal amt.",
    "withdrawal amt",
    "withdrawals",
    "dr",
}

CREDIT_HEADERS = {
    "credit",
    "deposit",
    "deposits",
    "deposit amt.",
    "deposit amt",
    "cr",
}

BALANCE_HEADERS = {
    "balance",
    "closing balance",
    "running balance",
}


def _normalize(header_cell: Optional[str]) -> str:
    """Lowercases and strips whitespace so header matching isn't broken by
    inconsistent capitalization or stray spaces across different banks."""
    return (header_cell or "").strip().lower()


def identify_columns(header_row: list[Optional[str]]) -> dict[str, int]:
    """
    Given one table's header row, returns a mapping like
    {'date': 0, 'description': 1, 'debit': 3, 'credit': 4, 'balance': 5}
    by matching each cell against the synonym sets above, rather than
    assuming a fixed column order - this is what lets the same code handle
    SBI, HDFC, ICICI, etc. without a separate template per bank.
    """
    columns: dict[str, int] = {}
    for idx, cell in enumerate(header_row):
        normalized = _normalize(cell)
        if normalized in DATE_HEADERS and "date" not in columns:
            columns["date"] = idx
        elif normalized in DESC_HEADERS and "description" not in columns:
            columns["description"] = idx
        elif normalized in DEBIT_HEADERS and "debit" not in columns:
            columns["debit"] = idx
        elif normalized in CREDIT_HEADERS and "credit" not in columns:
            columns["credit"] = idx
        elif normalized in BALANCE_HEADERS and "balance" not in columns:
            columns["balance"] = idx
    return columns


def extract_raw_rows(file_path: str) -> list[dict]:
    """
    Extracts raw transaction rows from a digital bank statement PDF.

    Returns a list of dicts with string values straight from the table -
    NOT yet converted to BankTransaction objects (that happens in main.py,
    after these raw rows pass through the type coercion Pydantic gives us
    for free).

    TODO (team): this currently finds the header row and maps columns
    correctly, but the row-extraction loop below is a starting skeleton -
    test it against your first real sample statement and adjust based on
    what pdfplumber actually returns for that bank's specific table layout.
    Multi-page statements, wrapped narrations (see PARSER_GUIDE.md Section 5
    edge cases) will need handling here too.
    """
    raw_rows = []

    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                if not table or len(table) < 2:
                    continue

                columns = identify_columns(table[0])
                if "date" not in columns or "balance" not in columns:
                    continue  # this table isn't the transaction table

                for row in table[1:]:
                    raw_rows.append({
                        "date": row[columns.get("date")] if "date" in columns else None,
                        "description": row[columns.get("description")] if "description" in columns else "",
                        "debit": row[columns.get("debit")] if "debit" in columns else None,
                        "credit": row[columns.get("credit")] if "credit" in columns else None,
                        "balance": row[columns.get("balance")] if "balance" in columns else None,
                    })

    return raw_rows
