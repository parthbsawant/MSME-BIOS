"""
config.py — Loads shared environment variables (API keys, database URL) once,
so all 3 parsers read configuration the same way instead of each writing
their own os.getenv() calls scattered around.
"""

import os
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")

# ---- Per-parser AI vision toggles ----
# Each parser's AI escalation path (calling Claude) only runs if its own
# flag here is explicitly "true". All three default to OFF. This exists
# specifically so one parser's AI path can be enabled independently of
# the others - e.g. only the handwritten parser, once approved, without
# also silently turning on the bank or invoice parser's AI paths (whose
# code may already be built and ready, but shouldn't run until each is
# individually approved and tested).
def _flag(name: str) -> bool:
    return os.getenv(name, "false").strip().lower() == "true"

ENABLE_CLAUDE_VISION_BANK = _flag("ENABLE_CLAUDE_VISION_BANK")
ENABLE_CLAUDE_VISION_INVOICE = _flag("ENABLE_CLAUDE_VISION_INVOICE")
ENABLE_CLAUDE_VISION_HANDWRITTEN = _flag("ENABLE_CLAUDE_VISION_HANDWRITTEN")


def validate_config(require_db: bool = False) -> None:
    """
    Call this once at the start of your parser's main.py so missing
    configuration fails immediately with a clear message, instead of
    failing later with a confusing stack trace deep inside a Claude
    API call or a database connection attempt.

    require_db: set True if your parser writes to the database directly
    (most parsers will, via db.write_to_staging).
    """
    missing = []
    if not ANTHROPIC_API_KEY:
        missing.append("ANTHROPIC_API_KEY")
    if require_db and not DATABASE_URL:
        missing.append("DATABASE_URL")

    if missing:
        raise EnvironmentError(
            f"Missing required environment variable(s): {', '.join(missing)}. "
            f"Copy .env.example to .env in your parser repo and fill them in."
        )
