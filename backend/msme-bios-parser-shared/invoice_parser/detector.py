"""
detector.py — Same detection principle as the bank parser: is there real,
extractable text on this PDF, or is it scanned? Real, working logic - no
AI needed here.
"""

import pdfplumber


def is_digital_pdf(file_path: str, min_chars: int = 50) -> bool:
    with pdfplumber.open(file_path) as pdf:
        if len(pdf.pages) == 0:
            return False
        text = pdf.pages[0].extract_text()
        return bool(text and len(text.strip()) >= min_chars)
