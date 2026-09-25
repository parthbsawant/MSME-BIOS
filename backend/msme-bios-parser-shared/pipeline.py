"""
pipeline.py — The single entry point for the whole MSME-BIOS parsing
system. One function to call, regardless of which of the three document
types you're handing it.

    from pipeline import process
    result = process("some_file.pdf", tenant_id="tenant_001", document_type="bank_statement")

This file never contains any parser's actual extraction logic - it only
detects (or is told) what kind of document it's looking at, then calls
that parser's own parse(file_path, tenant_id) function, exactly as it
already exists. This is deliberate: when any parser changes internally -
including when Claude vision gets enabled for one of them - nothing here
needs to change, because this file never looks inside a parser, only
calls its one public function.
"""

import os
from typing import Optional, Literal
import pdfplumber

from bank_parser.main import parse as parse_bank_statement
from invoice_parser.main import parse as parse_invoice
from handwritten_parser.main import parse as parse_handwritten_bill

DocumentType = Literal["bank_statement", "invoice_bill", "photo_bill"]

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif", ".webp"}

# Keywords that reliably appear on one document type and essentially
# never on the other - used only when document_type isn't given
# explicitly. This is a best-effort heuristic, not a guarantee; see
# detect_document_type()'s docstring.
BANK_KEYWORDS = [
    "statement of account", "account statement", "opening balance",
    "closing balance", "ifsc", "micr", "txn date", "value date",
    "withdrawal", "deposit",
]
INVOICE_KEYWORDS = [
    "tax invoice", "invoice no", "invoice number", "gstin",
    "hsn", "taxable value", "cgst", "sgst", "bill to",
]


def detect_document_type(file_path: str) -> DocumentType:
    """
    Best-effort detection of which parser should handle this file.

    RELIABLE: image files always go to the handwritten parser - it's the
    only one of the three that handles photos, so there's no ambiguity.

    NOT FULLY RELIABLE: PDFs. Bank statements and invoices are both PDFs,
    and telling them apart from content alone isn't guaranteed - this
    scans the first page's text for keywords strongly associated with
    each document type and picks whichever scores higher. When the
    document type is already known (e.g. a real UI where the person
    uploading has said what it is), pass document_type explicitly to
    process() instead of relying on this - it's the reliable path.
    """
    ext = os.path.splitext(file_path)[1].lower()
    if ext in IMAGE_EXTENSIONS:
        return "photo_bill"

    if ext == ".pdf":
        try:
            with pdfplumber.open(file_path) as pdf:
                first_page_text = (pdf.pages[0].extract_text() or "").lower()
        except Exception:
            first_page_text = ""

        bank_score = sum(1 for kw in BANK_KEYWORDS if kw in first_page_text)
        invoice_score = sum(1 for kw in INVOICE_KEYWORDS if kw in first_page_text)

        if bank_score > invoice_score:
            return "bank_statement"
        elif invoice_score > bank_score:
            return "invoice_bill"
        else:
            raise ValueError(
                f"Could not confidently detect document type for '{file_path}' "
                f"(bank keyword matches: {bank_score}, invoice keyword matches: {invoice_score}). "
                f"Pass document_type='bank_statement' or 'invoice_bill' explicitly instead."
            )

    raise ValueError(
        f"Unrecognized file type '{ext}' for '{file_path}'. "
        f"Expected a PDF (bank statement or invoice) or an image (handwritten bill)."
    )


PARSERS = {
    "bank_statement": parse_bank_statement,
    "invoice_bill": parse_invoice,
    "photo_bill": parse_handwritten_bill,
}


def process(file_path: str, tenant_id: str, document_type: Optional[DocumentType] = None):
    """
    The one function to call for any document, regardless of type.
    Returns whatever that document type's own parser returns - the same
    ParserResult-based shape in every case, from msme_bios_shared.

    document_type: pass this explicitly ('bank_statement', 'invoice_bill',
    or 'photo_bill') whenever it's known - this is the reliable path, and
    what a real UI should use once the person uploading has said what
    they're giving you. Leave it as None only when you genuinely need
    auto-detection - reliable for images, best-effort for PDFs.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"'{file_path}' does not exist")

    if document_type is None:
        document_type = detect_document_type(file_path)

    if document_type not in PARSERS:
        raise ValueError(
            f"Unknown document_type '{document_type}'. Expected one of: {list(PARSERS.keys())}"
        )

    parser_fn = PARSERS[document_type]
    return parser_fn(file_path, tenant_id)
