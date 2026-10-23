"""
conftest.py — Points every database-touching test at the separate test
database (TEST_DATABASE_URL), never at dev or production.

Runs before any test module imports api.py / db_pool.py. It copies
TEST_DATABASE_URL into DATABASE_URL in this process's environment;
msme_bios_shared/config.py's later load_dotenv() does not override a
variable that is already set, so the .env's own DATABASE_URL is never
used during tests.

Tests that need the database are marked with `pytestmark = pytest.mark.db`.
If TEST_DATABASE_URL is missing, or does not point at a database whose
name contains "test", those tests are SKIPPED (with the reason shown) -
they never fall back to another database. Parser tests are unaffected.
"""

import os

import pytest
from dotenv import load_dotenv

_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(_BACKEND_DIR, ".env"))

_TEST_DB_URL = os.getenv("TEST_DATABASE_URL", "")
_SKIP_REASON = None

if not _TEST_DB_URL:
    _SKIP_REASON = "TEST_DATABASE_URL is not set in .env - database tests skipped (never run against dev/production)."
elif _TEST_DB_URL == os.getenv("DATABASE_URL", ""):
    _SKIP_REASON = "TEST_DATABASE_URL is the same as DATABASE_URL - database tests skipped."

# Whatever happens, tests in this process must never see the .env's own
# DATABASE_URL. Empty string (not a missing key) so load_dotenv() later
# leaves it alone.
os.environ["DATABASE_URL"] = _TEST_DB_URL if _SKIP_REASON is None else ""


def pytest_configure(config):
    global _SKIP_REASON
    config.addinivalue_line("markers", "db: test reads or writes the test database")

    if _SKIP_REASON is None:
        import psycopg2

        try:
            conn = psycopg2.connect(_TEST_DB_URL, connect_timeout=20)
            with conn.cursor() as cur:
                cur.execute("SELECT current_database()")
                name = cur.fetchone()[0]
            conn.close()
        except Exception as e:
            _SKIP_REASON = f"Could not connect to TEST_DATABASE_URL ({type(e).__name__}) - database tests skipped."
            os.environ["DATABASE_URL"] = ""
            return

        if "test" not in name:
            _SKIP_REASON = f"TEST_DATABASE_URL points at '{name}', whose name does not contain 'test' - database tests skipped."
            os.environ["DATABASE_URL"] = ""


def pytest_collection_modifyitems(config, items):
    if _SKIP_REASON is None:
        return
    skip = pytest.mark.skip(reason=_SKIP_REASON)
    for item in items:
        if "db" in item.keywords:
            item.add_marker(skip)
