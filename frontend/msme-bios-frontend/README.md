# MSME-BIOS Frontend

The full MSME-BIOS product shell — landing page, auth, onboarding, plan selection, and the feature dashboard — with the document parser as the one fully working feature.

## Stack

React 19 + Vite + Tailwind CSS v4 (config lives in `src/index.css` via `@theme`/`@custom-variant`, not `tailwind.config.js`) + React Router + Framer Motion (for the custom plan builder's add/remove animations).

## Setup

```bash
npm install
npm run dev
```

## The flow

```
/                    Landing page (public) - hero, flip-cards, pricing, footer
/login, /signup       Demo auth - two distinct entry points, same fake session underneath
/business-setup       Asked once, before choosing a plan
/choose-plan            4 preset tiers + "Build your own"
/plan-summary/:tierId     Read-only summary for a chosen preset tier
/custom-plan               Interactive feature grid, animated running total
/dashboard                   Cards for whichever features are in the plan
/upload, /results              The working parser demo (unchanged from before)
```

Session, business profile, and plan all persist in `localStorage`. A returning logged-in user with a completed profile and plan skips straight to `/dashboard` (see `RequireOnboarded.jsx`).

## Design

Pure black-and-white, light/dark toggle. New this version: **Bricolage Grotesque** (headlines, real character) + **Plus Jakarta Sans** (body) + **IBM Plex Mono** (every extracted number and price, tied to the product's actual job).

## What's real vs. placeholder

**Real:** every navigation flow, the route guards, the custom builder's add/remove logic and price math, the theme system, **and now the document parsing itself** - `UploadPage.jsx` sends a real file to the real backend API and displays whatever it actually returns.

**Placeholder, clearly labeled:**
- Auth is fake (`AuthContext.jsx`) - no real backend.
- Feature prices (`lib/featuresData.js`) are illustrative, not real figures.
- Every dashboard card except "Document parser" is a real, styled, clickable button that intentionally does nothing - by design, so slotting in a real feature later means replacing one card's behavior, not restructuring the page.

## Running the full connected app

This frontend expects the backend API to be running at `VITE_API_URL` (see `.env`, defaults to `http://localhost:8000`).

```bash
# Terminal 1 - backend
cd backend/parser-backend
uvicorn api:app --reload --port 8000

# Terminal 2 - frontend
cd frontend/msme-bios-frontend
npm run dev
```

If the backend isn't running or a request fails, the upload page shows a real error message with a "Try again" button - not a silent failure.

## Extending the upload doc types later

`UploadPage.jsx`'s `docTypes` array is a flat list on purpose - adding Excel, GST, ITR, or business-rule file support later (parked for the backend phase, per instruction) is one more entry in that array, not a rewrite.

## Extending features later

`lib/featuresData.js` is the single source of truth for every feature shown on the landing page, the custom builder, and the dashboard. Adding a real feature later: add one entry here, then give its dashboard card real `onClick` behavior in `FeatureDashboardPage.jsx` - nothing else needs to change.
