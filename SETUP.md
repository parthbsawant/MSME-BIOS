# MSME-BIOS: Working on Two Computers (Mac and Windows)

Goal: clone on any machine, follow this page, be working in about 20 minutes, with nothing lost when switching.

## 1. What travels through GitHub, and what does not
| Travels via git (automatic) | Does NOT travel (set up once per machine) |
|---|---|
| All code, locale JSONs, docs, CLAUDE.md, SPEC.md, TRACKER.md | `.env` files (backend and frontend) |
| `.env.example` files (names only, no values) | Firebase service-account JSON file |
| | `node_modules/` and `.venv/` (rebuilt per machine) |
| | Tesseract install (needed only for the handwritten parser) |

Rule: never commit secrets. Keep the real values in a password manager (secure note) so either machine can copy them.

## 2. One database both machines share
Do not use a Postgres that lives only on one computer. Use a hosted DEV database (separate from the production one the live site uses), and put its URL in each machine's backend `.env`. Then the data, schema changes and test accounts are the same on Mac and Windows.
- Production DB: used only by the live Render backend.
- Dev DB: used by both laptops for local backend work.
- Test DB (added in Step 2): used only by pytest.

Frontend-only work needs no database: set `VITE_API_URL` to the live backend URL.

## 3. Setup on a new machine

### 3a. Install once
- Git, Node.js (LTS), Python 3.9 or newer (3.11/3.12 fine), VS Code.
- Windows: install Python from python.org and tick "Add python to PATH".
- For the handwritten parser only: Tesseract OCR.
  - Windows: install the UB Mannheim build, add its folder to PATH, check with `tesseract --version`.
  - Mac: `brew install tesseract`.

### 3b. Clone
```
git clone https://github.com/parthbsawant/MSME-BIOS.git
cd MSME-BIOS
```

### 3c. Frontend
```
cd frontend/msme-bios-frontend
npm install
```
Create `frontend/msme-bios-frontend/.env` by copying `.env.example` and filling the values (Firebase values: Firebase console, Project settings, Your apps, Web app config). Then `npm run dev` and open http://localhost:5173.

### 3d. Backend
Windows (PowerShell):
```
cd backend\parser-backend
py -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```
If activation is blocked, run once: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

Mac:
```
cd backend/parser-backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```
Create `backend/parser-backend/.env` from `.env.example`:
- `DATABASE_URL` = the DEV database URL, `msme_bios_dev` (never the production one).
- `TEST_DATABASE_URL` = the TEST database URL, `msme_bios_test` (used only by pytest).
- `FIREBASE_SERVICE_ACCOUNT_PATH` = full path to the service-account JSON kept OUTSIDE the repo. Use forward slashes on Windows, for example `E:/Parth/secrets/firebase-adminsdk.json`. The line must be `KEY=value`.
- `FRONTEND_URL=http://localhost:5173`

Service-account JSON: download a new key from Firebase console, Project settings, Service accounts. Each machine can have its own key.

Run backend: `uvicorn api:app --reload --port 8000`
Run tests: `python -m pytest tests/ -v`
Expected on a machine with Tesseract: 86 passed, 1 skipped. Without Tesseract the handwritten tests fail; that is expected, not a bug. Database tests always use `TEST_DATABASE_URL`; without it they are skipped, never run against dev or production.

## 4. Switching machines: the daily routine
Start of session: `git pull`
End of session: `git add -A`, `git commit -m "..."`, `git push`
Never stop for the day with uncommitted work. If something is half-done, commit it on a branch (`git switch -c wip/short-name`) and push the branch.

## 5. Line endings
The repo has a `.gitattributes` that forces LF line endings so Windows and Mac do not show every file as changed.

## 6. Claude Code on each machine
Claude Code reads `CLAUDE.md`, so both machines start with the same context. After each finished step, update the status in `CLAUDE.md` and `TRACKER.md`, commit and push, so the other machine gets it on `git pull`.
