-- MSME-BIOS: migration 004, Step 4 (roles and invitations). See SPEC.md
-- sections 3, 6, 7 and 9.
--
--   user_tenants  role limited to the five fixed roles; new status
--                 (active / deactivated). v1 rules enforced by the
--                 database itself, not only by code:
--                   - one person belongs to one business (UNIQUE user_id)
--                   - one owner per business
--   invitations   one row per invite. Only a SHA-256 hash of the invite
--                 token is stored, so a database leak does not leak
--                 working invite links. Expiry is 7 days (set by code).
--   audit_log     team actions: invite, revoke, role change, deactivate,
--                 reactivate, join (decision 2026-10-26).
--
-- Every existing user_tenants row has role 'owner' (nothing else could
-- create one before Step 4), so the constraints below apply cleanly.
-- Safe to run more than once.
--
-- Run with:
--   python scripts/apply_schema.py --env DATABASE_URL --expect-db msme_bios_dev schema/004_roles_invitations.sql

-- ============================================================
-- USER_TENANTS: role, status, v1 uniqueness
-- ============================================================

ALTER TABLE user_tenants
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_tenants_role_check') THEN
        ALTER TABLE user_tenants ADD CONSTRAINT user_tenants_role_check
            CHECK (role IN ('owner', 'finance', 'sales', 'hr', 'marketing'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_tenants_status_check') THEN
        ALTER TABLE user_tenants ADD CONSTRAINT user_tenants_status_check
            CHECK (status IN ('active', 'deactivated'));
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_tenants_one_business_per_user ON user_tenants(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_tenants_one_owner_per_business ON user_tenants(tenant_id) WHERE role = 'owner';

-- ============================================================
-- INVITATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS invitations (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email        TEXT NOT NULL,                      -- stored lower-case
    role         TEXT NOT NULL CHECK (role IN ('finance', 'sales', 'hr', 'marketing')),
    token_hash   TEXT NOT NULL UNIQUE,               -- sha256 hex of the link token
    status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
    invited_by   UUID REFERENCES users(id) ON DELETE SET NULL,
    expires_at   TIMESTAMPTZ NOT NULL,
    accepted_at  TIMESTAMPTZ,
    accepted_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invitations_tenant_id ON invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
-- At most one live invite per email per business.
CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_one_pending_per_email
    ON invitations(tenant_id, email) WHERE status = 'pending';

-- ============================================================
-- AUDIT LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_log (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id    UUID REFERENCES users(id) ON DELETE SET NULL,   -- who did it
    action     TEXT NOT NULL,                                  -- e.g. invite.created, member.role_changed
    target     TEXT,                                           -- e.g. invited email, member user id
    details    JSONB,
    at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_at ON audit_log(tenant_id, at DESC);
