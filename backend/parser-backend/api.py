"""
api.py — Exposes pipeline.process() over HTTP, so the frontend (or any
other client) can actually reach it. Before this file existed, the
backend was only callable from other Python code on the same machine -
this is what makes it reachable from a browser.

Run with:
    uvicorn api:app --reload --port 8000

STEP 1 of the frontend-backend connection plan: just the core parse
endpoint. Health check (Step 2) and CORS (Step 3) are deliberately not
here yet - kept as their own separate, reviewable changes.
"""

import os
import tempfile

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import JSONResponse

from pipeline import process, DocumentType

app = FastAPI(title="MSME-BIOS Parser API")


@app.post("/api/parse")
async def parse_document(
    file: UploadFile = File(...),
    document_type: str = Form(...),
    tenant_id: str = Form(default="default_tenant"),
):
    """
    Accepts a document upload and returns the parsed result as JSON, in
    the exact same shape pipeline.process() already returns when called
    directly from Python - nothing about the actual parsing logic is
    duplicated or reimplemented here.
    """
    # Save the upload to a real temp file - pipeline.process() expects a
    # file PATH (it needs to actually open/re-open the file in a few
    # places, e.g. pdfplumber), not raw bytes in memory.
    suffix = os.path.splitext(file.filename or "")[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        contents = await file.read()
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        result = process(tmp_path, tenant_id=tenant_id, document_type=document_type)
        return result.model_dump(mode="json")

    except NotImplementedError as e:
        # A parser's AI-vision path was reached but isn't approved/enabled
        # yet (see the ENABLE_CLAUDE_VISION_* flags) - this is an expected,
        # known state, not a server bug, so it gets its own clear status.
        return JSONResponse(
            status_code=501,
            content={"error": "ai_vision_not_enabled", "message": str(e)},
        )

    except (ValueError, FileNotFoundError) as e:
        # A bad document_type, an unreadable file, etc. - the client's
        # request was the problem, not the server.
        return JSONResponse(
            status_code=400,
            content={"error": "bad_request", "message": str(e)},
        )

    finally:
        # Always clean up the temp file, whether parsing succeeded or not.
        os.unlink(tmp_path)
