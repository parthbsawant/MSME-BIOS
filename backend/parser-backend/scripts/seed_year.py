"""
seed_year.py - loads the Mauli Traders FY2025-26 dataset into ONE tenant
through the REAL upload path (parsers -> categorize -> enrich -> reconcile).
Replaces the old seed_demo.py, which bypassed the pipeline.

    python scripts/seed_year.py --env DATABASE_URL --expect-db msme_bios_dev `
        --dataset "<...>\05_Transaction_Data\Synthetic_FY2025-26" `
        --workdir "<folder for generated statement PDFs>" `
        --tenant-id <uuid>            (or --new-tenant to create a throwaway one)
        [--months 2025-04 2025-05]    (default: all 12 months; run in chunks)

Per month: every invoice PDF, then the bank statement (rendered from
csv/bank_transactions.csv with the same renderer as proof_run.py), each through
pipeline.process + save_parser_result. Each saved document is marked
documents.data_source = 'seeded'.

Resumable: a file whose name is already stored for this tenant is skipped, so
you can stop (Ctrl+C) and run again. Invoices of ALL requested months go in
before the statements, because a collection can pay an earlier month's invoice.

Safety: --env names the variable holding the URL (never printed); aborts unless
the server reports --expect-db. Refuses 'neondb' (production). No Claude API.
"""

import argparse
import csv
import os
import sys
import time
import uuid

import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import RealDictCursor

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import document_store as ds  # noqa: E402
from pipeline import process  # noqa: E402
from proof_run import render_statement  # noqa: E402

ALL_MONTHS = ["2025-04", "2025-05", "2025-06", "2025-07", "2025-08", "2025-09",
              "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03"]


def already_saved(conn, tenant_id):
    with conn.cursor() as cur:
        cur.execute("SELECT source_file FROM documents WHERE tenant_id = %s", (tenant_id,))
        return {os.path.basename(str(r["source_file"] or "")) for r in cur.fetchall()}


def mark_seeded(conn, document_id):
    with conn.cursor() as cur:
        cur.execute("UPDATE documents SET data_source = 'seeded' WHERE id = %s", (document_id,))
    conn.commit()


def main() -> int:
    ap = argparse.ArgumentParser(description="Load the Mauli Traders year through the real upload path.")
    ap.add_argument("--env", required=True)
    ap.add_argument("--expect-db", required=True)
    ap.add_argument("--dataset", required=True)
    ap.add_argument("--workdir", required=True)
    ap.add_argument("--tenant-id", default=None)
    ap.add_argument("--new-tenant", action="store_true")
    ap.add_argument("--months", nargs="+", default=ALL_MONTHS)
    args = ap.parse_args()

    if args.expect_db == "neondb":
        print("ABORT: seeding never touches production.")
        return 1
    if bool(args.tenant_id) == bool(args.new_tenant):
        print("ABORT: give exactly one of --tenant-id or --new-tenant.")
        return 1
    load_dotenv()
    url = os.getenv(args.env)
    if not url:
        print(f"ABORT: {args.env} is not set.")
        return 1

    with open(os.path.join(args.dataset, "csv", "bank_transactions.csv"), encoding="utf-8", newline="") as f:
        bank_all = list(csv.DictReader(f))
    os.makedirs(args.workdir, exist_ok=True)

    conn = psycopg2.connect(url, connect_timeout=20, cursor_factory=RealDictCursor)
    t0 = time.time()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT current_database() AS db")
            actual = cur.fetchone()["db"]
            if actual != args.expect_db:
                print(f"ABORT: {args.env} points at '{actual}', not '{args.expect_db}'. Nothing was changed.")
                return 1
            if args.new_tenant:
                cur.execute("INSERT INTO tenants DEFAULT VALUES RETURNING id")
                tenant_id = str(cur.fetchone()["id"])
                cur.execute("INSERT INTO businesses (tenant_id, business_name, owner_name, city) "
                            "VALUES (%s, 'Mauli Traders', 'Seed Run', 'Kalamwadi')", (tenant_id,))
            else:
                try:
                    tenant_id = str(uuid.UUID(args.tenant_id))
                except ValueError:
                    print("ABORT: --tenant-id is not a valid UUID.")
                    return 1
                cur.execute("SELECT 1 FROM tenants WHERE id = %s", (tenant_id,))
                if cur.fetchone() is None:
                    print(f"ABORT: tenant {tenant_id} not found in {actual}.")
                    return 1
        conn.commit()
        print(f"tenant {tenant_id} in {actual}")

        done = already_saved(conn, tenant_id)
        failures = []

        # 1. invoices, all requested months
        for month in args.months:
            inv_dir = os.path.join(args.dataset, "invoices", month)
            if not os.path.isdir(inv_dir):
                print(f"skip {month}: no invoice folder")
                continue
            pdfs = sorted(f for f in os.listdir(inv_dir) if f.lower().endswith(".pdf"))
            todo = [f for f in pdfs if f not in done]
            print(f"{month}: {len(pdfs)} invoices, {len(todo)} to load", flush=True)
            for i, name in enumerate(todo, 1):
                try:
                    result = process(os.path.join(inv_dir, name), tenant_id, "invoice_bill")
                    doc_id = ds.save_parser_result(conn, result, tenant_id, None, "finance")
                    mark_seeded(conn, doc_id)
                except Exception as e:
                    conn.rollback()
                    failures.append((name, f"{type(e).__name__}: {e}"))
                if i % 100 == 0:
                    print(f"  {month} {i}/{len(todo)}  ({time.time() - t0:.0f}s)", flush=True)

        # 2. statements, in month order
        for month in args.months:
            name = f"Mauli_Traders_Statement_{month}.pdf"
            if name in done:
                print(f"{month}: statement already loaded")
                continue
            rows = [r for r in bank_all if r["Statement Month"] == month]
            if not rows:
                continue
            path = os.path.join(args.workdir, name)
            render_statement(rows, path)
            try:
                result = process(path, tenant_id, "bank_statement")
                doc_id = ds.save_parser_result(conn, result, tenant_id, None, "finance")
                mark_seeded(conn, doc_id)
                print(f"{month}: statement loaded, {len(result.transactions)} rows ({time.time() - t0:.0f}s)",
                      flush=True)
            except Exception as e:
                conn.rollback()
                failures.append((name, f"{type(e).__name__}: {e}"))

        # summary
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) AS n FROM invoices WHERE tenant_id = %s", (tenant_id,))
            n_inv = cur.fetchone()["n"]
            cur.execute("SELECT count(*) AS n FROM bank_transactions WHERE tenant_id = %s", (tenant_id,))
            n_bank = cur.fetchone()["n"]
            cur.execute("SELECT count(*) AS n FROM bank_transactions WHERE tenant_id = %s AND category IS NULL",
                        (tenant_id,))
            n_uncat = cur.fetchone()["n"]
            cur.execute("SELECT status, count(*) AS n FROM invoice_payments WHERE tenant_id = %s GROUP BY status",
                        (tenant_id,))
            links = {r["status"]: r["n"] for r in cur.fetchall()}
        print("")
        print(f"invoices in db: {n_inv}   bank rows: {n_bank}   uncategorized: {n_uncat}   links: {links}")
        print(f"failures: {len(failures)}   time: {time.time() - t0:.0f}s")
        for name, err in failures[:10]:
            print(f"  FAILED {name}: {err}")
        print(f"tenant id: {tenant_id}")
        return 0 if not failures else 2
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
