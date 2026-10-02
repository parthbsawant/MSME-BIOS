"""
db_pool.py — Connection helper for the Milestone 2 application tables
(users, tenants, businesses, plans, documents, ...).

Deliberately separate from msme_bios_shared/db.py, which stays exactly
as it is - that module's job is the parsers' own staging writes, a
different concern from the application/tenancy layer being built here.
Keeping them apart means neither has to change to accommodate the other.
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor


def get_connection():
    """
    A new connection per call - simple and correct for this milestone's
    request volume. Callers are responsible for closing what they open;
    every function in this module uses a `with` block so that happens
    automatically, even if a query raises.
    """
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not set - see .env.example.")
    return psycopg2.connect(database_url, cursor_factory=RealDictCursor)
