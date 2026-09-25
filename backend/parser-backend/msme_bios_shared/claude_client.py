"""
claude_client.py — One shared function for calling Claude to extract
structured JSON from a document (text, image, or both). All 3 parsers
use this identically, so the model name, retry behavior, and JSON-cleanup
logic live in exactly one place.

If you need to upgrade the model or change retry behavior later, change
it here once - not in three separate repos.
"""

from __future__ import annotations  # lets 'str | None' work on Python 3.9 too - see MASTER_REFERENCE.md

import base64
import json
from anthropic import Anthropic
from msme_bios_shared.config import ANTHROPIC_API_KEY

MODEL = "claude-haiku-4-5-20251001"
MAX_TOKENS = 4096

_client = None


def get_client() -> Anthropic:
    """Lazily creates the Anthropic client on first use, so importing this
    module doesn't fail just because the API key isn't set yet (useful for
    running tests that don't actually call the API)."""
    global _client
    if _client is None:
        if not ANTHROPIC_API_KEY:
            raise EnvironmentError(
                "ANTHROPIC_API_KEY not set. Copy .env.example to .env and fill it in."
            )
        _client = Anthropic(api_key=ANTHROPIC_API_KEY)
    return _client


def extract_structured(
    schema_prompt: str,
    text: str | None = None,
    image_bytes: bytes | None = None,
    image_media_type: str = "image/jpeg",
) -> dict:
    """
    Calls Claude with either text, an image, or both, plus instructions
    describing the exact JSON shape expected back, and returns parsed JSON.

    Args:
        schema_prompt: instructions describing the exact JSON schema expected
                        back. Be explicit - list every field name and type.
        text: plain text content to include (e.g. text already extracted
              from a PDF that needs AI help structuring)
        image_bytes: raw image bytes, for vision-based extraction
        image_media_type: MIME type of the image (default: image/jpeg)

    Returns:
        Parsed JSON response as a dict.

    Raises:
        ValueError: if at least one of text/image_bytes isn't provided, or
                    if Claude's response can't be parsed as JSON even after
                    a cleanup attempt.
    """
    if not text and not image_bytes:
        raise ValueError("extract_structured() needs at least one of: text, image_bytes")

    client = get_client()
    content = []

    if image_bytes:
        content.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": image_media_type,
                "data": base64.b64encode(image_bytes).decode("utf-8"),
            },
        })
    if text:
        content.append({"type": "text", "text": text})
    content.append({"type": "text", "text": schema_prompt})

    response = client.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        messages=[{"role": "user", "content": content}],
    )

    raw = response.content[0].text
    return _parse_json_response(raw)


def _parse_json_response(raw: str) -> dict:
    """Tries a direct JSON parse first; if Claude wrapped the response in a
    markdown code fence (```json ... ```), strips that and retries once
    before giving up. This is the ONE retry - if it still fails, that's a
    real problem worth seeing, not something to keep silently retrying."""
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        cleaned = cleaned.strip()
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError as e:
            raise ValueError(
                f"Claude's response was not valid JSON, even after removing "
                f"markdown formatting. First 200 chars: {raw[:200]!r}"
            ) from e
