-- MSME-BIOS: migration 007 (Invoice Generator feature).
--
-- Adds business profile fields for invoice branding/payment instructions,
-- per-tenant financial year invoice sequence counter, and supports generated documents.
--
-- Run with:
--   python scripts/apply_schema.py --env DATABASE_URL --expect-db msme_bios_dev schema/007_invoice_generator.sql
-- then the same for --env TEST_DATABASE_URL --expect-db msme_bios_test.
-- Production: apply BEFORE pushing backend code that needs these columns.

ALTER TABLE businesses
    ADD COLUMN IF NOT EXISTS address TEXT,
    ADD COLUMN IF NOT EXISTS phone TEXT,
    ADD COLUMN IF NOT EXISTS tagline TEXT,
    ADD COLUMN IF NOT EXISTS upi_id TEXT,
    ADD COLUMN IF NOT EXISTS bank_name TEXT,
    ADD COLUMN IF NOT EXISTS bank_branch TEXT,
    ADD COLUMN IF NOT EXISTS terms TEXT,
    ADD COLUMN IF NOT EXISTS invoice_prefix TEXT DEFAULT '';

CREATE TABLE IF NOT EXISTS invoice_sequences (
    tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    fy           TEXT NOT NULL,
    last_number  INT NOT NULL DEFAULT 0,
    PRIMARY KEY (tenant_id, fy)
);
