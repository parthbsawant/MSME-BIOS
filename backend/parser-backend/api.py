"""
api.py — Exposes pipeline.process() over HTTP, plus the authenticated,
multi-tenant application endpoints built in Milestone 2: identity,
business persistence, and plan persistence.

Run with:
    uvicorn api:app --reload --port 8000

MILESTONE 2: every endpoint below that touches tenant-owned data now
requires a real, verified Firebase ID token (Depends(verify_firebase_token)).
/api/parse no longer accepts a client-supplied tenant_id at all - the
tenant_id it uses is resolved server-side from the verified token, via
tenant_resolution.py. The parser itself (pipeline.process) is unchanged;
only where tenant_id comes from has changed.
"""

import os
import tempfile

from fastapi import Depends, FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from pipeline import process, DocumentType
from msme_bios_shared import config
from firebase_auth import verify_firebase_token
from db_pool import get_connection
import tenant_resolution as tr

app = FastAPI(title="MSME-BIOS Parser API")

# Without this, a browser blocks every request from the frontend (a
# different origin: localhost:5173 vs this server's localhost:8000) even
# though curl - which doesn't enforce CORS at all - has worked fine this
# whole time. FRONTEND_URL is read from .env so this doesn't need code
# changes between local dev and a real deployed frontend later.
# Accepts a comma-separated list, so a deployed frontend and local dev
# can both be allowed at once.
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
ALLOWED_ORIGINS = [o.strip().rstrip("/") for o in FRONTEND_URL.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _resolve_tenant(decoded_token: dict) -> str:
    """
    Shared by every endpoint below that needs a tenant_id. Takes the
    ALREADY-VERIFIED token from verify_firebase_token and resolves it to
    a tenant_id via the database - this is the only path by which any
    endpoint here ever learns a tenant_id. No endpoint accepts one as a
    request parameter.
    """
    conn = get_connection()
    try:
        return tr.resolve_tenant_id(
            conn,
            firebase_uid=decoded_token["uid"],
            email=decoded_token.get("email", ""),
            display_name=decoded_token.get("name"),
        )
    finally:
        conn.close()


@app.get("/api/health")
async def health_check():
    """
    Lets the frontend confirm the backend is actually reachable before
    attempting an upload - and reports which AI vision paths are
    currently enabled. Deliberately NOT behind authentication - a health
    check that itself requires a valid session isn't useful for the one
    case it matters most (figuring out why login/auth might be failing).
    """
    return {
        "status": "ok",
        "service": "msme-bios-parser-api",
        "parsers_available": ["bank_statement", "invoice_bill", "photo_bill"],
        "ai_vision_enabled": {
            "bank_statement": config.ENABLE_CLAUDE_VISION_BANK,
            "invoice_bill": config.ENABLE_CLAUDE_VISION_INVOICE,
            "photo_bill": config.ENABLE_CLAUDE_VISION_HANDWRITTEN,
        },
    }


@app.get("/api/me")
async def get_me(decoded_token: dict = Depends(verify_firebase_token)):
    """
    The authenticated identity endpoint (Milestone 2 Phase 4). Valid
    token -> 200 with the resolved user/tenant context. Missing or
    invalid token -> 401, raised by verify_firebase_token before this
    function body ever runs.
    """
    tenant_id = _resolve_tenant(decoded_token)
    return {
        "firebase_uid": decoded_token["uid"],
        "email": decoded_token.get("email"),
        "tenant_id": tenant_id,
    }


@app.post("/api/business")
async def save_business(
    business_name: str = Form(...),
    owner_name: str = Form(...),
    business_type: str = Form(default=None),
    annual_turnover: str = Form(default=None),
    city: str = Form(default=None),
    gstin: str = Form(default=None),
    decoded_token: dict = Depends(verify_firebase_token),
):
    """
    Persists the business profile against the CALLER'S OWN resolved
    tenant - there is no tenant_id form field here at all, so there is
    nothing for a client to override even if it tried.
    """
    tenant_id = _resolve_tenant(decoded_token)
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO businesses (tenant_id, business_name, owner_name, business_type, annual_turnover, city, gstin)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (tenant_id) DO UPDATE SET
                    business_name = EXCLUDED.business_name,
                    owner_name = EXCLUDED.owner_name,
                    business_type = EXCLUDED.business_type,
                    annual_turnover = EXCLUDED.annual_turnover,
                    city = EXCLUDED.city,
                    gstin = EXCLUDED.gstin,
                    updated_at = now()
                """,
                (tenant_id, business_name, owner_name, business_type, annual_turnover, city, gstin),
            )
            conn.commit()
        return {"status": "ok", "tenant_id": tenant_id}
    finally:
        conn.close()


@app.post("/api/plan")
async def save_plan(
    plan_type: str = Form(...),
    tier_id: str = Form(default=None),
    feature_ids: str = Form(...),  # comma-separated - see frontend api.js for how this is built
    price: float = Form(...),
    decoded_token: dict = Depends(verify_firebase_token),
):
    """
    Persists the plan selection against the caller's own resolved
    tenant. Same principle as /api/business - no tenant_id field exists
    for a client to supply.
    """
    if plan_type not in ("tier", "custom"):
        return JSONResponse(status_code=400, content={"error": "bad_request", "message": "plan_type must be 'tier' or 'custom'"})

    tenant_id = _resolve_tenant(decoded_token)
    feature_id_list = [f.strip() for f in feature_ids.split(",") if f.strip()]

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO plans (tenant_id, plan_type, tier_id, feature_ids, price)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (tenant_id) DO UPDATE SET
                    plan_type = EXCLUDED.plan_type,
                    tier_id = EXCLUDED.tier_id,
                    feature_ids = EXCLUDED.feature_ids,
                    price = EXCLUDED.price,
                    updated_at = now()
                """,
                (tenant_id, plan_type, tier_id, feature_id_list, price),
            )
            conn.commit()
        return {"status": "ok", "tenant_id": tenant_id}
    finally:
        conn.close()


@app.post("/api/parse")
async def parse_document(
    file: UploadFile = File(...),
    document_type: str = Form(...),
    decoded_token: dict = Depends(verify_firebase_token),
):
    """
    Accepts a document upload and returns the parsed result as JSON.
    MILESTONE 2 CHANGE: tenant_id is no longer a form field a client can
    supply - it's resolved server-side from the verified token, exactly
    like every other endpoint above. The parser call itself
    (pipeline.process) is completely unchanged.
    """
    tenant_id = _resolve_tenant(decoded_token)

    suffix = os.path.splitext(file.filename or "")[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        contents = await file.read()
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        result = process(tmp_path, tenant_id=tenant_id, document_type=document_type)
        return result.model_dump(mode="json")

    except NotImplementedError as e:
        return JSONResponse(
            status_code=501,
            content={"error": "ai_vision_not_enabled", "message": str(e)},
        )

    except (ValueError, FileNotFoundError) as e:
        return JSONResponse(
            status_code=400,
            content={"error": "bad_request", "message": str(e)},
        )

    except Exception as e:
        # A genuinely malformed or corrupted file can raise exception
        # types specific to whichever library tried to open it (e.g.
        # pdfplumber's PdfminerException on a file that isn't really a
        # PDF at all) - none of which the caller should ever see as a
        # raw, unhandled 500. Found via testing with a deliberately
        # invalid file, not something already broken in production.
        return JSONResponse(
            status_code=400,
            content={"error": "bad_request", "message": f"Could not process this file: {e}"},
        )

    finally:
        os.unlink(tmp_path)
