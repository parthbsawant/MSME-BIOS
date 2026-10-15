# MSME-BIOS

BE final-year project (owner: Parth Sawant). A multi-tenant business-intelligence platform for Indian MSMEs. Users upload bank statements, invoices and handwritten bills; parsers extract structured data; analytics and decision support come later. All data is synthetic. Repo: github.com/parthbsawant/MSME-BIOS

## Layout
MSME_BIOS/
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

## Run
- Backend: cd backend/parser-backend && source .venv/bin/activate && uvicorn api:app --reload --port 8000
- Frontend: cd frontend/msme-bios-frontend && npm run dev (port 5173)
- Tests: python3 -m pytest tests/ -v from backend/parser-backend. Expected: 67 passed, 1 skipped (the skip needs a real Firebase credential).
- Always activate .venv first. Bare python3 resolves to Homebrew Python, which has none of the packages. This has caused repeated confusion.
- Postgres 17 (Homebrew), database msme_bios, schema applied from schema/001_initial_schema.sql.

## Architecture rules (do not break)
- Auth: Firebase (email/password and Google) on the frontend. The frontend sends the ID token as Authorization: Bearer. The backend verifies it with the Firebase Admin SDK.
- tenant_id is NEVER accepted from the client. Server-side chain: verified Firebase UID -> users -> user_tenants -> tenants -> tenant_id -> pipeline.process(). Firebase UID and tenant_id are deliberately different concepts.
- Endpoints: GET /api/health (public), GET /api/me, POST /api/business, POST /api/plan, POST /api/parse (all require a valid token).
- Every tenant-owned table carries its own tenant_id column, not only a link to its parent.
- Parsers share one ParserResult contract. Do not rewrite parser logic without a proven need.
- Handwritten parser is local Tesseract only. A Claude Vision path exists but ENABLE_CLAUDE_VISION_* flags are false. Do not enable them.
- Parsed results are returned but not yet saved. The documents, bank_transactions, invoices, invoice_line_items, handwritten_bills, handwritten_line_items tables exist but are unused. A teammate is designing that persistence.

## Conventions and gotchas
- Python 3.9 compatibility: do not write `str | None` unless the file has `from __future__ import annotations`. Use Optional[str].
- Money is NUMERIC in Postgres, never float.
- Secrets: never commit .env, the Firebase service-account JSON (kept outside the repo, path in FIREBASE_SERVICE_ACCOUNT_PATH), or print .env values. .env lines must be KEY=value; a bare path line does nothing.
- Backend .env keys: DATABASE_URL, FIREBASE_SERVICE_ACCOUNT_PATH, FRONTEND_URL, ANTHROPIC_API_KEY (placeholder), ENABLE_CLAUDE_VISION_BANK|INVOICE|HANDWRITTEN. Frontend .env: VITE_API_URL and six VITE_FIREBASE_* keys.
- The pytest isolation tests currently write into the real msme_bios database (no separate test database yet). Their users use @test.com emails; clean them up or add msme_bios_test.
- UI work must not change logic in: AuthContext, lib/api.js, ProtectedRoute, RequireOnboarded, RedirectIfAuthenticated, BusinessContext, PlanContext. Business and plan are saved to the backend and also kept in UID-scoped localStorage, which still drives the route guards.
- In raw JSX text use HTML entities (&mdash;, &rsquo;), not — escapes (those only work inside JS strings).
- npm audit warnings come from Firebase's transitive dependencies. Do not run npm audit fix --force; it would downgrade Firebase.

## Design system
Warm palette. Light: page #FBF3EC, card white, text #2A2521, muted #8A7F74, accent #E8622C. Dark: page #1A1714, card #242019, text #F5EFE8, accent #F27A4A. Light and dark mode both required on every screen. Text selection colour is explicitly set (orange background). The logo (src/assets/logo.png) has near-black text on a transparent background, so it always sits on a white chip to stay legible in dark mode.

## Internationalisation (react-i18next)
- Languages: English, Hindi, Marathi. Files in src/locales/{en,hi,mr}/, one JSON per namespace; setup in src/lib/i18n.js; switcher in src/components/LanguageSwitcher.jsx.
- Language persists in localStorage key msme-language. <html lang> drives the Devanagari font (Noto Sans Devanagari) for Hindi and Marathi.
- Style rule: translate ordinary UI wording naturally; transliterate financial and technical terms phonetically into Devanagari (Invoice -> इनव्हॉइस, Dashboard -> डैशबोर्ड). Keep GST, GSTIN, PDF, MSME and similar in Latin letters.
- Dropdowns: the stored value stays English (backend consistency); only the displayed label is translated.
- Translations are an AI first pass and should get native-speaker review.
- DONE: infrastructure, Navbar, LandingPage (namespaces common, landing). Phase 2: LoginPage, SignupPage, BusinessSetupPage, ChoosePlanPage, PlanSummaryPage, CustomBuilderPage, PricingTierCard (namespaces auth, onboarding, plus common.plan). Auth pages now carry the LanguageSwitcher. Error state holds a translation key, rendered with t(error), so it re-translates on language switch.
- NOT DONE, in order: Phase 3 = dashboard, upload, results, DashboardLayout, tier and feature names in lib/featuresData.js. Phase 4 = MSMEGuidePage and remaining error messages.

## Status and roadmap
Done: three parsers and pipeline; FastAPI with Firebase-verified, tenant-scoped endpoints; Postgres schema and tenant isolation tests; real signup, login and Google sign-in; business and plan persistence; full UI revamp with logo; MSME registration guide page; Hindi and Marathi infrastructure, landing page, auth and onboarding pages; live deployment (backend on Render via Docker, frontend on Vercel, hosted Postgres, Firebase configured for the live domain).

Next, in this order:
1. Finish i18n Phases 3 and 4.
2. Persist parsed documents (teammate's database brief defines this).
3. Add a separate test database; set up direnv (.envrc with `source .venv/bin/activate`) if not already done.
4. Later: enable Claude Vision for the handwritten parser once approved (local Tesseract read only 4 of 10 items on a real bill); run the skipped Firebase-token test with real credentials; build the dashboard features that are currently "Coming soon" (cash dashboard, invoice generator, receivables and payables, anomaly detection, business health index).

## How to work with Parth
- Step by step. Say what you will change and why before changing it. Keep changes small.
- Run the tests or the build before saying something works. Do not assume a command succeeded.
- Give exact commands and say where each file goes. When he pastes output, answer PASS or FAIL, what it means, and the next step.
- Never ask for passwords or keys. Explain how to configure them without pasting them.
- Commit after verified milestones with short messages; check git status and git diff first.
- Documents and slides for his professor: simple, black and white, to the point.
