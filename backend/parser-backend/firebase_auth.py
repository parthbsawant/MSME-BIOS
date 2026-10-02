"""
firebase_auth.py — Verifies Firebase ID tokens on incoming requests.

This is the ONLY place in the backend that talks to Firebase Admin SDK.
It doesn't know about tenants, users, or the database - it answers
exactly one question: "is this token genuine, and if so, whose Firebase
UID does it belong to?" tenant_resolution.py builds on top of this.

SETUP - getting a Firebase service account credential:
    1. Firebase Console -> your project -> gear icon -> Project settings
    2. "Service accounts" tab -> "Generate new private key"
    3. This downloads a JSON file - save it OUTSIDE this repo entirely
       (e.g. ~/secrets/msme-bios-firebase-adminsdk.json), never inside
       backend/parser-backend/, so it can never be accidentally committed.
    4. In backend/parser-backend/.env, add:
         FIREBASE_SERVICE_ACCOUNT_PATH=/Users/parthsawant/secrets/msme-bios-firebase-adminsdk.json
       (your real path, wherever you actually saved it in step 3 - note
       the KEY=value form; a bare path with no variable name does nothing)

Initialization is LAZY - importing this module never touches the
credential file or Firebase's servers. It only happens the first time
verify_firebase_token() actually runs.
"""

import os

import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
from fastapi import Header, HTTPException

_initialized = False


def _ensure_initialized() -> None:
    global _initialized
    if _initialized:
        return

    cred_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
    if not cred_path:
        raise RuntimeError(
            "FIREBASE_SERVICE_ACCOUNT_PATH is not set. See this file's "
            "docstring for how to get a Firebase service account credential "
            "and configure it in .env."
        )
    if not os.path.exists(cred_path):
        raise RuntimeError(
            f"FIREBASE_SERVICE_ACCOUNT_PATH is set to '{cred_path}', but no "
            f"file exists there. Check the path in .env."
        )

    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)
    _initialized = True


async def verify_firebase_token(authorization: str = Header(default=None)) -> dict:
    """
    A FastAPI dependency. Add `decoded=Depends(verify_firebase_token)` to
    any endpoint that needs a real, verified caller. decoded["uid"] is
    the Firebase UID - safe to trust, because it came from a signature
    Firebase itself verified, not from anything the client typed into a
    request.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or malformed Authorization header")

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")

    _ensure_initialized()

    try:
        decoded_token = firebase_auth.verify_id_token(token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid or expired token: {e}")

    return decoded_token
