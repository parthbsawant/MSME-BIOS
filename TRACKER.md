# MSME-BIOS Progress Tracker

Tick a box by changing `[ ]` to `[x]`. Order matters: finish a block before starting the next.
Spec: SPEC.md

## DONE so far
### Core platform
- [x] Three parsers (bank statement, invoice, handwritten) and shared pipeline
- [x] Parser unit tests (67 passing, 1 skipped)
- [x] FastAPI backend with endpoints: health, me, business, plan, parse
- [x] Firebase sign-in on frontend (email/password and Google)
- [x] Firebase token verification on backend (Admin SDK)
- [x] Level 1 isolation: tenant_id derived on server, never from client
- [x] PostgreSQL schema (11 tables) and tenant isolation tests
- [x] Business details and plan saved to database
- [x] Invoice parser vendor-name bug fixed
### Frontend
- [x] Full UI revamp, light and dark mode, logo
- [x] Landing page, MSME registration guide page
- [x] Onboarding flow: business setup, choose plan, custom builder, plan summary
- [x] Upload page, results page, feature dashboard (basic)
- [x] Playwright end-to-end tests (auth, business, plan, session isolation)
### Language support
- [x] i18n infrastructure (English, Hindi, Marathi, persistence, Devanagari font)
- [x] Translated: navbar, landing page
- [x] Translated: login, signup, business setup, choose plan, plan summary, custom builder
### Deployment and housekeeping
- [x] Backend deployed (Render, Docker), frontend deployed (Vercel), hosted PostgreSQL
- [x] Firebase configured for live domain
- [x] CLAUDE.md project context file
- [x] Milestone 2 presentation, MSME education page

---
## STEP 1: Language support, part 1
- [ ] Translate UploadPage (en, hi, mr)
- [ ] Translate ResultsPage
- [ ] Translate MSMEGuidePage
- [ ] Translate feature names, taglines, descriptions and tier names (new catalog namespace + useCatalog hook)
- [ ] Translate small components: AuthLoadingScreen, FeatureFlipCard, ThemeToggle labels, LanguageSwitcher label
- [ ] Translate DashboardLayout and FeatureDashboardPage (moved here from Step 5) and add language switcher inside the app
- [ ] Remaining user-facing error messages (upload errors now translated; server's own English message shown as a separate line)
- [ ] Test all three languages in light and dark mode on the live/local site, then commit

## STEP 2: Our own document database
- [x] Migration 002: department and uploaded_by on documents and parser tables, indexes (applied to dev and test)
- [x] Create separate test database (msme_bios_test) and point pytest at it (plus msme_bios_dev for laptops)
- [x] Save parser output to tables in one transaction (bank)
- [x] Save parser output (invoice)
- [x] Save parser output (handwritten)
- [x] Endpoints: list my documents, get one document
- [x] Tests: saved rows carry correct tenant_id, uploaded_by, department; failed save leaves nothing behind
- [x] Apply migration to hosted database, redeploy backend, verify live
- [x] Results page reads from saved documents

## STEP 3: Mock payments and seats
- [x] Migration 003: subscriptions, payments, seats on plans (applied to dev and test; legacy backfill)
- [x] Seat counts per tier and extra seat price in one shared config (backend pricing.py; featuresData.js mirror checked by tests/test_pricing.py)
- [x] Server-side price calculation (features + tier + extra seats); ignore client price
- [x] Payment provider interface (create_order, verify_payment, handle_webhook)
- [x] Mock provider with success and failure paths
- [x] Plan becomes active only after verified payment; unpaid businesses blocked from dashboard and upload
- [x] Frontend: seat selector on plan pages, total price
- [x] Frontend: mock checkout page (success and failure), payment status screen
- [x] Billing read-only page for owner
- [x] Tests for pricing, payment states, blocked unpaid access
- [x] i18n for new pages (billing namespace)
- [x] Deploy and verify live

## STEP 4: Roles and invitations (backend)
- [x] Migration 004: roles constrained to five values, status on user_tenants, invitations table (plus audit_log; applied to dev and test)
- [x] Central role-to-feature mapping module (single source of truth: roles.py)
- [x] Request dependency resolving user, tenant, role, status (access.py current_context)
- [x] require_role and require_feature guards (access.require_owner, access.feature_access)
- [x] Fix tenant resolution: invitees join inviter's business, no new tenant created
- [x] Endpoints: create invite, list invites, revoke invite, list members, change role, deactivate member (plus reactivate, audit log)
- [x] Endpoint: accept invite (token, email match, expiry, one-time use)
- [x] Seat limit enforced on invites
- [x] Department filter applied to document endpoints for non-owner roles
- [x] All isolation tests from SPEC section 9 passing (185 passed, 1 skipped)
- [ ] Deploy and verify live

## STEP 5: Team frontend and role-based panels
- [ ] Team setup page (after payment) with skip option
- [ ] Owner Team page (invite, copy link, revoke, deactivate, change role)
- [ ] Invite acceptance page (signup or login, then join)
- [ ] Route guards for member vs owner
- [ ] Role-aware DashboardLayout and menu
- [ ] Role-aware FeatureDashboardPage (cards from role mapping)
- [ ] Upload page: department chosen by owner, fixed for members
- [ ] Translate the new team, billing and panel screens (en, hi, mr); dashboard and layout were already translated in Step 1
- [ ] End-to-end test: owner creates finance and HR members; each sees only own data; owner sees all
- [ ] Demo walkthrough on live site with 3 accounts (owner, finance, HR)

## STEP 6: Wrap up this phase
- [ ] Update CLAUDE.md status and roadmap
- [ ] Update presentation (language support done, roles, payments, seats)
- [ ] Native-speaker review of Hindi and Marathi translations
- [ ] Confirm direnv works; remove leftover test accounts from database

---
## NEXT PHASE (after Steps 1 to 6)
- [ ] Real Razorpay integration (test mode, then live) behind the same provider interface
- [ ] Real invite emails (email service)
- [ ] Actual features, in this order to be decided: cash dashboard, invoice generator, receivables and payables, P&L, aging, anomaly detection, business health index, others
- [ ] Custom roles and role-specific features
- [ ] Enable Claude Vision for handwritten parser (once approved)
- [ ] Run the skipped Firebase token test with real credentials
