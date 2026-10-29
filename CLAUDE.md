# MSME-BIOS

BE final-year project (owner: Parth Sawant). A multi-tenant business-intelligence platform for Indian MSMEs. Users upload bank statements, invoices and handwritten bills; parsers extract structured data; analytics and decision support come later. All data is synthetic (demo business: "Mauli Traders"). Repo: github.com/parthbsawant/MSME-BIOS

READ FIRST: SPEC.md (final agreed design) and TRACKER.md (tick-box build order) in the repo root.

## Layout
MSME-BIOS/
  SPEC.md  TRACKER.md  SETUP.md  CLAUDE.md  .gitattributes
  MSME-BIOS_Test_Plan_Tester1.pdf   MSME-BIOS_Test_Plan_Tester2.pdf
  docs/
    ui-theme-f1/                 V2 F1 Theme screenshots (Phases 1-5, 360px-1536px, light/dark, en/hi/mr)
    ui-revamp/                   Phase 1-5 UI overhaul capture archive
  backend/parser-backend/        Python: FastAPI, parsers, Postgres schema
    api.py                       endpoints (see Architecture)
    pipeline.py                  single parser entry point: process(file_path, tenant_id, document_type)
    firebase_auth.py             verifies Firebase ID tokens (Admin SDK)
    tenant_resolution.py         Firebase UID -> user -> tenant_id / membership resolution
    access.py                    request dependency resolving user, tenant, role, status & guards
    roles.py                     single source of truth for role permissions, departments, effective features
    pricing.py                   server-side quote calculation for base tiers, features, extra seats
    team.py                      team management, invitations, seat limits, member status, audit logs
    document_store.py            transactional document and line items persistence with department scoping
    subscriptions.py             database layer for subscriptions & payments
    payments/                    provider interface (provider.py) & mock provider (mock_provider.py)
    db_pool.py                   Postgres connection pool for app tables
    bank_parser/ invoice_parser/ handwritten_parser/
    msme_bios_shared/            base models, config, claude_client, db.py (parser staging)
    schema/                      001_initial_schema.sql, 002_document_storage.sql, 003_subscriptions_payments.sql, 004_roles_and_invitations.sql
    scripts/apply_schema.py      schema migration runner
    tests/                       185 tests (unit, integration, tenant/department isolation)
  frontend/msme-bios-frontend/   React 19 + Vite 8 + Tailwind v4 + react-router 7 + framer-motion
    src/pages                    Landing, Auth (Login, Signup, AcceptInvite), MSMEGuide, Onboarding (BusinessSetup, ChoosePlan, CustomBuilder, PlanSummary), Dashboard (FeatureDashboard), Upload, Results, Team, Billing
    src/components               Logo (dynamic SVG Rupee-Rise), DashboardLayout, Navbar, FeatureFlipCard, PricingTierCard, SeatStepper, OnboardingProgress, ThemeToggle, LanguageSwitcher, AccessStatusScreen, AuthLoadingScreen
    src/components/ui            UI primitives: Button, Card, Badge, Input, Modal, Skeleton, Stat, index.js
    src/context                  AuthContext, BusinessContext, PlanContext
    src/lib                      motion (spring physics), i18n, api, useCatalog, featuresData, googleAuthError, nextPath
    src/locales                  en, hi, mr translations
    scripts/                     Playwright capture and verification scripts (capture_phase1-5.js, verify_bento_hover.js)

## Deployment (live)
- Backend: Render (Docker, Python 3.12, free tier sleeps; first request can take about a minute). Health check /api/health.
- Frontend: Vercel (https://msme-bios.vercel.app).
- Database: Neon Postgres (production).
- Render env FRONTEND_URL is a comma-separated CORS allowlist (Vercel URL plus http://localhost:5173).
- DATABASE_URL must start exactly with postgresql:// (no "psql '" prefix, no quotes, no spaces) or psycopg2 fails to parse it.
- A 500 from the backend carries no CORS headers, so the browser reports it as a CORS error. Check the real status first.
- Firebase Authorized domains must contain BOTH msme-bios.vercel.app and localhost.

## Run (Windows PowerShell is the current machine; Mac also used)
- Backend: cd backend\parser-backend; .venv\Scripts\Activate.ps1; uvicorn api:app --reload --port 8000   (Mac: source .venv/bin/activate)
- Frontend: cd frontend\msme-bios-frontend; npm run dev (port 5173). Never run npm from the repo root.
- PowerShell: chain with ; not &&. curl is an alias, use curl.exe.
- Always activate .venv first.
- Tesseract OCR binary must be installed locally for the handwritten parser (installed on Windows at C:\Program Files\Tesseract-OCR, on PATH).
- Tests: python -m pytest tests/ -q from backend/parser-backend (expected 185 passed, 1 skipped; about 16 minutes because the test DB is remote - run it in the background).
- Roles: roles.py is the only place role rules live (department_for, allowed_features, effective_features = plan ∩ role, can_manage_business, is_member_role). Never write `if role == ...` in endpoints.
- Prices: backend/parser-backend/pricing.py is the only authority (quote()). featuresData.js mirrors it for display; tests/test_pricing.py fails if they differ, so change both together.
- Test DB: tests/conftest.py points every test at TEST_DATABASE_URL (Neon msme_bios_test); tests marked `pytestmark = pytest.mark.db` are SKIPPED if it is missing, unreachable, equal to DATABASE_URL, or its database name lacks "test". Test users use @test.com emails.
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
- GET /api/documents = caller's business's documents, newest first, summaries (item_count, total). GET /api/documents/{id} = one document in the same JSON shape /api/parse returns; another business's id (or a malformed id) gives 404, never 403. All document reads go through document_store._scope(tenant_id, department); department=None (owner) today, non-owners pass member's department. Child rows are ordered by line_no.
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
- UI logic files to touch only deliberately: AuthContext, lib/api.js, ProtectedRoute, RequireOnboarded, RequireOwner, RedirectIfAuthenticated, BusinessContext, PlanContext.
- Frontend roles (Step 5): BusinessContext also exposes role, department, effectiveFeatures, invitePending, isOwner, deactivated, refreshBusiness (from /api/me; cached as msme-access-<uid>; old caches without it wait for the backend once). RequireOwner wraps business setup, plan pages, checkout, billing, team (members -> /dashboard). RequireOnboarded/RequireOwner show AccessStatusScreen for deactivated and invitePending. Sidebar items carry ownerOnly / feature flags. /invite/:token = AcceptInvitePage (public). Login/signup accept ?next= but only /invite/... paths (lib/nextPath.js, prevents open redirects). Namespace: team (roles, team page, invite page, status screens, department).
- In raw JSX text use HTML entities (&mdash;, &rsquo;), not unicode escapes.
- Do not run npm audit fix --force (would downgrade Firebase).
- Neon free compute autosuspends; first query can be slow.

## Design system (V2 F1 Theme)
Modern, high-performance Fintech design system (Cobalt & Saffron):
- Palette (Light mode): Canvas `--color-canvas: #F7F9FC`, Surface/Card `--color-surface: #FFFFFF`, Secondary Surface `#EEF2F9`, Border `--color-line: #E1E7F0`, Ink/Text `--color-ink: #0D1526`, Muted `--color-muted: #5A667A`.
- Palette (Dark mode): Canvas `--color-canvas: #0E1116`, Surface/Card `--color-surface: #151A21`, Secondary Surface `#1C222B`, Border `--color-line: #272F3A`, Ink/Text `--color-ink: #ECEFF4`, Muted `--color-muted: #98A2B3`.
- Brand Accent: Primary Cobalt `--color-accent: #2F5BFF` (hover `#224ADB`, soft `#E9F0FF` / dark `#6C8CFF`), Saffron Highlight `--color-highlight: #FF8A1F` (used strictly for focal items and brand marks).
- Department Accents: Finance `#1E9E6E`, Sales `#2F6FDE`, HR `#8A5CD6`, Marketing `#E0457B`.
- Semantic Status: Success `#12A06B` (dark `#34D399`), Warning `#B7791F` (dark `#FBBF24`), Danger `#D92D20` (dark `#F87171`).
- Logo ("Rupee Rise"): Scalable vector SVG (`Logo.jsx` and `favicon.svg`) reactive to CSS variables (`--logo-square`, `--logo-glyph`, `--logo-dot`). Replaces old raster PNG; eliminates white-chip requirements and renders crisp on all viewports in both light and dark modes.
- UI Primitives: Reusable tokenized primitives in `src/components/ui/` (`Button`, `Card`, `Badge`, `Input`, `Modal`, `Skeleton`, `Stat`).
- Motion System: Framer-motion spring physics in `src/lib/motion.js` (`staggerContainer`, `fadeUp`, `scaleIn`, `slideIn`, `cardHover`, `springTransition`, reduced-motion safe).
- Typography: `Inter Tight` (headings), `Inter` (body), `Noto Sans Devanagari` (Hindi and Marathi). Audited from 360px mobile to 1536px desktop.

## Internationalisation (react-i18next)
- Languages: English, Hindi, Marathi. Files in `src/locales/{en,hi,mr}/`, one JSON per namespace (`common`, `landing`, `auth`, `onboarding`, `catalog`, `upload`, `results`, `guide`, `dashboard`, `team`, `billing`). Setup in `src/lib/i18n.js`; switcher `LanguageSwitcher.jsx`; language stored in localStorage key `msme-language`; `<html lang>` drives Noto Sans Devanagari.
- Style: translate ordinary UI wording naturally; transliterate financial/technical terms phonetically (Invoice -> इनव्हॉइस). Keep GST, GSTIN, PDF, MSME, OCR in Latin.
- Dropdown stored values stay English; only labels translated.
- `useCatalog()` (`src/lib/useCatalog.js`) translates feature and tier names/taglines, falling back to `featuresData.js`.
- All screens across Steps 1 to 5 translated in all three languages and verified. Native-speaker polish scheduled in Step 6.

## Product decisions (locked, details in SPEC.md)
- Two levels of separation: (1) business to business (done); (2) inside one business, department access. Owner sees everything; department users see only their department, never the reverse.
- Five fixed roles: owner, finance, sales, hr, marketing. Keep role logic centralised so custom roles can be added later.
- Department-wide visibility (a Finance user sees all Finance data of that business).
- Seats per tier: Starter 2, Growth 4, Intelligence 6, Full suite 10, Custom 2. Extra-seat price is Rs 499 per seat per month (placeholder; at most 20 extra seats). Seat count is chosen BEFORE checkout.
- Invite by link only. Owner copies the link until a real email service exists.
- Feature to role: Finance = document parser, cash dashboard, receivables and payables, P&L, aging, cash flow simulator, anomaly detection. Sales = invoice generator, revenue concentration, demand forecasting. HR = document parser limited to HR documents. Marketing = demand forecasting, revenue concentration, WhatsApp alerts. Owner = everything bought plus business health index, team, billing.
- Effective access = plan features intersect role features.
- Payments: mock provider behind create_order / verify_payment / handle_webhook. Price computed server-side. Plan active only after verified payment. Real Razorpay later.
- Step 4 decisions (2026-10-26): accepting an invite does NOT require a verified email for now (secret link + email match; known limitation, add Firebase email verification next phase). If an invitee already has their own business that is EMPTY (no business details, plan, subscription or documents), it is deleted when they accept and they join the inviter; a business with any data is never deleted and the invite is rejected. An audit_log records team actions (invite, revoke, role change, deactivate/reactivate, join).
- Step 3 decisions (2026-10-26): extra seat = Rs 499 per seat per month (placeholder); at most 20 extra seats; accounts that had a plan before Step 3 get an active subscription with provider 'legacy' (migration 003), so nobody is locked out; new signups must pay.
- Build our own document database now (not waiting for the teammate's design).
- Department at upload: departments are finance, sales, hr, marketing ("owner" is a role, not a department). Backend accepts optional department from the owner and defaults to finance; members are strictly locked to their own department.

## Status

CURRENT POSITION (2026-10-29):
- **Core Platform & Backend**:
  - Three parsers (bank statement, invoice, handwritten with local Tesseract) and single pipeline entry point (`pipeline.py`).
  - FastAPI backend with Firebase-verified token endpoints, server-side tenant resolution, and Postgres connection pooling.
  - Migrations 001, 002, 003, and 004 applied to dev, test, and production (Neon Postgres).
  - Own transactional document storage (documents, bank transactions, invoices, handwritten bills) scoped by tenant and department.
  - Server-side pricing engine (`pricing.py`) and mock payment checkout flow (`payments/`, `subscriptions.py`).
  - Roles, permissions, access guards (`access.py`, `roles.py`), and team workspace logic (`team.py`) with 185 backend isolation tests passing (1 skipped).
- **Frontend & Workspaces (Steps 1 to 5 Complete)**:
  - Full i18n support in English, Hindi, and Marathi across all screens and components (Step 1).
  - Document viewing and reloadable results at `/results/:documentId` with real document counts on dashboard (Step 2).
  - Plan selection, custom plan builder, seat stepper, mock checkout, and billing portal (Step 3).
  - Team management, link-based invitations, role-based permissions, and invite acceptance (Steps 4 & 5).
  - Role-aware sidebar, menus, feature dashboard widgets, and department-locked document uploads (Step 5).
- **Frontend UI Revamp V2 (F1 Theme)**:
  - Phase 1: Design tokens, Cobalt & Saffron palette, typography, motion system (`motion.js`), UI primitives (`Button`, `Card`, `Badge`, `Input`, `Modal`, `Skeleton`, `Stat`).
  - Phase 2: Modernized public landing page (interactive Bento grid with hover reveal, hero animation), MSME Guide page, Auth pages (Login/Signup).
  - Phase 3: Modernized onboarding and payments (Business setup, plan selection, custom builder, plan summary, checkout with seat stepper, billing).
  - Phase 4: App shell redesign (Dark sidebar layout, role-aware FeatureDashboardPage, results viewer with tabs, upload page with department selector, team management).
  - Phase 5: Responsive audit & Indic typography polish across 6 viewport breakpoints (360px, 390px, 768px, 1024px, 1280px, 1536px), dark & light mode, 3 languages.
  - Automated Playwright screenshot capture suite (`capture_phase1-5.js`, `verify_bento_hover.js`) in `docs/ui-theme-f1/` and `docs/ui-revamp/`.
  - Logo Modernization: Pure vector SVG "Rupee Rise" mark (`Logo.jsx`, `favicon.svg`, PWA icon set) with CSS variable reactivity (`--logo-square`, `--logo-glyph`, `--logo-dot`).
  - Evaluator Test Plans: Two formal test plans produced (`MSME-BIOS_Test_Plan_Tester1.pdf` & `MSME-BIOS_Test_Plan_Tester2.pdf`).

FIXED ISSUES:
- Logo chip narrow width rendering issue: Fixed with vector SVG component `Logo.jsx` and dynamic CSS custom properties.
- Bento grid hover effect issue: Fixed in commit 5a1da1f (`FeatureFlipCard.jsx`, `LandingPage.jsx`).
- Google sign-in auth/unauthorized-domain: Added `msme-bios.vercel.app` and `localhost` to Firebase Authorized Domains; error codes mapped in en/hi/mr.
- F5 refresh redirect on guarded pages: Fixed via `loadedFor` tracking in BusinessContext and PlanContext.

OPEN NOTES:
- UI text still says "AI vision" for handwritten parser (local Tesseract); wording can be adjusted to "Intelligent OCR" if desired.
- Dashboard stat-card metrics for sales, expenses, and profit are mock numbers; document count is real and live from `/api/documents`.
- 3-account live-site demo walkthrough ready on msme-bios.vercel.app for final presentation.

## Build order
1. DONE. Language support part 1 (i18n infrastructure, en/hi/mr, Noto Sans Devanagari, catalog translations).
2. DONE. Own document database: migration 002, transactional multi-table persistence, list/get endpoints, reloadable results page.
3. DONE. Mock payments and seats: migration 003, server-side pricing, seat stepper, mock checkout, billing page, paywall.
4. DONE. Roles and invitations backend: migration 004, roles.py, access guards, team endpoints, 185 tests.
5. DONE. Team frontend and role-based panels: team setup, invite acceptance, role-aware menus/dashboards, department isolation, 3-account testing.
6. DONE. Frontend UI Revamp V2: Phases 1 to 5 (Tokens, Public pages, Onboarding/Payments, App shell & Dashboard, Responsive audit & Indic typography, Playwright test suite, SVG Logo modernization, Test Plan PDFs).
7. NEXT (Step 6 Wrap-up): Update presentation slides (language support, roles, payments, seats, UI revamp), native-speaker review of Hindi/Marathi, Mac direnv check, cleanup leftover test accounts.

NEXT PHASE (after Wrap-up):
- Real Razorpay integration (test mode, then live) behind the same payment provider interface.
- Real invite emails (email delivery service).
- Actual dashboard feature implementations: cash dashboard, invoice generator, receivables/payables, P&L, aging, anomaly detection, business health index.
- Custom roles and role-specific permissions.
- Enable Claude Vision for handwritten parser (local Tesseract OCR reads only clean text).
- Run skipped Firebase-token test with live credentials.

## How to work with Parth
- Step by step. Say what you will change and why before changing it. Keep changes small. Move fast, ship fast.
- Run tests or the build before saying something works. Do not assume a command succeeded.
- Give exact commands and say where each file goes. When he pastes output, answer PASS or FAIL, what it means, and the next step.
- Never ask for passwords or keys.
- Git (from 2026-10-26): Claude does NOT run git add, commit or push. When work is verified and ready, Claude tells Parth it is time to push and gives the exact commands (git status, git add <files>, git commit -m "...", git push); Parth runs them. Claude may still run read-only git (status, diff, log).
- Documents and slides for his professor: simple, black and white, to the point.
