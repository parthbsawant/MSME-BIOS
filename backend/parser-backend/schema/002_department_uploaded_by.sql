-- MSME-BIOS: migration 002, Step 2 (own document database). See SPEC.md
-- sections 7 and 8.
--
-- Stamps every document and every parser row with:
--   department   which department's data this is (finance, sales, hr,
--                marketing). "owner" is a role, not a department - the
--                owner sees all four. Members (Step 4) only see their own.
--   uploaded_by  which user uploaded it (users.id). Nullable, and set to
--                NULL rather than deleting the business's data if that
--                user row is ever removed.
--
-- Like tenant_id, department is carried on EVERY table, not only on
-- documents, so a department filter never depends on remembering a join.
--
-- Safe to run more than once (IF NOT EXISTS everywhere). department is
-- NOT NULL with no database default on purpose: the application must
-- always decide it, so a forgotten department fails loudly instead of
-- silently landing in the wrong department. The tables are empty before
-- Step 2, so adding a NOT NULL column succeeds; if any table somehow had
-- rows, the whole migration fails and rolls back, changing nothing.
--
-- Run with:
--   python scripts/apply_schema.py --env DATABASE_URL --expect-db msme_bios_dev schema/002_department_uploaded_by.sql
-- (or psql --single-transaction -f 002_department_uploaded_by.sql)

-- ============================================================
-- COLUMNS
-- ============================================================

ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS department TEXT NOT NULL
        CHECK (department IN ('finance', 'sales', 'hr', 'marketing')),
    ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE bank_transactions
    ADD COLUMN IF NOT EXISTS department TEXT NOT NULL
        CHECK (department IN ('finance', 'sales', 'hr', 'marketing')),
    ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS department TEXT NOT NULL
        CHECK (department IN ('finance', 'sales', 'hr', 'marketing')),
    ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE invoice_line_items
    ADD COLUMN IF NOT EXISTS department TEXT NOT NULL
        CHECK (department IN ('finance', 'sales', 'hr', 'marketing')),
    ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE handwritten_bills
    ADD COLUMN IF NOT EXISTS department TEXT NOT NULL
        CHECK (department IN ('finance', 'sales', 'hr', 'marketing')),
    ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE handwritten_line_items
    ADD COLUMN IF NOT EXISTS department TEXT NOT NULL
        CHECK (department IN ('finance', 'sales', 'hr', 'marketing')),
    ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================
-- INDEXES
--
-- (tenant_id, department) is the query shape for every member request
-- from Step 4 on: "this business's rows for my department". Owner
-- queries filter on tenant_id alone and still use the leading column.
-- documents also gets (tenant_id, created_at) for the newest-first
-- "list my documents" endpoint.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_documents_tenant_department ON documents(tenant_id, department);
CREATE INDEX IF NOT EXISTS idx_documents_tenant_created ON documents(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_tenant_department ON bank_transactions(tenant_id, department);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_department ON invoices(tenant_id, department);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_tenant_department ON invoice_line_items(tenant_id, department);
CREATE INDEX IF NOT EXISTS idx_handwritten_bills_tenant_department ON handwritten_bills(tenant_id, department);
CREATE INDEX IF NOT EXISTS idx_handwritten_line_items_tenant_department ON handwritten_line_items(tenant_id, department);
