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
import uuid

from fastapi import Depends, FastAPI, File, Form, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from pipeline import process, DocumentType
from msme_bios_shared import config
from firebase_auth import verify_firebase_token
from db_pool import get_connection
import tenant_resolution as tr
import document_store as ds
import payments
import pricing
import subscriptions as subs

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


def _resolve_user_and_tenant(decoded_token: dict):
    """Like _resolve_tenant(), but also returns the user's id, for rows
    that record who did something (documents.uploaded_by)."""
    conn = get_connection()
    try:
        return tr.resolve_user_and_tenant(
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
    The authenticated identity endpoint. Valid token -> 200 with the
    resolved user/tenant context. Missing or invalid token -> 401,
    raised by verify_firebase_token before this function body ever runs.

    Also returns this tenant's saved business profile and plan (or null
    for each if not saved yet). This is what lets the frontend know
    whether onboarding is already finished on ANY browser or device -
    previously that was only remembered in one browser's localStorage,
    so a new browser sent fully-registered users back to the form.
    Both lookups are keyed by the server-resolved tenant_id only.
    """
    tenant_id = _resolve_tenant(decoded_token)

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT business_name, owner_name, business_type,
                       annual_turnover, city, gstin
                FROM businesses WHERE tenant_id = %s
                """,
                (tenant_id,),
            )
            business = cur.fetchone()

            cur.execute(
                """
                SELECT plan_type, tier_id, feature_ids, price, seats_included, extra_seats
                FROM plans WHERE tenant_id = %s
                """,
                (tenant_id,),
            )
            plan = cur.fetchone()
        subscription = subs.get_subscription(conn, tenant_id)
    finally:
        conn.close()

    if plan is not None:
        plan = {
            "plan_type": plan["plan_type"],
            "tier_id": plan["tier_id"],
            "feature_ids": list(plan["feature_ids"] or []),
            "price": float(plan["price"]),
            "seats_included": plan["seats_included"],
            "extra_seats": plan["extra_seats"],
        }

    # STEP 3: the frontend sends a user with a plan but no active
    # subscription to checkout, not to the dashboard.
    if subscription is not None:
        subscription = {
            "status": subscription["status"],
            "seats_purchased": subscription["seats_purchased"],
            "amount": float(subscription["amount"]),
            "provider": subscription["provider"],
            "order_id": subscription["provider_order_id"],
            "paid_at": subscription["paid_at"].isoformat() if subscription["paid_at"] else None,
        }

    return {
        "firebase_uid": decoded_token["uid"],
        "email": decoded_token.get("email"),
        "tenant_id": tenant_id,
        "business": dict(business) if business is not None else None,
        "plan": plan,
        "subscription": subscription,
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
    feature_ids: str = Form(default=""),  # comma-separated - see frontend api.js for how this is built
    price: str = Form(default=None),  # IGNORED since Step 3 - kept so older clients don't get a 422
    decoded_token: dict = Depends(verify_firebase_token),
):
    """
    Persists the plan selection against the caller's own resolved
    tenant. Same principle as /api/business - no tenant_id field exists
    for a client to supply.

    STEP 3: the price (and, for a tier, the feature list) is computed by
    pricing.quote(); whatever price the client sends is ignored. This
    endpoint never activates anything - only a verified payment via
    /api/checkout does. Kept for the pre-checkout frontend.
    """
    tenant_id = _resolve_tenant(decoded_token)
    try:
        q = pricing.quote(plan_type, tier_id, _split_ids(feature_ids), 0)
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": "bad_request", "message": str(e)})

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            subs.save_plan(cur, tenant_id, q)
        conn.commit()
        return {"status": "ok", "tenant_id": tenant_id}
    finally:
        conn.close()


def _has_active_plan(tenant_id: str) -> bool:
    """STEP 3 paywall: uploads and documents need an active subscription
    (a verified payment, or a pre-Step-3 'legacy' account)."""
    conn = get_connection()
    try:
        return subs.is_active(conn, tenant_id)
    finally:
        conn.close()


def _split_ids(feature_ids: str):
    return [f.strip() for f in (feature_ids or "").split(",") if f.strip()]


def _payment_required():
    return JSONResponse(
        status_code=402,
        content={"error": "payment_required", "message": "This business has no active plan. Complete checkout first."},
    )


@app.post("/api/checkout/order")
async def checkout_order(
    plan_type: str = Form(...),
    tier_id: str = Form(default=None),
    feature_ids: str = Form(default=""),
    extra_seats: int = Form(default=0),
    decoded_token: dict = Depends(verify_firebase_token),
):
    """
    STEP 3: starts checkout. The client sends only WHAT it chose; the
    server computes the amount (pricing.quote), saves the plan and a
    PENDING subscription, and creates a provider order. Any price,
    amount or tenant_id field the client adds is ignored. 409 if the
    business already has an active plan (upgrades are a later step).
    """
    tenant_id = _resolve_tenant(decoded_token)
    try:
        q = pricing.quote(plan_type, tier_id, _split_ids(feature_ids), extra_seats)
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": "bad_request", "message": str(e)})

    provider = payments.get_provider()
    conn = get_connection()
    try:
        order = subs.start_checkout(conn, tenant_id, q, provider)
    except subs.AlreadyActive:
        return JSONResponse(status_code=409, content={"error": "already_active", "message": "This business already has an active plan."})
    finally:
        conn.close()

    return {
        "order_id": order["order_id"],
        "provider": order["provider"],
        "amount": float(q.total),
        "base_price": float(q.base_price),
        "extra_seats_price": float(q.extra_seats_price),
        "seats_included": q.seats_included,
        "extra_seats": q.extra_seats,
        "seats_total": q.seats_total,
        "plan_type": q.plan_type,
        "tier_id": q.tier_id,
        "feature_ids": q.feature_ids,
    }


@app.post("/api/checkout/mock-pay")
async def checkout_mock_pay(
    order_id: str = Form(...),
    outcome: str = Form(...),  # "success" or "fail"
    decoded_token: dict = Depends(verify_firebase_token),
):
    """
    STEP 3, mock provider only: plays the provider's checkout window and
    returns payment_id + signature, exactly what Razorpay's widget would
    hand the browser. It does NOT change any subscription - the browser
    must still call /api/checkout/verify. Disabled for real providers.
    """
    provider = payments.get_provider()
    if not isinstance(provider, payments.MockProvider):
        return JSONResponse(status_code=404, content={"error": "not_found", "message": "Not available"})
    if outcome not in ("success", "fail"):
        return JSONResponse(status_code=400, content={"error": "bad_request", "message": "outcome must be 'success' or 'fail'"})
    payment_id, signature = provider.pay(order_id, succeed=(outcome == "success"))
    return {"order_id": order_id, "payment_id": payment_id, "signature": signature}


@app.post("/api/checkout/verify")
async def checkout_verify(
    order_id: str = Form(...),
    payment_id: str = Form(...),
    signature: str = Form(default=""),
    decoded_token: dict = Depends(verify_firebase_token),
):
    """
    STEP 3: the ONLY browser path that can activate a plan. The provider
    checks the signature; valid -> subscription 'active' and a 'paid'
    payment row; invalid or missing -> 'failed' and a 'failed' row.
    The order must belong to the caller's own business (404 otherwise),
    and an already-paid order can't be paid again (409).
    """
    tenant_id = _resolve_tenant(decoded_token)
    provider = payments.get_provider()
    paid = provider.verify_payment(order_id, payment_id, signature)

    conn = get_connection()
    try:
        result = subs.apply_payment(conn, order_id, payment_id, paid, provider.name, tenant_id=tenant_id)
    except subs.OrderNotFound:
        return JSONResponse(status_code=404, content={"error": "not_found", "message": "Order not found"})
    except subs.AlreadyActive:
        return JSONResponse(status_code=409, content={"error": "already_active", "message": "This order is already paid."})
    finally:
        conn.close()
    return {"status": result["status"], "paid": paid}


@app.post("/api/payments/webhook")
async def payments_webhook(request: Request):
    """
    STEP 3: the provider's server-to-server notice. Public (the provider
    has no Firebase token) but authenticated by the provider's signature
    header; an unsigned or wrongly signed body is rejected with 400 and
    changes nothing. A repeat notice for an already-paid order is
    acknowledged without recording anything twice.
    """
    provider = payments.get_provider()
    body = await request.body()
    try:
        event = provider.handle_webhook(body, request.headers.get("X-Payment-Signature", ""))
    except (payments.WebhookSignatureError, ValueError, KeyError):
        return JSONResponse(status_code=400, content={"error": "bad_signature", "message": "Webhook rejected"})

    conn = get_connection()
    try:
        subs.apply_payment(conn, event.order_id, event.payment_id, event.paid, provider.name)
    except subs.OrderNotFound:
        return JSONResponse(status_code=404, content={"error": "not_found", "message": "Order not found"})
    except subs.AlreadyActive:
        return {"status": "ignored", "reason": "already active"}
    finally:
        conn.close()
    return {"status": "ok"}


@app.post("/api/parse")
async def parse_document(
    file: UploadFile = File(...),
    document_type: str = Form(...),
    department: str = Form(default=None),
    decoded_token: dict = Depends(verify_firebase_token),
):
    """
    Accepts a document upload and returns the parsed result as JSON.
    MILESTONE 2 CHANGE: tenant_id is no longer a form field a client can
    supply - it's resolved server-side from the verified token, exactly
    like every other endpoint above. The parser call itself
    (pipeline.process) is completely unchanged.

    STEP 2: a successful parse is also saved (document_store.py, one
    transaction) and the response gains document_id and department.
    department is optional and defaults to finance; until roles exist
    (Step 4) every caller is the owner, who may choose it. If the save
    fails, the caller gets an error, never a result that wasn't saved.
    """
    department = department or ds.DEFAULT_DEPARTMENT
    if department not in ds.DEPARTMENTS:
        return JSONResponse(
            status_code=400,
            content={"error": "bad_request", "message": f"department must be one of {list(ds.DEPARTMENTS)}"},
        )

    user_id, tenant_id = _resolve_user_and_tenant(decoded_token)
    if not _has_active_plan(tenant_id):
        return _payment_required()

    suffix = os.path.splitext(file.filename or "")[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        contents = await file.read()
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        result = process(tmp_path, tenant_id=tenant_id, document_type=document_type)
        # The temp file's random name is meaningless to the user - record
        # the name they uploaded instead.
        result.source_file = file.filename or result.source_file
        response = result.model_dump(mode="json")

        conn = get_connection()
        try:
            document_id = ds.save_parser_result(conn, result, tenant_id, user_id, department)
        except Exception as e:
            return JSONResponse(
                status_code=500,
                content={"error": "save_failed", "message": f"Parsed, but could not save the document ({type(e).__name__}). Nothing was stored."},
            )
        finally:
            conn.close()

        response["document_id"] = document_id
        response["department"] = department
        return response

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


@app.get("/api/documents")
async def list_my_documents(decoded_token: dict = Depends(verify_firebase_token)):
    """
    STEP 2: the caller's business's saved documents, newest first, one
    summary each. Scoped to the server-resolved tenant only. Every caller
    is the owner until Step 4, so no department filter is applied yet
    (department=None means all departments - see document_store._scope).
    """
    tenant_id = _resolve_tenant(decoded_token)
    conn = get_connection()
    try:
        if not subs.is_active(conn, tenant_id):
            return _payment_required()
        return {"documents": ds.list_documents(conn, tenant_id)}
    finally:
        conn.close()


@app.get("/api/documents/{document_id}")
async def get_my_document(document_id: str, decoded_token: dict = Depends(verify_firebase_token)):
    """
    STEP 2: one saved document with all its rows, in the same shape
    /api/parse returns. A document that belongs to another business gets
    the same 404 as one that doesn't exist, so ids of other businesses'
    documents can't even be confirmed. A malformed id is also a 404.
    """
    not_found = JSONResponse(status_code=404, content={"error": "not_found", "message": "Document not found"})
    try:
        uuid.UUID(document_id)
    except ValueError:
        return not_found

    tenant_id = _resolve_tenant(decoded_token)
    conn = get_connection()
    try:
        if not subs.is_active(conn, tenant_id):
            return _payment_required()
        document = ds.get_document(conn, tenant_id, document_id)
    finally:
        conn.close()
    return document if document is not None else not_found
