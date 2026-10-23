# MSME-BIOS: Team Access, Payments and Data Separation (Final Spec)

Status: agreed with Parth, 21 Oct 2026. Build order and progress live in TRACKER.md.

## 1. Goal
Two levels of separation:
1. Business to business (Level 1): already built. tenant_id is derived on the server, never accepted from the client.
2. Profile to profile inside one business (Level 2): new. Department-scoped access, with the business owner seeing everything.

Rule of direction: Owner can see all departments. A department member sees only their own department. Never the reverse.

## 2. Decisions (locked)
| # | Decision |
|---|---|
| 1 | Five fixed roles: owner, finance, sales, hr, marketing. Custom roles are a later phase, so role checks must go through one function (not scattered if-statements) so it can later read from a table. |
| 2 | "Own profile only" means department-wide visibility. Every finance member sees all finance data. |
| 3 | Each tier includes a number of seats. Extra seats are priced separately and chosen BEFORE checkout. The invite step after payment fills those seats. |
| 4 | Members are added by email invite link only. The owner never sets another person's password. |
| 5 | Feature-to-role mapping in section 4 is accepted. |
| 6 | We build our own document database now. We do not wait for the teammate. |
| 7 | Real features and the real payment gateway (Razorpay) come AFTER this spec is complete. |

## 3. Roles and access rule
Effective access = (features in the plan the business bought) intersected with (features the role is allowed). The owner is allowed every feature, so owner access equals the plan.

| Role | Features | Data scope | Can manage team/billing/plan |
|---|---|---|---|
| owner | everything bought, plus business health index | all departments | yes |
| finance | document parser, cash dashboard, receivables & payables, P&L, aging reports, cash flow simulator, anomaly detection | finance | no |
| sales | invoice generator, revenue concentration, demand forecasting | sales | no |
| hr | document parser (HR documents, e.g. payroll) | hr | no |
| marketing | demand forecasting, revenue concentration, WhatsApp alerts | marketing | no |

Notes:
- HR and Marketing reuse existing features filtered by department. No new HR or Marketing modules in this phase.
- If a feature is not in the purchased plan, no role sees it, including the owner.
- Role to feature mapping lives in ONE backend module (single source of truth), mirrored for UI hiding only. The backend is the authority.

## 4. Seats and pricing (numbers are placeholders, to be confirmed)
Seats count all profiles including the owner.

| Tier | Seats included |
|---|---|
| Starter | 2 |
| Growth | 4 |
| Intelligence | 6 |
| Full suite | 10 |
| Custom plan | 2 |

- Extra seat: placeholder price per month, chosen on the plan page before checkout.
- Total price is computed on the SERVER from feature IDs + tier + extra seats. The browser never supplies a price.
- Seat limit is enforced on the server: pending invites plus active members cannot exceed seats purchased.

## 5. Payment flow
New onboarding order: signup, business details, choose features and seats, checkout, team setup, dashboard.

- Checkout talks to a provider interface: create_order, verify_payment, handle_webhook.
- Mock provider now (always-succeed and a deliberate-fail option so both paths can be demoed). Razorpay test mode later implements the same interface, so the flow does not change.
- A subscription row has a status: pending, active, failed. A plan counts as active ONLY when a payment is verified as paid.
- Until paid, a business cannot reach the dashboard or upload.

## 6. Team and invite flow
1. After payment, the owner lands on Team setup: choose a role and enter an email per seat (can skip and do later).
2. Server creates an invitation (random token, role, email, expiry 7 days, status pending) and produces an invite link. Email sending: real email service is a later item; until then the owner copies the link from the team page (flagged in UI).
3. Invitee opens the link, signs up or logs in with Firebase (email/password or Google). The email must match the invited email.
4. Accepting joins the invitee to the inviter's business with the invited role. They skip business setup and plan selection and land in their panel.
5. Owner can: revoke a pending invite, deactivate a member, change a member's role. Owner cannot be removed or deactivated.
6. v1 rule: one person belongs to one business. An invite to an email that already owns a business is rejected with a clear message.

Required change in existing code: tenant resolution must stop creating a new business for anyone who signs in. Invitees resolve to the inviter's tenant.

## 7. Data model changes
- user_tenants: add status (active/deactivated); role constrained to the five values.
- invitations: id, tenant_id, email, role, token_hash, status, invited_by, expires_at, accepted_at.
- subscriptions: id, tenant_id (unique), plan_id, seats_purchased, status, amount, provider, provider_order_id, paid_at.
- payments: id, tenant_id, subscription_id, amount, status, provider, provider_payment_id, created_at.
- plans: add seats_included, extra_seats.
- documents (and every parser table): add department and uploaded_by (user id). Existing tenant_id stays on every table.
- audit_log (optional, good for demo): tenant_id, user_id, action, target, at.
- Indexes on (tenant_id, department).
- Migration as schema/002_*.sql, applied to local first, then hosted DB.

## 8. Document persistence (our own, replaces waiting for teammate)
- On /api/parse success, save the ParserResult into the existing tables (documents, bank_transactions, invoices, invoice_line_items, handwritten_bills, handwritten_line_items) in ONE transaction.
- Each document is stamped with tenant_id (from server), uploaded_by (from token) and department (member: their own role's department; owner: chosen at upload).
- Money stays NUMERIC. needs_review and review_reason are stored.
- New read endpoints: list my documents, get one document. Both apply the department filter on the server.

## 9. Enforcement rules (backend, tested)
- One dependency resolves (user, tenant, role, status) from the verified token. Deactivated members are rejected.
- Endpoint guards: require_role(...) and require_feature(feature_id).
- Every query on tenant data filters by tenant_id; for non-owner roles also by department.
- Frontend hiding is cosmetic only.

Isolation tests to add (pytest, using a separate test database):
- Business A cannot read business B (existing, keep).
- Finance member cannot read HR documents in the same business.
- Owner can read all departments.
- Member cannot call team, billing or plan endpoints.
- Deactivated member gets 401/403.
- Seat limit blocks invite number seats+1.
- Invite token: wrong email, expired, reused, revoked all fail.
- Unpaid business is blocked from parse and dashboard.
- Client-supplied price, tenant_id or department is ignored.

## 10. Frontend changes
- Choose plan: seats shown per tier, extra seats stepper, total updates.
- Mock checkout page (success and failure paths), then Team setup page.
- Owner pages: Team (invite, revoke, deactivate, change role), Billing (read only for now).
- Invite acceptance page.
- DashboardLayout and FeatureDashboardPage become role-aware (menu and feature cards from the role mapping).
- Every new page ships with English, Hindi and Marathi from the start (new namespaces: team, billing, panels). Financial terms follow the existing transliteration rule.

## 11. Out of scope for this spec
- Real Razorpay integration, real invite emails, actual feature modules (cash dashboard etc.), custom roles, multiple businesses per person, owner transfer.
- Design for later: role logic centralised so custom roles can be added; seats and roles stored as data.
