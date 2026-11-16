# Categorizer and reconciliation - build plan

Save this file as `docs/CATEGORIZER_PLAN.md` in the MSME-BIOS repo. Each Claude Code session does ONE step.

## Goal

Turn parsed rows into business meaning, with no Claude API and no handwritten bills:

    upload -> parser (existing) -> validate -> categorize / enrich -> reconcile -> normalized tables -> features

Features (P&L, cash dashboard, receivables and payables, aging, concentration, anomalies) read only the normalized columns and tables, never raw parser output.

## Rules for every step (read these first, they save credits)

1. Do only the step you were asked for. Stop at its "Done when" and report.
2. Read only the files the step names, plus what you must open to wire them in. Do not read the whole repo.
3. No Claude API, Anthropic SDK or `claude_client` anywhere in new code. No new network calls. No new heavy dependencies (no scikit-learn, pandas or rapidfuzz in the server path). Standard library only unless the step says otherwise.
4. Never run the full test suite (about 16 minutes). Run only the new test file, plus `pytest tests/test_tenant_isolation.py -q` when a step touches tenant data.
5. Use the dev database only. Schema changes: `python scripts/apply_schema.py --env DATABASE_URL --expect-db msme_bios_dev schema/<file>.sql`, then the same with `--env TEST_DATABASE_URL --expect-db msme_bios_test`. Never touch production.
6. Never print, commit or ask for `.env` values or the Firebase JSON.
7. Every query on tenant data filters on `tenant_id`. Money stays NUMERIC.
8. `ENABLE_CLAUDE_VISION_BANK|INVOICE|HANDWRITTEN` stay `false` in `.env`.
9. At the end: list files changed, the test command and its result, and suggest the commit message. Do not push.

## Category list (the taxonomy)

`customer_receipt` (stage 1 only; reconciliation turns it into `collection` or `sales_upi`), `collection`, `sales_upi`, `supplier_payment`, `cash_deposit`, `emi`, `salary`, `electricity`, `internet`, `transport`, `packaging`, `repairs`, `bank_charges`, `misc_expense`, `od_interest`, `gst_payment`, `owner_capital`, `owner_drawing`, `other`.

Why `customer_receipt` first: `UPI/CR/<ref>/<NAME>` is the same text for a shop sale and for a payment against a credit invoice. Only matching against invoices can tell them apart.

## Test data (made from the Mauli Traders dataset)

Copy the `fixtures/` folder to `backend/parser-backend/tests/fixtures/categorizer/`.

- `bank_labeled.csv`: columns `txn_no, date, narration, debit, credit, label, label_stage1, variant, split`. `variant` is `clean` (templated narrations) or `messy` (abbreviations, typos, other bank styles, lower case, extra reference numbers). `split` is `train` (Apr-Dec 2025 rows and their messy copies) or `test` (Jan-Mar 2026 rows and their messy copies). Rows labelled `other` are things the categorizer must NOT recognise (POS purchase, insurance, refund and so on).
- `invoices/*.pdf` and `invoices/expected.json`: six real generated invoices (cash, UPI, credit, one with a GST customer) and the correct fields for each.

Honest note: clean accuracy will be about 100% because the narrations are templated. The number to report is the messy test accuracy.

---

## Step 0 - Plan and fixtures in the repo

- Add this file to `docs/`, the fixtures to `tests/fixtures/categorizer/`, and `schema/005_invoice_party_fields.sql` if it is not there yet.
- Apply 005 to dev and test (see rule 5).
- Add a line to TRACKER.md pointing to this plan.
- Done when: both `apply_schema` runs succeed and `\d invoices` shows `direction, party_name, payment_mode, due_date, paid_at`.
- Commit: `Add categorizer plan, fixtures and migration 005`

## Step 1 - Migration 006

File `schema/006_categorization.sql`, safe to run twice:

- `bank_transactions` add: `category TEXT`, `category_source TEXT CHECK (category_source IN ('rule','model','manual'))`, `category_confidence NUMERIC(4,3)`, `counterparty TEXT`.
- `documents` add: `data_source TEXT NOT NULL DEFAULT 'parsed' CHECK (data_source IN ('parsed','seeded'))`.
- New table `invoice_payments`: `id UUID PK default gen_random_uuid()`, `tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`, `invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE`, `bank_transaction_id UUID NOT NULL REFERENCES bank_transactions(id) ON DELETE CASCADE`, `amount NUMERIC(12,2) NOT NULL`, `match_score NUMERIC(4,3)`, `status TEXT NOT NULL CHECK (status IN ('matched','partial','possible'))`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `UNIQUE (invoice_id, bank_transaction_id)`.
- Indexes: `invoice_payments(tenant_id)`, `invoice_payments(invoice_id)`, `bank_transactions(tenant_id, category)`.
- Apply to dev and test. Add a small DB test (`pytest.mark.db`) that inserts one link and checks the unique constraint and tenant filter.
- Done when: apply runs on dev and test, the test passes.
- Commit: `Migration 006: categories, invoice_payments, data_source`
- After this push: tell the receivables and payables teammate to read `invoice_payments` and `invoices.paid_at`.

## Step 2 - The categorizer (pure Python, no database)

Package `categorizer/` in `backend/parser-backend/`:

- `taxonomy.py`: the category list above, plus which side (debit or credit) each one normally sits on.
- `rules.py`: ordered case-insensitive regex table. Examples: `SALARY|SAL\b` -> salary, `MSEDCL|ELEC` -> electricity, `EMI|ECS|NACH.*LOAN` -> emi, `GSTR|GST PMT|CHALLAN` -> gst_payment, `OD INT` -> od_interest, `OWNER CAPITAL` -> owner_capital, `ATM.*(WDL|WITHDRAW)` -> owner_drawing, `CASH DEP` -> cash_deposit, `^(.*UPI.*CR)` -> customer_receipt, a `PO-\d{4}-\d{2}-\d{4}` reference on a debit -> supplier_payment. A category must agree with the debit or credit side, otherwise the rule is ignored.
- `model.py`: a tiny pure-Python multinomial Naive Bayes on word and character-trigram tokens of the narration. No dependencies. Trained model saved as JSON in `categorizer/model.json` (should stay under 1 MB).
- `categorize.py`: `categorize(narration, debit, credit) -> CategoryResult(category, source, confidence, counterparty)`. Order: rules (confidence 1.0, source `rule`) then model (source `model`, accept only if probability >= 0.80) then `other` with `needs_review`. Counterparty: the name after `UPI/CR/<ref>/` or `UPI/DR/<ref>`, or the supplier text after a PO number.
- `train.py` (CLI): trains on `split == train` rows (both variants) and writes `model.json`. `evaluate.py` (CLI): scores on `split == test`, prints accuracy per category, a confusion list of the worst pairs, and the clean-vs-messy accuracy. Score `label_stage1`.
- `tests/test_categorizer.py` (no database): clean test accuracy >= 99%, messy test accuracy >= 90%, every `other` row is flagged `needs_review` (>= 85% of them), the debit/credit side check works, and a guard test that no module in `categorizer/` imports anthropic or claude_client.
- Done when: the test file passes and `evaluate.py` prints the accuracy table. Paste that table in the report.
- Commit: `Categorizer: rules plus local Naive Bayes, with evaluation`

## Step 3 - Invoice enrichment

Fill the five migration-005 columns from a parsed invoice. First open `pipeline.py` and `invoice_parser/` to see what text the parser keeps. If the raw text is not available to the saver, add the smallest change that makes it available.

- Module `enrichment/invoice.py`: `enrich_invoice(parsed, raw_text, business_name) -> dict(direction, party_name, payment_mode, due_date, paid_at)`.
- `direction`: `sale` if the vendor (issuer) name matches the business name (casefold, strip punctuation, token overlap >= 0.8), otherwise `purchase` with `party_name = vendor_name`.
- For a sale, `party_name` is the customer. In our generated invoices it appears as `Name: <customer>` under "Billing Details". Payment mode appears as `Payment Mode : Cash | UPI | Credit (30 days)` and the due date as `Due Date : 27-Oct-2025`. The same text appears in the line `Settled by: ...`.
- `payment_mode` lower case `cash|upi|credit` (null if not found). `paid_at = invoice_date` for cash and UPI, null for credit.
- Handle both layouts gracefully (a missing field gives null, never an exception).
- Tests: the six PDFs in `fixtures/invoices/` must produce exactly the values in `expected.json`.
- Done when: those tests pass.
- Commit: `Invoice enrichment: direction, party, payment mode, due date`

## Step 4 - Reconciliation

Module `reconciliation/matcher.py`, standard library only (`difflib` for names). `reconcile(conn, tenant_id)`:

1. Open sales: invoices with `direction='sale'`, `payment_mode='credit'`, `paid_at IS NULL`. Outstanding = total minus the sum of linked `invoice_payments`.
2. Candidate receipts: bank rows with `category='customer_receipt'` and no link yet.
3. For each receipt, same normalized party name (similarity >= 0.80), invoice dated on or before the receipt:
   - amount equals one open invoice (within Rs 1): link, status `matched`, score from name similarity;
   - amount equals the sum of 2 to 4 of that party's oldest open invoices: link all, `matched`;
   - amount smaller than the oldest open invoice: apply to it (FIFO), status `partial`;
   - no name match, but the amount equals exactly one open invoice within 60 days: status `possible`.
4. Receipt linked: set the bank row category to `collection`. No candidate at all: set it to `sales_upi`.
5. Purchases: a supplier payment whose narration holds a PO or invoice number is linked to the purchase invoice with that number. Otherwise match on party name and amount.
6. When an invoice's outstanding reaches 0.50 or less, set `paid_at` to the date of the last receipt.
- Idempotent: running it twice changes nothing. Always scoped to `tenant_id`. Surplus amounts are ignored, not invented.
- Tests (`pytest.mark.db`, build small synthetic cases): exact, partial then complete, one transfer paying two invoices, a possible match, a different tenant's data never touched, idempotent second run.
- Done when: those tests plus `test_tenant_isolation.py` pass.
- Commit: `Reconciliation: link receipts and supplier payments to invoices`

## Step 5 - Wire into the upload path

- After `document_store` saves a bank statement: categorize each row and write the category columns. After it saves an invoice: run `enrich_invoice` and write the five columns. Then run `reconcile` for the tenant. Same transaction where possible. A failure in these layers must not lose the saved document: log it and set `needs_review`.
- `scripts/reprocess_tenant.py --env DATABASE_URL --expect-db msme_bios_dev --tenant-id <uuid>`: re-run categorize, enrich and reconcile on existing rows (used for seeded data).
- Test (db): save a bank statement and two invoices through `document_store` and check categories, enrichment, a link and `paid_at`.
- Done when: that test and `test_tenant_isolation.py` pass.
- Commit: `Run categorize, enrich and reconcile after each upload`

## After step 5 (outside Claude Code, done in the research session)

6. April proof run: April bank statement as PDF, 428 April invoices through the real parser and the new layers, accuracy report against the CSV truth.
7. Seed the rest of the year into the same tables with `data_source='seeded'`, then `reprocess_tenant.py`.
8. Features on the normalized data, one per session: P&L, cash dashboard, receivables and payables, aging, revenue concentration, anomaly detection.

## Prompt to paste at the start of each step

    Read CLAUDE.md and docs/CATEGORIZER_PLAN.md (the rules section first). Do Step N of that plan only.
    Open only the files that step names. No Claude API, no new heavy dependencies, dev database only,
    never run the full test suite. When done, report files changed, the test result, and the commit
    message. Do not push.
