# msme-bios-parser-shared

The single active repo for all MSME-BIOS document parsing. As of this consolidation, `msme-bios-bank-parser`, `msme-bios-invoice-parser`, and `msme-bios-handwritten-parser` are **frozen** - kept as the historical record of each teammate's individual work, but no longer actively developed. All ongoing parser work happens here.

## Why this changed

The three-repo split made sense when three different people were each building their own parser independently. That's no longer the case - one person is now maintaining all three parsers going forward, which made three separate repos pure overhead rather than a benefit. This repo folds them together while keeping each parser genuinely separated internally (its own folder, its own tests) - consolidating repos doesn't mean flattening the code into a mess.

## What's in here

```
msme-bios-parser-shared/
├── msme_bios_shared/          # Shared contract: ParserResult, Claude wrapper, config, db helpers
├── bank_parser/                 # Bank statement parser (own module, own tests)
├── invoice_parser/                # Invoice/bill parser (own module, own tests)
│   └── vendor/gst_utils.py          # Real GST math, reused from the invoice generation engine
├── handwritten_parser/              # Handwritten bill parser (own module, own tests)
├── pipeline.py                        # THE single entry point - one function, routes to any parser
├── tests/
│   ├── test_bank_parser.py
│   ├── test_invoice_parser.py
│   ├── test_handwritten_parser.py
│   ├── test_pipeline.py
│   └── sample_statements/, sample_invoices/    # Real sample files used by the tests
├── pyproject.toml
├── requirements.txt
└── .env.example
```

## Using the pipeline - the one thing you actually call

```python
from pipeline import process

# When you know the document type (the reliable path - use this whenever possible)
result = process("statement.pdf", tenant_id="tenant_001", document_type="bank_statement")

# When you don't - auto-detection (reliable for images, best-effort for PDFs)
result = process("some_file.pdf", tenant_id="tenant_001")
```

`process()` never contains any parser's actual extraction logic - it only figures out (or is told) what kind of document it's looking at, then calls that parser's own `parse(file_path, tenant_id)` function exactly as it already exists. This means when any parser changes internally - including when Claude vision gets switched on for one of them - **nothing in `pipeline.py` needs to change**, because it never looks inside a parser, only calls its one public function.

**Document type detection:**
- Image files (`.jpg`, `.png`, etc.) → always routed to the handwritten parser. Fully reliable - it's the only one of the three that handles photos.
- PDFs → a best-effort keyword scan of the first page decides bank statement vs. invoice. Not guaranteed - when you already know the type (e.g. a real UI where the uploader said what they're giving you), pass `document_type` explicitly instead of relying on detection.

## The AI vision toggle - per parser, independent, off by default

Three flags in `.env`, each controlling one parser's AI escalation path:

```
ENABLE_CLAUDE_VISION_BANK=false
ENABLE_CLAUDE_VISION_INVOICE=false
ENABLE_CLAUDE_VISION_HANDWRITTEN=false
```

All default to `false`. Having a parser's AI code built (bank's `ai_extractor.py` is genuinely complete, for instance) does **not** mean it's safe to run - each flag needs to be explicitly and individually turned on once that parser's AI path is actually approved and ready. Turning one on doesn't affect the others.

For the handwritten parser specifically: with its flag off (the current state), behavior is identical to fully local Tesseract-only extraction - `ai_extractor.py` is never called. Once approved, setting `ENABLE_CLAUDE_VISION_HANDWRITTEN=true` and building out the real Claude call in that file is the only change needed - `pipeline.py` and the other two parsers stay untouched.

## Setup

```bash
git clone https://github.com/YOUR_USERNAME/msme-bios-parser-shared.git
cd msme-bios-parser-shared
python3 -m venv venv
source venv/bin/activate
pip install -e .
cp .env.example .env   # fill in ANTHROPIC_API_KEY if/when needed; AI flags stay false for now
```

**Also needed:** Tesseract itself (not a Python package) for the handwritten parser:
```bash
brew install tesseract   # macOS
```

## Running the tests

```bash
python3 -m pytest tests/ -v
```

Currently **59 tests, all passing** - 13 bank, 10 invoice, 17 handwritten, 7 shared, 12 pipeline.

## A real fix worth knowing about, if you're used to the old repos

The old `msme-bios-invoice-parser` repo reached `gst_utils.py` through a `sys.path` trick that only worked when running directly from that repo's checkout. That would have broken silently once this became a properly installable package - fixed here by moving it to `invoice_parser/vendor/gst_utils.py` as a real submodule, imported normally (`from invoice_parser.vendor.gst_utils import split_cgst_sgst`). Verified against a genuinely fresh `pip install` in an empty environment, not just assumed.

## Status

- [x] All three parsers' code consolidated, with their own tests intact
- [x] Python 3.9 compatibility bug (found and fixed once in the handwritten parser) found and fixed across bank and invoice too
- [x] Per-parser AI toggle mechanism, tested end-to-end
- [x] `pipeline.py` built and tested against real sample files
- [ ] Frontend (planned next, once this is confirmed working via terminal testing)
- [ ] Claude vision approved and enabled for the handwritten parser specifically
