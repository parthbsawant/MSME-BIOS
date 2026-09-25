"""
detector.py — Decides whether a bank statement PDF is digital (has real,
extractable text) or scanned (needs the AI vision path). This is real,
working logic - no AI needed here.
"""

import pdfplumber


def is_digital_pdf(file_path: str, min_chars: int = 50) -> bool:
    """
    Returns True if the PDF's first page has meaningful extractable text,
    meaning the structured (pdfplumber) extraction path should work.
    Returns False if the page is essentially empty of text - a strong
    signal it's a scanned image, which needs the AI vision path instead.
    """
    with pdfplumber.open(file_path) as pdf:
        if len(pdf.pages) == 0:
            return False
        text = pdf.pages[0].extract_text()
        return bool(text and len(text.strip()) >= min_chars)
