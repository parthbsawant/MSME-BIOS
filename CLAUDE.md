# MSME-BIOS

BE final-year project (owner: Parth Sawant). A multi-tenant business-intelligence platform for Indian MSMEs. Users upload bank statements, invoices and handwritten bills; parsers extract structured data; analytics and decision support come later. All data is synthetic (demo business: "Mauli Traders"). Repo: github.com/parthbsawant/MSME-BIOS

READ FIRST: SPEC.md (final agreed design) and TRACKER.md (tick-box build order) in the repo root. Work on one TRACKER step at a time.

## Layout
MSME-BIOS/
  SPEC.md  TRACKER.md  SETUP.md  CLAUDE.md  .gitattributes
  backend/parser-backend/        Python: FastAPI, parsers, Postgres schema
    api.py                       endpoints (see Architecture)
    pipeline.py                  single parser entry point: process(file_path, tenant_id, document_type)
    firebase_auth.py             verifies Firebase ID tokens (Admin SDK)
    tenant_resolution.py         Firebase UID -> user -> tenant_id
    db_pool.py                   Postgres connection for app tables
    bank_parser/ invoice_parser/ handwritten_parser/
    msme_bios_shared/            base models, config, claude_client, db.py (parser staging, separate concern)
    schema/001_initial_schema.sql
    tests/
  frontend/msme-bios-frontend/   React 19 + Vite + Tailwind v4 + react-router + framer-motion
    src/pages  src/components  src/context  src/lib  src/locales

## Deployment (live)
- Backend: Render (Docker, Python 3.12, free tier sleeps; first request can take about a minute). Health check /api/health.
- Frontend: Vercel. Database: Neon Postgres (production).
- Render env FRONTEND_URL is a comma-separated CORS allowlist (Vercel URL plus http://localhost:5173).
- DATABASE_URL must start exactly with postgresql:// (no "psql '" prefix, no quotes, no spaces) or psycopg2 fails to parse it.
- A 500 from the backend carries no CORS headers, so the browser reports it as a CORS error. Check the real status first.

## Run (Windows PowerShell is the current machine; Mac also used)
- Backend: cd backend\parser-backend; .venv\Scripts\Activate.ps1; uvicorn api:app --reload --port 8000   (Mac: source .venv/bin/activate)
- Frontend: cd frontend\msme-bios-frontend; npm run dev (port 5173). Never run npm from the repo root.
- PowerShell: chain with ; not &&. curl is an alias, use curl.exe.
- Always activate .venv first.
- Tesseract OCR binary must be installed locally for the handwritten parser (installed on Windows at C:\Program Files\Tesseract-OCR, on PATH).
- Tests: python -m pytest tests/ -q from backend/parser-backend (expected 185 passed, 1 skipped; about 16 minutes because the test DB is remote - run it in the background)
- Roles: roles.py is the only place role rules live (department_for, allowed_features, effective_features = plan ∩ role, can_manage_business, is_member_role). Never write `if role == ...` in endpoints..
- Prices: backend/parser-backend/pricing.py is the only authority (quote()). featuresData.js mirrors it for display; tests/test_pricing.py fails if they differ, so change both together. tests/conftest.py points every test at TEST_DATABASE_URL (Neon msme_bios_test); tests marked `pytestmark = pytest.mark.db` are SKIPPED if it is missing, unreachable, equal to DATABASE_URL, or its database name lacks "test". Mark any new database test the same way. Test users use @test.com emails.
- Databases (one Neon project, branch main): production DB = live Render only; msme_bios_dev = DATABASE_URL in each laptop's backend .env; msme_bios_test = TEST_DATABASE_URL, pytest only.
- Schema changes: python scripts/apply_schema.py --env <VAR> --expect-db <name> schema/<file>.sql (aborts if the URL's database is not <name>; all files in one transaction). Applied so far: dev, test and production (neondb) all have 001+002+003+004 (003 on production 2026-10-26: 3 existing plans became active 'legacy' subscriptions; 004 on production 2026-10-26: 5 existing owners kept role owner, status active). Production URL is never kept in a laptop .env; add PROD_DATABASE_URL temporarily only to apply a migration, then remove it.
- If Tesseract tests fail with TesseractNotFoundError in VS Code, restart VS Code (it was opened before Tesseract was added to PATH).
- Two-machine setup is in SETUP.md. Gitignored files (.env, Firebase service-account JSON, node_modules, .venv) do not travel between machines.
- .gitattributes forces LF. CRLF conversion corrupts the sample PDFs and breaks the bank-parser tests.

## Architecture rules (do not break)
- Auth: Firebase (email/password and Google) on the frontend. The frontend sends the ID token as Authorization: Bearer. The backend verifies it with the Firebase Admin SDK.
- tenant_id is NEVER accepted from the client. Server-side chain: verified Firebase UID -> users -> user_tenants -> tenants -> tenant_id -> pipeline.process().
- Endpoints: GET /api/health (public), GET /api/me, POST /api/business, POST /api/plan, POST /api/parse, GET /api/documents, GET /api/documents/{id}, POST /api/checkout/order, POST /api/checkout/mock-pay (mock provider only), POST /api/checkout/verify (all these require a valid token); POST /api/payments/webhook (no token; authenticated by the provider's X-Payment-Signature header). Step 4 team (owner of a paid business): POST/GET /api/team/invites, POST /api/team/invites/{id}/revoke, GET /api/team/members (with seat summary), POST /api/team/members/{user_id}/role|deactivate|reactivate, GET /api/team/audit (owner). Invites: GET /api/invites/{token} (public preview), POST /api/invites/accept (valid token, no business needed).
- Team (Step 4): team.py holds invites, members, seats, audit. Invite link token returned once (path /invite/<token>), only its sha256 stored, 7-day expiry. Seat rule: active members (owner included) + live pending invites <= subscriptions.seats_purchased (409 seat_limit; reactivating also takes a seat). Accept checks token exists, not revoked (410), not used (409), not expired (410), email matches (403); invitee's own EMPTY business is deleted, a non-empty one -> 409 has_business. Owner cannot be invited, re-roled or deactivated (403 owner_protected).
- Payments (Step 3): payments/ holds the PaymentProvider interface (create_order, verify_payment, handle_webhook) and MockProvider; PAYMENT_PROVIDER env picks one (default mock). subscriptions.py holds the DB logic. Flow: order (server computes amount via pricing.quote, saves plan + PENDING subscription) -> mock-pay (plays the provider's checkout window, returns payment_id + HMAC signature, changes nothing) -> verify (only path that sets 'active'; bad signature -> 'failed'). Paywall: /api/parse and /api/documents* return 402 payment_required unless subscriptions.status = 'active'. /api/me returns subscription (or null). /api/plan still exists but ignores client price and never activates. New checkout while active -> 409 (upgrades later). Tests needing a paid business use tests/checkout_helpers.buy_plan().
- GET /api/documents = caller's business's documents, newest first, summaries (item_count, total). GET /api/documents/{id} = one document in the same JSON shape /api/parse returns; another business's id (or a malformed id) gives 404, never 403. All document reads go through document_store._scope(tenant_id, department); department=None (owner) today, Step 4 passes a member's department there. Child rows are ordered by line_no.
- GET /api/me returns firebase_uid, email, tenant_id, business (or null) and plan (or null). Onboarding state (business and plan) is loaded from /api/me; the database is the source of truth. localStorage is only a cache, keyed by UID.
- Every tenant-owned table carries its own tenant_id column.
- Parsers share one ParserResult contract. Do not rewrite parser logic without a proven need.
- Handwritten parser is local Tesseract only. ENABLE_CLAUDE_VISION_* flags are false. Do not enable them.
- Parsed results are saved by document_store.save_parser_result() (one transaction: documents row + bank_transactions / invoices + invoice_line_items / handwritten_bills + handwritten_line_items, each row stamped with tenant_id, department, uploaded_by). /api/parse takes optional department (default finance) and returns document_id and department. Parsers are unchanged. Rule for future migrations: apply to production BEFORE pushing backend code that needs them (Render autoDeploy is on), or live requests fail.
- Access (Step 4): access.py resolves a Context (user_id, tenant_id, role, status, department) from the verified token via tenant_resolution.resolve_membership. Endpoints declare what they need: access.current_context (any active member), access.require_owner (business, plan, checkout, team), access.require_paid (documents; 402 if unpaid), access.feature_access("document_parser") (upload; 402 then 403 if not in plan ∩ role). Errors are access.ApiError -> {"error","message"}: owner_only, deactivated, invite_pending, feature_not_available, payment_required. Members' uploads are forced to their own department; owner may choose. A user with a pending, unexpired invitation gets NO business of their own (/api/me returns invite_pending: true); others still get a new business as owner on first sign-in. /api/me also returns role, department, status, effective_features; members get plan without price/seats and subscription with status only.

## Conventions and gotchas
- Python 3.9 compatibility (Mac and some tooling): no bare `str | None` unless the file has `from __future__ import annotations`. Use Optional[str].
- Money is NUMERIC in Postgres, never float.
- Secrets: never commit .env or the Firebase service-account JSON, never print .env values, never ask for keys. .env lines must be KEY=value.
- Backend .env: DATABASE_URL, TEST_DATABASE_URL, FIREBASE_SERVICE_ACCOUNT_PATH, FRONTEND_URL, ANTHROPIC_API_KEY (placeholder), ENABLE_CLAUDE_VISION_BANK|INVOICE|HANDWRITTEN. Frontend .env: VITE_API_URL and six VITE_FIREBASE_* keys.
- UI logic files to touch only deliberately: AuthContext, lib/api.js, ProtectedRoute, RequireOnboarded, RedirectIfAuthenticated, BusinessContext, PlanContext.
- In raw JSX text use HTML entities (&mdash;, &rsquo;), not unicode escapes.
- Do not run npm audit fix --force (would downgrade Firebase).
- Neon free compute autosuspends; first query can be slow.

## Design system
Warm palette. Light: page #FBF3EC, card white, text #2A2521, muted #8A7F74, accent #E8622C. Dark: page #1A1714, card #242019, text #F5EFE8, accent #F27A4A. Light and dark mode required on every screen. Logo always sits on a white chip.

## Internationalisation (react-i18next)
- Languages: English, Hindi, Marathi. Files in src/locales/{en,hi,mr}/, one JSON per namespace (common, landing, auth, onboarding, catalog, upload, results, guide, dashboard). Setup in src/lib/i18n.js; switcher LanguageSwitcher.jsx; language stored in localStorage key msme-language; <html lang> drives Noto Sans Devanagari.
- Style: translate ordinary UI wording naturally; transliterate financial/technical terms phonetically (Invoice -> इनव्हॉइस). Keep GST, GSTIN, PDF, MSME, OCR in Latin.
- Dropdown stored values stay English; only labels translated.
- useCatalog() (src/lib/useCatalog.js) translates feature and tier names/taglines, falling back to featuresData.js.
- Every NEW screen from Steps 3 to 5 must be translated in all three languages as it is built.
- Translations are an AI first pass and need native-speaker review (Step 6).

## Product decisions (locked, details in SPEC.md)
- Two levels of separation: (1) business to business (done); (2) inside one business, department access. Owner sees everything; department users see only their department, never the reverse.
- Five fixed roles: owner, finance, sales, hr, marketing. Keep role logic centralised so custom roles can be added later.
- Department-wide visibility (a Finance user sees all Finance data of that business).
- Seats per tier: Starter 2, Growth 4, Intelligence 6, Full suite 10, Custom 2. Extra-seat price is a placeholder. Seat count is chosen BEFORE checkout. All numbers are placeholders to confirm.
- Invite by link only. Owner copies the link until a real email service exists.
- Feature to role: Finance = document parser, cash dashboard, receivables and payables, P&L, aging, cash flow simulator, anomaly detection. Sales = invoice generator, revenue concentration, demand forecasting. HR = document parser limited to HR documents. Marketing = demand forecasting, revenue concentration, WhatsApp alerts. Owner = everything bought plus business health index, team, billing.
- Effective access = plan features intersect role features.
- Payments: mock provider behind create_order / verify_payment / handle_webhook. Price computed server-side. Plan active only after verified payment. Real Razorpay later.
- Step 4 decisions (2026-10-26): accepting an invite does NOT require a verified email for now (secret link + email match; known limitation, add Firebase email verification next phase). If an invitee already has their own business that is EMPTY (no business details, plan, subscription or documents), it is deleted when they accept and they join the inviter; a business with any data is never deleted and the invite is rejected. An audit_log records team actions (invite, revoke, role change, deactivate/reactivate, join).
- Step 3 decisions (2026-10-26): extra seat = Rs 499 per seat per month (placeholder); at most 20 extra seats; accounts that had a plan before Step 3 get an active subscription with provider 'legacy' (migration 003), so nobody is locked out; new signups must pay.
- Build our own document database now (not waiting for the teammate's design).
- Department at upload: departments are finance, sales, hr, marketing ("owner" is a role, not a department). Until roles exist, the backend accepts an optional department from the owner and defaults to finance. This stays as the fallback for single-owner businesses; members (Step 4) always get their own department, never a client-supplied one.

## Status
DONE: three parsers and pipeline; FastAPI with Firebase-verified tenant-scoped endpoints; Postgres schema and isolation tests; signup, login, Google sign-in (fixed on Vercel 2026-10-23); business and plan persistence; UI revamp; MSME guide page; deployed on Render, Vercel and Neon; onboarding state from /api/me (Step 1b); i18n of all current screens (Step 1, pending final browser verification on the live site); two-machine setup; SPEC.md and TRACKER.md; Step 2 own document database (2026-10-26: migration 002 on dev/test/production, parsed documents saved in one transaction, GET /api/documents and /api/documents/{id}, results page at /results/:documentId reloads the saved document on refresh, dashboard documents count is real); Step 3 mock payments and seats (2026-10-26: pricing.py, migration 003 with legacy backfill, payments/ provider interface + MockProvider, checkout endpoints and paywall, seat stepper, /checkout with success/failure/retry, read-only /billing, billing namespace in en/hi/mr; verified live).

FIXED (2026-10-23, commit 6d19077): Google sign-in failed on Vercel with auth/unauthorized-domain. Fix was adding msme-bios.vercel.app under Firebase Console, Authentication, Settings, Authorized domains. Login and signup pages now show the specific message plus "Error code: auth/..." (mapping in src/lib/googleAuthError.js, en/hi/mr), and firebase.js logs the names of any missing VITE_FIREBASE_* keys. Verified on localhost (new account, existing account, logout/login, cancel popup) and on Vercel. Firebase Authorized domains must contain BOTH msme-bios.vercel.app and localhost (localhost stopped working by default on 2026-10-26 and was added explicitly). Any new frontend domain (custom domain, Vercel preview URL) must be added there too.

FIXED (2026-10-26): F5 on any guarded page sent a registered user to /business-setup. Cause: on refresh Firebase restores the user in the same render where BusinessContext/PlanContext still hold signed-out state (their effects run after that render), so RequireOnboarded redirected. Fix: both contexts track loadedFor (the uid their state belongs to) and report loading until it matches the current uid. Keep this if those contexts are ever rewritten.

OPEN NOTES (not yet scheduled):
- Logo chip in the in-app top bar renders as an empty white pill at narrow widths (seen on Vercel dashboard at ~800px). Check during Step 1 screen checks.
- UI text still says "AI vision" for the handwritten parser although it is local Tesseract; decide whether to soften the wording.
- Dashboard stat-card numbers for sales, expenses and profit are placeholders. Documents count is real (this month's saved documents, from GET /api/documents).

## Build order (do one at a time, tick TRACKER.md after each verified step, commit after each)
1. Language support part 1: finish live verification (F5 stays on dashboard; Incognito login goes to dashboard; mr and hi on dashboard, upload, wrong-file error, real results, guide page, plan pages; dark mode; logout and login), then tick and commit.
2. DONE. Own document database: migration 002 (department, uploaded_by, line_no); separate dev DB and msme_bios_test DB for pytest; save parser output transactionally; list and get document endpoints; results page reads saved documents.
3. DONE. Mock payments and seats: provider interface, server-side pricing, seat count before checkout, plan active only after verified payment.
4. Roles and invitations backend: invite links, join owner's tenant (change tenant_resolution.py), role checks centralised, isolation tests for business-to-business and department-to-department.
5. Team frontend and role-based panels (translated in en, hi, mr).
6. Wrap-up: update this file, update presentation slide that says language support "Planned", native-speaker review of Hindi/Marathi, direnv on Mac, remove leftover test accounts (the @test.com users plus specific accounts Parth lists; check with him before deleting).

NEXT PHASE (after the six steps): real Razorpay, real invite emails, actual dashboard features (cash dashboard, invoice generator, receivables and payables, anomaly detection, business health index and so on), custom roles, Claude Vision for the handwritten parser (local Tesseract read only 4 of 10 items on a real bill), the skipped Firebase-token test.

## How to work with Parth
- Step by step. Say what you will change and why before changing it. Keep changes small. Move fast, ship fast.
- Run tests or the build before saying something works. Do not assume a command succeeded.
- Give exact commands and say where each file goes. When he pastes output, answer PASS or FAIL, what it means, and the next step.
- Never ask for passwords or keys.
- Git (from 2026-10-26): Claude does NOT run git add, commit or push. When work is verified and ready, Claude tells Parth it is time to push and gives the exact commands (git status, git add <files>, git commit -m "...", git push); Parth runs them. Claude may still run read-only git (status, diff, log).
- Documents and slides for his professor: simple, black and white, to the point.
