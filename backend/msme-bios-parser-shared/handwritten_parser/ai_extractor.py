"""
ai_extractor.py — PHASE B. Not started yet, by design.

Unlike the other two parsers, this file isn't a fallback for edge cases -
it's the ENTIRE extraction method for this parser, since there's no
structured-extraction path for handwriting (see docs/PARSER_GUIDE.md
Section 2). Nothing else in this parser needs Claude - preprocessing,
validation, and the database write are all already real, working, testable
code (Phase A).

This is the file we build together, once Phase A is proven out:
1. Call handwritten_parser.preprocessor.preprocess_to_bytes() to get a
   cleaned-up image
2. Call msme_bios_shared.extract_structured() with a schema_prompt that:
   - explicitly acknowledges the input may be handwritten and messy
   - asks for null on any genuinely illegible field, not a guess
   - requests the HandwrittenBillResult shape (vendor/customer name, date,
     line items with description/qty/rate/amount, total)
   - optionally asks for a per-field confidence indicator
3. Convert the returned dict into a HandwrittenBillResult
4. Run validator.validate_all() on the result - same as the other parsers
"""


def extract_from_photo(image_path: str) -> dict:
    raise NotImplementedError(
        "AI vision extraction is Phase B - build the in-house parts "
        "(preprocessor.py, validator.py) first and prove they work, "
        "per docs/MASTER_REFERENCE.md. This is the file we build together."
    )
