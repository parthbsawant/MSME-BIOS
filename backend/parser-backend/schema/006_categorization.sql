-- MSME-BIOS: migration 006 (categorizer and reconciliation).
-- See docs/CATEGORIZER_PLAN.md, Step 1.
--
--   bank_transactions  category, where it came from (rule / model / manual),
--                      confidence 0.000-1.000, and the counterparty name.
--                      NULL category = not categorized yet.
--   documents          data_source: 'parsed' (uploaded through a parser) or
--                      'seeded' (loaded by a seed script). Existing rows get 'parsed'.
--   invoice_payments   links a bank transaction to the invoice it pays.
--                      One bank row can pay several invoices and one invoice
--                      can be paid by several bank rows (partial payments).
--                      Carries its own tenant_id like every tenant-owned table.
--
-- Safe to run more than once (IF NOT EXISTS everywhere).
--
-- Run with:
--   python scripts/apply_schema.py --env DATABASE_URL --expect-db msme_bios_dev schema/006_categorization.sql
-- then the same for --env TEST_DATABASE_URL --expect-db msme_bios_test.
-- Production: apply BEFORE pushing backend code that needs these columns.

ALTER TABLE bank_transactions
    ADD COLUMN IF NOT EXISTS category TEXT,
    ADD COLUMN IF NOT EXISTS category_source TEXT
        CHECK (category_source IN ('rule', 'model', 'manual')),
    ADD COLUMN IF NOT EXISTS category_confidence NUMERIC(4, 3),
    ADD COLUMN IF NOT EXISTS counterparty TEXT;

ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS data_source TEXT NOT NULL DEFAULT 'parsed'
        CHECK (data_source IN ('parsed', 'seeded'));

CREATE TABLE IF NOT EXISTS invoice_payments (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    invoice_id           UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    bank_transaction_id  UUID NOT NULL REFERENCES bank_transactions(id) ON DELETE CASCADE,
    amount               NUMERIC(12, 2) NOT NULL,
    match_score          NUMERIC(4, 3),
    status               TEXT NOT NULL CHECK (status IN ('matched', 'partial', 'possible')),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (invoice_id, bank_transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_tenant ON invoice_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_tenant_category ON bank_transactions(tenant_id, category);
