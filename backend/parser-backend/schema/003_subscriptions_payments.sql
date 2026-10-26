-- MSME-BIOS: migration 003, Step 3 (mock payments and seats). See SPEC.md
-- sections 4, 5 and 7.
--
--   plans          gains seats_included and extra_seats. plans.price now
--                  holds the SERVER-computed monthly total (pricing.py),
--                  never a browser-supplied number.
--   subscriptions  one per tenant. A plan counts as active ONLY when its
--                  subscription status is 'active', which only a verified
--                  payment (or the legacy backfill below) sets.
--   payments       one row per payment attempt, paid or failed.
--
-- Backfill (decision 2026-10-26): every tenant that already had a plan
-- before Step 3 gets an ACTIVE subscription with provider 'legacy', so
-- no existing account is locked out. Seat numbers in the backfill are
-- copied from pricing.py as it was on that date.
--
-- Safe to run more than once (IF NOT EXISTS; the backfill skips tenants
-- that already have a subscription).
--
-- Run with:
--   python scripts/apply_schema.py --env DATABASE_URL --expect-db msme_bios_dev schema/003_subscriptions_payments.sql

-- ============================================================
-- PLANS: seats
-- ============================================================

ALTER TABLE plans
    ADD COLUMN IF NOT EXISTS seats_included INTEGER NOT NULL DEFAULT 2 CHECK (seats_included >= 1),
    ADD COLUMN IF NOT EXISTS extra_seats INTEGER NOT NULL DEFAULT 0 CHECK (extra_seats BETWEEN 0 AND 20);

UPDATE plans SET seats_included = CASE tier_id
        WHEN 'starter' THEN 2
        WHEN 'growth' THEN 4
        WHEN 'intelligence' THEN 6
        WHEN 'full_suite' THEN 10
        ELSE 2
    END
-- First run only (subscriptions does not exist yet), so a re-run never
-- overwrites seat numbers set later by checkout.
WHERE NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = 'subscriptions');

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS subscriptions (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id            UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    seats_purchased    INTEGER NOT NULL CHECK (seats_purchased >= 1),
    status             TEXT NOT NULL CHECK (status IN ('pending', 'active', 'failed')),
    amount             NUMERIC(10, 2) NOT NULL,
    provider           TEXT NOT NULL,
    provider_order_id  TEXT,
    paid_at            TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PAYMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS payments (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    subscription_id      UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    amount               NUMERIC(10, 2) NOT NULL,
    status               TEXT NOT NULL CHECK (status IN ('paid', 'failed')),
    provider             TEXT NOT NULL,
    provider_order_id    TEXT NOT NULL,
    provider_payment_id  TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_subscription_id ON payments(subscription_id);
-- A provider order id identifies one order; verify looks it up by this.
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_provider_order_id
    ON subscriptions(provider, provider_order_id) WHERE provider_order_id IS NOT NULL;

-- ============================================================
-- BACKFILL: existing plans become active 'legacy' subscriptions
-- ============================================================

INSERT INTO subscriptions (tenant_id, plan_id, seats_purchased, status, amount, provider, paid_at)
SELECT p.tenant_id, p.id, p.seats_included + p.extra_seats, 'active', p.price, 'legacy', now()
FROM plans p
WHERE NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.tenant_id = p.tenant_id);
