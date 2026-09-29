-- MSME-BIOS: initial schema, Milestone 2 Phase 1.
--
-- Establishes the identity/tenancy foundation and the tables that will
-- hold what's currently only in the frontend's UID-scoped localStorage
-- (business profile, plan) plus what the parsers already produce
-- (documents and their extracted line items).
--
-- Nothing here touches the parser code itself - these tables are new,
-- additive persistence for data the parsers already return as
-- ParserResult objects. The parsers remain unchanged.
--
-- Run with:
--   psql -d msme_bios -f 001_initial_schema.sql

-- ============================================================
-- IDENTITY AND TENANCY
-- ============================================================

-- One row per Firebase-authenticated identity. firebase_uid is the only
-- link to Firebase - nothing else about Firebase's own data lives here.
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid  TEXT NOT NULL UNIQUE,
    email         TEXT NOT NULL,
    display_name  TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per tenant (business). Deliberately minimal - the actual
-- business profile lives in `businesses` below. Kept as its own table,
-- separate from `users`, specifically because a user and a tenant are
-- different kinds of thing: a user is an authentication identity, a
-- tenant is the thing that owns data. Today's frontend only ever
-- creates one tenant per user, but this structure doesn't assume that
-- stays true - e.g. an accountant with access to more than one business
-- is a user_tenants row away, not a schema change.
CREATE TABLE tenants (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Many-to-many join between users and tenants. A real row here is what
-- the backend will check to answer "which tenant does this authenticated
-- user have access to" - never a client-supplied tenant_id.
CREATE TABLE user_tenants (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role        TEXT NOT NULL DEFAULT 'owner',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, tenant_id)
);

-- ============================================================
-- BUSINESS CONFIGURATION
-- (replaces the frontend's UID-scoped localStorage, per Section 3/17)
-- ============================================================

-- One row per tenant's business profile. 1:1 with tenant today, matching
-- the current onboarding flow (one business per signup) - the UNIQUE on
-- tenant_id enforces that; relaxing it later if that assumption changes
-- is a constraint drop, not a redesign.
CREATE TABLE businesses (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    business_name    TEXT NOT NULL,
    owner_name       TEXT NOT NULL,
    business_type    TEXT,
    annual_turnover  TEXT,
    city             TEXT,
    gstin            TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per tenant's selected plan - mirrors what PlanContext.jsx
-- currently stores client-side (tier or custom, feature list, price).
CREATE TABLE plans (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    plan_type    TEXT NOT NULL CHECK (plan_type IN ('tier', 'custom')),
    tier_id      TEXT,
    feature_ids  TEXT[] NOT NULL,
    price        NUMERIC(10, 2) NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- DOCUMENT INGESTION
-- ============================================================

-- One row per uploaded document, regardless of which parser handled it.
-- Mirrors the shared ParserResult contract's own fields exactly
-- (tenant_id, source_file, source_type, extraction_method, needs_review,
-- review_reason, extracted_at) - see msme_bios_shared/base_models.py.
CREATE TABLE documents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    source_type         TEXT NOT NULL CHECK (source_type IN ('bank_statement', 'invoice_bill', 'photo_bill')),
    source_file         TEXT NOT NULL,
    extraction_method   TEXT NOT NULL,
    needs_review        BOOLEAN NOT NULL DEFAULT false,
    review_reason       TEXT,
    extracted_at        TIMESTAMPTZ NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PARSER DATA
--
-- Every table below carries BOTH a foreign key to its parent AND its
-- own tenant_id column, rather than relying only on a join through
-- documents.tenant_id. This is deliberate, not redundant: every
-- tenant-scoped query can filter on tenant_id directly on the table
-- being queried, so a forgotten join condition can't accidentally leak
-- another tenant's rows the way a forgotten join filter could.
-- ============================================================

CREATE TABLE bank_transactions (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id    UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    txn_date       DATE,
    description    TEXT,
    debit          NUMERIC(12, 2),
    credit         NUMERIC(12, 2),
    balance        NUMERIC(12, 2),
    needs_review   BOOLEAN NOT NULL DEFAULT false,
    review_reason  TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1:1 with its document - one invoice per invoice document.
CREATE TABLE invoices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id     UUID NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    vendor_name     TEXT,
    invoice_number  TEXT,
    invoice_date    DATE,
    gstin           TEXT,
    subtotal        NUMERIC(12, 2),
    cgst_amount     NUMERIC(12, 2),
    sgst_amount     NUMERIC(12, 2),
    total           NUMERIC(12, 2),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE invoice_line_items (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id   UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    description  TEXT,
    qty          NUMERIC(10, 2),
    rate         NUMERIC(12, 2),
    amount       NUMERIC(12, 2),
    gst_pct      NUMERIC(5, 2),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1:1 with its document - one bill per handwritten-bill document.
CREATE TABLE handwritten_bills (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id               UUID NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
    tenant_id                 UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    vendor_or_customer_name   TEXT,
    bill_date                 DATE,
    total                     NUMERIC(12, 2),
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE handwritten_line_items (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id      UUID NOT NULL REFERENCES handwritten_bills(id) ON DELETE CASCADE,
    tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    description  TEXT,
    qty          NUMERIC(10, 2),
    rate         NUMERIC(12, 2),
    amount       NUMERIC(12, 2),
    confidence   TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
--
-- Every tenant-scoped table gets an index on tenant_id, since "give me
-- everything for this tenant" is the query shape that will run on
-- essentially every authenticated request. Child tables also get an
-- index on their parent foreign key, for the equally common "give me
-- this document's line items" shape.
-- ============================================================

CREATE INDEX idx_users_firebase_uid ON users(firebase_uid);

CREATE INDEX idx_user_tenants_user_id ON user_tenants(user_id);
CREATE INDEX idx_user_tenants_tenant_id ON user_tenants(tenant_id);

CREATE INDEX idx_documents_tenant_id ON documents(tenant_id);

CREATE INDEX idx_bank_transactions_tenant_id ON bank_transactions(tenant_id);
CREATE INDEX idx_bank_transactions_document_id ON bank_transactions(document_id);

CREATE INDEX idx_invoices_tenant_id ON invoices(tenant_id);
CREATE INDEX idx_invoice_line_items_tenant_id ON invoice_line_items(tenant_id);
CREATE INDEX idx_invoice_line_items_invoice_id ON invoice_line_items(invoice_id);

CREATE INDEX idx_handwritten_bills_tenant_id ON handwritten_bills(tenant_id);
CREATE INDEX idx_handwritten_line_items_tenant_id ON handwritten_line_items(tenant_id);
CREATE INDEX idx_handwritten_line_items_bill_id ON handwritten_line_items(bill_id);
