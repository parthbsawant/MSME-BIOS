"""
ai_extractor.py — AI vision extraction for scanned bank statements.

Scanned PDFs are rendered page-by-page using PyMuPDF and sent to the
shared Claude structured-extraction helper.

The returned transactions are converted into dictionaries here.
Validation and BankTransaction creation are handled by main.py so that
both structured and AI extraction paths use the same validation flow.
"""

import pymupdf

from msme_bios_shared.claude_client import extract_structured


BANK_STATEMENT_SCHEMA_PROMPT = """
Extract all bank transactions visible in this bank statement page.

Return ONLY valid JSON in exactly this format:

{
  "transactions": [
    {
      "date": "DD-MM-YYYY",
      "description": "string",
      "debit": number or null,
      "credit": number or null,
      "balance": number or null
    }
  ]
}

Rules:

1. Extract only actual transactions.
2. Do NOT extract:
   - column headers
   - opening balance rows
   - closing balance rows
   - page numbers
   - account information
   - bank information
   - statement metadata
3. Preserve the transaction description as accurately as possible.
4. If a transaction has a debit amount, put it in "debit" and set
   "credit" to null.
5. If a transaction has a credit amount, put it in "credit" and set
   "debit" to null.
6. If an amount is not visible or cannot be determined, use null.
7. Never guess missing values.
8. The "balance" field should contain the balance shown for that
   transaction. If it is not visible, use null.
9. Keep transactions in the same order in which they appear on the page.
10. Return the date exactly as visible when possible, using a standard
    day-month-year representation.
11. Return ONLY the JSON object. Do not include markdown or explanations.
"""


def extract_from_scanned(file_path: str) -> list[dict]:
    """
    Extract transactions from a scanned bank statement PDF using Claude
    Vision.

    Each PDF page is rendered as a PNG image and processed separately.
    Transactions from all pages are combined into one list.
    """

    transactions: list[dict] = []

    with pymupdf.open(file_path) as pdf:
        for page_number, page in enumerate(pdf, start=1):

            # Render page at approximately 300 DPI.
            matrix = pymupdf.Matrix(300 / 72, 300 / 72)
            pixmap = page.get_pixmap(
                matrix=matrix,
                alpha=False,
            )

            image_bytes = pixmap.tobytes("png")

            result = extract_structured(
                schema_prompt=BANK_STATEMENT_SCHEMA_PROMPT,
                image_bytes=image_bytes,
                image_media_type="image/png",
            )

            page_transactions = result.get("transactions", [])

            if not isinstance(page_transactions, list):
                raise ValueError(
                    f"Claude returned an invalid transactions list "
                    f"for page {page_number}"
                )

            transactions.extend(page_transactions)

    return transactions