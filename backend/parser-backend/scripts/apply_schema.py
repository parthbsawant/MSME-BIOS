"""
apply_schema.py — Applies one or more schema/*.sql files to a database,
without needing psql installed.

    python scripts/apply_schema.py --env DATABASE_URL --expect-db msme_bios_dev schema/001_initial_schema.sql schema/002_department_uploaded_by.sql

Safety, because the same machine can hold URLs for dev, test and
production:
  --env        the NAME of the environment variable holding the URL (read
               from .env). The URL itself is never printed.
  --expect-db  the database name you mean to change. The script connects,
               asks the server which database it actually is, and aborts
               before running anything if the two differ.

All files run in ONE transaction: either every file applies, or nothing
changes.
"""

import argparse
import os
import sys

import psycopg2
from dotenv import load_dotenv


def main() -> int:
    parser = argparse.ArgumentParser(description="Apply schema SQL files to a database.")
    parser.add_argument("--env", required=True, help="Name of the env variable holding the database URL, e.g. DATABASE_URL")
    parser.add_argument("--expect-db", required=True, help="Database name the URL must point at, e.g. msme_bios_dev")
    parser.add_argument("files", nargs="+", help="SQL files to apply, in order")
    args = parser.parse_args()

    load_dotenv()
    url = os.getenv(args.env)
    if not url:
        print(f"ABORT: {args.env} is not set (check backend/parser-backend/.env).")
        return 1

    for path in args.files:
        if not os.path.isfile(path):
            print(f"ABORT: file not found: {path}")
            return 1

    conn = psycopg2.connect(url, connect_timeout=20)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT current_database()")
            actual_db = cur.fetchone()[0]
        if actual_db != args.expect_db:
            print(f"ABORT: {args.env} points at '{actual_db}', not '{args.expect_db}'. Nothing was changed.")
            return 1

        with conn.cursor() as cur:
            for path in args.files:
                with open(path, encoding="utf-8") as f:
                    cur.execute(f.read())
                print(f"applied {os.path.basename(path)}")
        conn.commit()
        print(f"OK: committed to {actual_db}")
        return 0
    except Exception as e:
        conn.rollback()
        print(f"FAILED, rolled back, nothing changed in {args.expect_db}: {type(e).__name__}: {e}")
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
