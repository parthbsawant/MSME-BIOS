-- MSME-BIOS: migration 005 (analytics features). See TRACKER.md "NEXT PHASE".
--
-- Receivables, payables, aging and revenue concentration need to know who an
-- invoice is with, which way the money goes, and whether it was paid. The
-- invoices table only has vendor_name (the issuer). This adds nullable
-- columns, so the parsers, existing rows and existing code are unchanged:
--   direction     'sale' (we issued it) or 'purchase' (a supplier bill to us).
--                 NULL = not classified (every invoice saved before this migration).
--   party_name    the customer (sale) or supplier (purchase).
--   payment_mode  cash / upi / credit.
--   due_date      when a credit invoice is due.
--   paid_at       date it was settled. NULL = still open.
--
-- Safe to run more than once (IF NOT EXISTS). Also adds the two indexes the
-- analytics queries use (by date, per tenant).
--
-- Run with:
--   python scripts/apply_schema.py --env DATABASE_URL --expect-db msme_bios_dev schema/005_invoice_party_fields.sql
-- then the same for --env TEST_DATABASE_URL --expect-db msme_bios_test.
-- Production: apply BEFORE pushing backend code that needs these columns.

ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS direction TEXT CHECK (direction IN ('sale', 'purchase')),
    ADD COLUMN IF NOT EXISTS party_name TEXT,
    ADD COLUMN IF NOT EXISTS payment_mode TEXT CHECK (payment_mode IN ('cash', 'upi', 'credit')),
    ADD COLUMN IF NOT EXISTS due_date DATE,
    ADD COLUMN IF NOT EXISTS paid_at DATE;

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_date ON invoices(tenant_id, invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_direction ON invoices(tenant_id, direction);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_tenant_date ON bank_transactions(tenant_id, txn_date);
