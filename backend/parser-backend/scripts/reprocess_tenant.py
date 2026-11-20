"""
reprocess_tenant.py — re-run categorize, enrich and reconcile on rows that
are already in the database for ONE tenant (e.g. seeded data).

    python scripts/reprocess_tenant.py --env DATABASE_URL --expect-db msme_bios_dev --tenant-id <uuid>
    python scripts/reprocess_tenant.py ... --recategorize      (redo categories too)

Default: categorizes only rows with no category yet, fills only NULL
invoice fields, then reconciles. --recategorize re-scores every bank row
except manual ones and rows already linked to an invoice.

Same safety as apply_schema.py: --env names the variable holding the URL
(never printed); the script aborts unless the server reports --expect-db.
Everything runs in ONE transaction: all of it commits, or nothing does.
"""

import argparse
import os
import sys
import uuid

import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import RealDictCursor

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from enrichment.post_save import categorize_bank_rows, enrich_invoice_rows  # noqa: E402
from reconciliation.matcher import reconcile  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser(description="Re-run categorize, enrich and reconcile for one tenant.")
    ap.add_argument("--env", required=True, help="Name of the env variable holding the database URL, e.g. DATABASE_URL")
    ap.add_argument("--expect-db", required=True, help="Database name the URL must point at, e.g. msme_bios_dev")
    ap.add_argument("--tenant-id", required=True, help="Tenant UUID to reprocess")
    ap.add_argument("--recategorize", action="store_true", help="Re-score already categorized rows too")
    args = ap.parse_args()

    try:
        tenant_id = str(uuid.UUID(args.tenant_id))
    except ValueError:
        print("ABORT: --tenant-id is not a valid UUID.")
        return 1

    load_dotenv()
    url = os.getenv(args.env)
    if not url:
        print(f"ABORT: {args.env} is not set (check backend/parser-backend/.env).")
        return 1

    conn = psycopg2.connect(url, connect_timeout=20, cursor_factory=RealDictCursor)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT current_database() AS db")
            actual_db = cur.fetchone()["db"]
            if actual_db != args.expect_db:
                print(f"ABORT: {args.env} points at '{actual_db}', not '{args.expect_db}'. Nothing was changed.")
                return 1
            cur.execute("SELECT 1 FROM tenants WHERE id = %s", (tenant_id,))
            if cur.fetchone() is None:
                print(f"ABORT: tenant {tenant_id} does not exist in {actual_db}. Nothing was changed.")
                return 1

        categorized = categorize_bank_rows(conn, tenant_id, recategorize=args.recategorize)
        enriched = enrich_invoice_rows(conn, tenant_id)
        summary = reconcile(conn, tenant_id)
        conn.commit()
        print(f"categorized {categorized} bank rows, enriched {enriched} invoices")
        print("reconcile: " + ", ".join(f"{k} {v}" for k, v in summary.items()))
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
