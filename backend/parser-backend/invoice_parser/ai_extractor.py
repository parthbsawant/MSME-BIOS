"""
ai_extractor.py — PHASE B. Do not start on this yet.

Per the team's build plan, build and prove the in-house structured path
first - it should handle most of your 112 real generated invoices without
any AI at all, since they're clean digital PDFs. Only once that's tested
and measured should this file be implemented.

When it's time (Phase B), it should:
1. Render the invoice PDF's page(s) to images using PyMuPDF
2. Call msme_bios_shared.extract_structured() with a schema_prompt describing
   the InvoiceResult shape (vendor, invoice number, date, line items, totals)
3. Convert the returned dict into an InvoiceResult
4. Run the SAME validate_all() from validator.py on the result
"""


def extract_from_scanned(file_path: str) -> dict:
    raise NotImplementedError(
        "AI vision extraction is Phase B - not started yet. "
        "See docs/MASTER_REFERENCE.md for the team's build order."
    )
