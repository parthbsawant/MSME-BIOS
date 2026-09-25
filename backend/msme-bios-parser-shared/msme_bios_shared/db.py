"""
db.py — Shared PostgreSQL connection and staging-table write helper.
All 3 parsers write to their staging tables through this one function,
so inserts are guaranteed consistent instead of each parser writing its
own slightly-different insert logic.
"""

import psycopg2
import psycopg2.extras
from msme_bios_shared.config import DATABASE_URL


def get_connection():
    """Opens a new database connection. Caller is responsible for closing
    it (write_to_staging below does this for you automatically)."""
    if not DATABASE_URL:
        raise EnvironmentError(
            "DATABASE_URL not set. Copy .env.example to .env and fill it in."
        )
    return psycopg2.connect(DATABASE_URL)


def write_to_staging(table_name: str, rows: list[dict]) -> int:
    """
    Inserts a batch of rows into the given staging table.

    Args:
        table_name: the staging table to write to (e.g. 'bank_transactions_staging')
        rows: list of dicts, each representing one row. All dicts must have
              the same keys, matching the table's columns.

    Returns:
        Number of rows written (0 if rows was empty - not an error).
    """
    if not rows:
        return 0

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            columns = list(rows[0].keys())
            col_names = ", ".join(columns)
            placeholders = ", ".join(["%s"] * len(columns))
            query = f"INSERT INTO {table_name} ({col_names}) VALUES ({placeholders})"
            values = [tuple(row[col] for col in columns) for row in rows]
            psycopg2.extras.execute_batch(cur, query, values)
        conn.commit()
        return len(rows)
    finally:
        conn.close()
