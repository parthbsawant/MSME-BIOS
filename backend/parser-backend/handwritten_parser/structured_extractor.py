"""
structured_extractor.py — Attempts LOCAL, on-system extraction using
Tesseract OCR, before falling back to AI vision. This mirrors the exact
same dual-path pattern as the Bank Statement and Invoice/Bill parsers:
try the free, deterministic path first; only escalate when it's not
good enough.

WHY THIS IS BUILT AND WIRED IN FIRST, NOT SKIPPED - for the record:
Tesseract is trained primarily on printed text. Real handwriting - with
inconsistent letter formation, plus photograph noise (blur, shadows,
camera angle) - defeats its character-segmentation approach far more
often than clean printed text does. A concrete test against a
realistically photo-degraded sample showed Tesseract silently misreading
"380" as "330" - a financially significant, completely undetected error.

This module still gets a genuine attempt, first, for three reasons:
  1. Architectural consistency with the other two parsers' dual-path design
  2. It produces real evidence on exactly how often/how badly this fails
     on genuine handwritten bills, not just one synthetic test
  3. On the occasional unusually neat handwritten bill, it may actually
     work - a real win at zero AI cost when it does

The validator.py math check (line items should sum to the stated total)
is what actually decides whether to TRUST a local result or escalate -
not just whether Tesseract produced *something*. See main.py for how
this decision gets made.

USES image_to_data(), NOT image_to_string() - the difference matters:
image_to_string() only returns plain text, with no signal about which
words Tesseract itself was unsure of. image_to_data() returns Tesseract's
own per-word confidence score (0-100), which this module uses to set a
REAL confidence per line item, rather than a blanket guess. Confirmed
concretely during development: on a test image, Tesseract read "Dahi" as
"ahi" (dropped a letter) - and its own reported confidence for that word
(59) was genuinely lower than for the words it read correctly (90) -
proving this signal carries real information, not just noise.
"""

import re
import pytesseract
from pytesseract import Output
from PIL import Image

# A line is marked "high" confidence only if Tesseract's own average
# word-confidence for that line clears this bar. Chosen conservatively -
# see docs/PARSER_GUIDE.md for why silent wrong digits are the failure
# mode that matters most here, so this threshold errs toward flagging
# more lines as "low" rather than fewer.
CONFIDENCE_THRESHOLD = 70


def extract_word_data(preprocessed_image: Image.Image) -> dict:
    """Runs Tesseract OCR on an already-preprocessed image (see
    preprocessor.py) and returns its full per-word data - text, position,
    and Tesseract's own confidence score for each word - not just a flat
    text blob."""
    return pytesseract.image_to_data(preprocessed_image, output_type=Output.DICT)


def group_into_lines(word_data: dict) -> list[dict]:
    """Groups Tesseract's flat per-word output back into lines, reconstructing
    each line's text in word order and computing that line's average
    word-confidence.

    IMPORTANT: groups by the full (block_num, par_num, line_num) tuple, not
    line_num alone - Tesseract resets line_num back to 1 at the start of
    every new block, so grouping by line_num alone silently merges
    unrelated lines from different blocks into one garbled line. Caught
    by testing against a real 3-line sample, not assumed to be safe."""
    lines: dict[tuple, dict] = {}
    for i in range(len(word_data['text'])):
        text = word_data['text'][i].strip()
        if not text:
            continue
        key = (word_data['block_num'][i], word_data['par_num'][i], word_data['line_num'][i])
        conf = word_data['conf'][i]
        if key not in lines:
            lines[key] = {'words': [], 'confidences': [], 'top': word_data['top'][i]}
        lines[key]['words'].append(text)
        if conf >= 0:  # Tesseract uses -1 for non-text detections
            lines[key]['confidences'].append(conf)

    # Sort by vertical position (top), not insertion order, so lines come
    # out in the same order they appear on the actual bill.
    ordered = sorted(lines.values(), key=lambda entry: entry['top'])

    result = []
    for entry in ordered:
        full_text = ' '.join(entry['words'])
        avg_conf = sum(entry['confidences']) / len(entry['confidences']) if entry['confidences'] else 0
        result.append({'text': full_text, 'avg_confidence': avg_conf})
    return result


# Matches a line like "Dahi Masala   1   380" or "Chilli Flakes  238" -
# a description followed by a trailing number. This is a rough heuristic,
# not a real parser: handwritten bills don't follow a fixed column format
# the way a printed table does, so this will miss or misparse many real
# layouts. That's expected and part of what main.py's validation step
# is there to catch.
LINE_ITEM_PATTERN = re.compile(r'^(.+?)\s+([\d,]+\.?\d*)\s*$')


def parse_line_items(lines: list[dict]) -> list[dict]:
    """Best-effort parse of reconstructed OCR lines into line-item
    guesses. qty and rate are left as None - a single flat text line
    rarely separates these reliably, only the final amount is usually
    extractable this way. Confidence is now REAL - Tesseract's own
    per-line average, not a placeholder."""
    line_items = []
    for line in lines:
        match = LINE_ITEM_PATTERN.match(line['text'])
        if not match:
            continue
        description = match.group(1).strip()
        amount_str = match.group(2).replace(',', '')
        try:
            amount = float(amount_str)
        except ValueError:
            continue
        line_items.append({
            'description': description,
            'qty': None,
            'rate': None,
            'amount': amount,
            'confidence': 'high' if line['avg_confidence'] >= CONFIDENCE_THRESHOLD else 'low',
        })
    return line_items


def extract_from_bill_local(preprocessed_image: Image.Image) -> dict:
    """
    The main entry point for this module. Attempts a full local
    extraction and returns a dict in the SAME shape ai_extractor.py's
    eventual output will use - so main.py can treat both paths
    identically once either one returns (or, right now, so this can run
    as a complete standalone system with no AI path at all).
    """
    word_data = extract_word_data(preprocessed_image)
    lines = group_into_lines(word_data)
    line_items = parse_line_items(lines)

    # Real handwritten bills often write "Total" as the last line - a
    # rough heuristic, not a guarantee, so this only fires if the last
    # detected line item's description contains that word.
    total = None
    if line_items and 'total' in line_items[-1]['description'].lower():
        total = line_items.pop()['amount']

    return {
        'vendor_or_customer_name': None,  # Tesseract has no concept of "which line is the name"
        'bill_date': None,
        'line_items': line_items,
        'total': total,
        '_raw_lines': lines,  # kept only for debugging/manual review, not part of the shared schema
    }

