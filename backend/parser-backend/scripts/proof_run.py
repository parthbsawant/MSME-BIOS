"""
proof_run.py — one month of the Mauli Traders synthetic dataset through the
REAL upload path, scored against the dataset's CSV truth
(docs/CATEGORIZER_PLAN.md, "After step 5", item 6).

    python scripts/proof_run.py --env DATABASE_URL --expect-db msme_bios_dev \
        --dataset "<...>/05_Transaction_Data/Synthetic_FY2025-26" --month 2025-04 \
        --workdir <folder for the generated statement PDF> [--keep]

What it does:
  1. Renders the month's bank statement (csv/bank_transactions.csv) as a
     ruled-table PDF (PyMuPDF, already a backend dependency).
  2. Creates a throwaway tenant whose business is "Mauli Traders".
  3. Every invoice PDF of the month, then the statement PDF, goes through
     pipeline.process() and document_store.save_parser_result() - so the
     parsers, categorize, enrich and reconcile run exactly as on upload.
  4. Scores each layer against the CSVs and writes a markdown report.
  5. Deletes the tenant (ON DELETE CASCADE) unless --keep.

Safety: --env names the variable holding the URL (never printed); aborts
unless the server reports --expect-db. Refuses a database named like
production ('neondb').
"""

import argparse
import csv
import os
import sys
import time
from collections import Counter, defaultdict
from datetime import date, datetime
from decimal import Decimal

import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import RealDictCursor

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import document_store as ds  # noqa: E402
from pipeline import process  # noqa: E402

BUSINESS = "Mauli Traders"

# dataset bank Type -> (stage-1 category, final category after reconciliation)
TYPE_TRUTH = {
    "UPI_SALE": ("customer_receipt", "sales_upi"),
    "COLLECTION": ("customer_receipt", "collection"),
    "SUPPLIER_PAYMENT": ("supplier_payment", "supplier_payment"),
    "CASH_DEPOSIT": ("cash_deposit", "cash_deposit"),
    "EMI": ("emi", "emi"),
    "GST_PAYMENT": ("gst_payment", "gst_payment"),
    "OD_INTEREST": ("od_interest", "od_interest"),
    "OWNER_CAPITAL": ("owner_capital", "owner_capital"),
    "OWNER_DRAWING": ("owner_drawing", "owner_drawing"),
    "EXPENSE_SALARY": ("salary", "salary"),
    "EXPENSE_ELECTRICITY": ("electricity", "electricity"),
    "EXPENSE_INTERNET": ("internet", "internet"),
    "EXPENSE_TRANSPORT": ("transport", "transport"),
    "EXPENSE_PACKAGING": ("packaging", "packaging"),
    "EXPENSE_REPAIRS": ("repairs", "repairs"),
    "EXPENSE_BANK_CHARGES": ("bank_charges", "bank_charges"),
    "EXPENSE_MISC": ("misc_expense", "misc_expense"),
}
RECEIPT_STAGE1 = {"customer_receipt", "collection", "sales_upi"}


# ------------------------------------------------------------------ data

def read_csv(path):
    with open(path, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def d(s):
    return date.fromisoformat(s) if s else None


def money(s):
    return Decimal(str(s or "0")).quantize(Decimal("0.01"))


# ------------------------------------------------------------------ statement PDF

def render_statement(rows, path):
    """Ruled table, header repeated on every page, opening and closing rows."""
    import pymupdf as fitz

    cols = [("Date", 72), ("Narration", 400), ("Debit", 90), ("Credit", 90), ("Balance", 100)]
    left, top, row_h, fs = 40, 90, 15, 7.5
    page_w, page_h = 842, 595  # A4 landscape
    per_page = int((page_h - top - 40) / row_h) - 1

    first = rows[0]
    opening = money(first["Balance"]) - money(first["Credit"]) + money(first["Debit"])
    fmt = lambda x: f"{x:,.2f}"
    body = [["", "OPENING BALANCE", "", "", fmt(opening)]]
    for r in rows:
        dt = d(r["Date"]).strftime("%d-%b-%Y")
        dr, cr = money(r["Debit"]), money(r["Credit"])
        body.append([dt, r["Narration"], fmt(dr) if dr else "", fmt(cr) if cr else "", fmt(money(r["Balance"]))])
    body.append(["", "CLOSING BALANCE", "", "", fmt(money(rows[-1]["Balance"]))])

    doc = fitz.open()
    month = rows[0]["Statement Month"]
    for start in range(0, len(body), per_page):
        page = doc.new_page(width=page_w, height=page_h)
        page.insert_text((left, 40), "BANK OF MAHARASHTRA - STATEMENT OF ACCOUNT", fontsize=12, fontname="hebo")
        page.insert_text((left, 58), f"Account holder: MAULI TRADERS    A/C 60212345678    Period: {month}",
                         fontsize=9)
        y = top
        for cells in [[c for c, _ in cols]] + body[start:start + per_page]:
            x = left
            for (name, w), text in zip(cols, cells):
                page.draw_rect(fitz.Rect(x, y, x + w, y + row_h), color=(0, 0, 0), width=0.5)
                align_right = name in ("Debit", "Credit", "Balance") and y > top
                tw = fitz.get_text_length(text, fontname="helv", fontsize=fs)
                tx = x + w - tw - 3 if align_right else x + 3
                page.insert_text((tx, y + row_h - 4.5), text, fontsize=fs, fontname="helv")
                x += w
            y += row_h
    doc.save(path)
    doc.close()


# ------------------------------------------------------------------ run

def main() -> int:
    ap = argparse.ArgumentParser(description="Proof run: one dataset month through the real upload path.")
    ap.add_argument("--env", required=True)
    ap.add_argument("--expect-db", required=True)
    ap.add_argument("--dataset", required=True, help="Path to Synthetic_FY2025-26")
    ap.add_argument("--month", required=True, help="YYYY-MM, e.g. 2025-04")
    ap.add_argument("--workdir", required=True, help="Folder for the generated statement PDF")
    ap.add_argument("--report", default=None, help="Markdown report path (default docs/proof_runs/PROOF_RUN_<month>.md)")
    ap.add_argument("--keep", action="store_true", help="Keep the proof tenant instead of deleting it")
    args = ap.parse_args()

    if args.expect_db == "neondb":
        print("ABORT: proof runs never touch production.")
        return 1
    load_dotenv()
    url = os.getenv(args.env)
    if not url:
        print(f"ABORT: {args.env} is not set.")
        return 1

    month = args.month
    bank_csv = [r for r in read_csv(os.path.join(args.dataset, "csv", "bank_transactions.csv"))
                if r["Statement Month"] == month]
    inv_csv = {r["Invoice ID"]: r for r in read_csv(os.path.join(args.dataset, "csv", "sales_invoices.csv"))
               if r["Date"].startswith(month)}
    receipts = {r["Receipt ID"]: r for r in read_csv(os.path.join(args.dataset, "csv", "customer_receipts.csv"))}
    inv_dir = os.path.join(args.dataset, "invoices", month)
    pdfs = sorted(f for f in os.listdir(inv_dir) if f.lower().endswith(".pdf"))
    if not bank_csv or not pdfs:
        print(f"ABORT: no bank rows or no invoice PDFs for {month}.")
        return 1

    os.makedirs(args.workdir, exist_ok=True)
    stmt_pdf = os.path.join(args.workdir, f"Mauli_Traders_Statement_{month}.pdf")
    render_statement(bank_csv, stmt_pdf)
    print(f"statement PDF: {len(bank_csv)} rows -> {stmt_pdf}")

    conn = psycopg2.connect(url, connect_timeout=20, cursor_factory=RealDictCursor)
    tenant_id = None
    t0 = time.time()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT current_database() AS db")
            actual = cur.fetchone()["db"]
            if actual != args.expect_db:
                print(f"ABORT: {args.env} points at '{actual}', not '{args.expect_db}'. Nothing was changed.")
                return 1
            cur.execute("INSERT INTO tenants DEFAULT VALUES RETURNING id")
            tenant_id = str(cur.fetchone()["id"])
            cur.execute("INSERT INTO businesses (tenant_id, business_name, owner_name, city) "
                        "VALUES (%s, %s, 'Proof Run', 'Kalamwadi')", (tenant_id, BUSINESS))
        conn.commit()
        print(f"proof tenant {tenant_id} in {actual}")

        # ---- invoices through the real parser + save path
        parse_errors = []
        for i, name in enumerate(pdfs, 1):
            try:
                result = process(os.path.join(inv_dir, name), tenant_id, "invoice_bill")
                ds.save_parser_result(conn, result, tenant_id, None, "finance")
            except Exception as e:  # report, keep going
                parse_errors.append((name, f"{type(e).__name__}: {e}"))
            if i % 50 == 0:
                print(f"  invoices {i}/{len(pdfs)}  ({time.time() - t0:.0f}s)", flush=True)
        print(f"invoices saved: {len(pdfs) - len(parse_errors)}/{len(pdfs)}")

        # ---- the statement
        stmt = process(stmt_pdf, tenant_id, "bank_statement")
        stmt_doc = ds.save_parser_result(conn, stmt, tenant_id, None, "finance")
        print(f"statement saved: {len(stmt.transactions)} rows ({time.time() - t0:.0f}s)")

        report = score(conn, tenant_id, stmt_doc, bank_csv, inv_csv, receipts, pdfs, parse_errors, month,
                       time.time() - t0)
        path = args.report or os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(
            os.path.dirname(os.path.abspath(__file__))))), "docs", "proof_runs", f"PROOF_RUN_{month}.md")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(report)
        print(report)
        print(f"report -> {path}")
        return 0
    finally:
        conn.rollback()
        if tenant_id and not args.keep:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM tenants WHERE id = %s", (tenant_id,))
            conn.commit()
            print(f"proof tenant {tenant_id} deleted")
        elif tenant_id:
            print(f"proof tenant {tenant_id} KEPT (--keep)")
        conn.close()


# ------------------------------------------------------------------ scoring

def pct(ok, n):
    return f"{100 * ok / n:.1f}% ({ok}/{n})" if n else "n/a"


def score(conn, tenant_id, stmt_doc, bank_csv, inv_csv, receipts, pdfs, parse_errors, month, seconds):
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM bank_transactions WHERE tenant_id = %s AND document_id = %s ORDER BY line_no",
                    (tenant_id, stmt_doc))
        bank_db = cur.fetchall()
        cur.execute("SELECT * FROM invoices WHERE tenant_id = %s", (tenant_id,))
        inv_db = {r["invoice_number"]: r for r in cur.fetchall()}
        cur.execute("SELECT ip.*, i.invoice_number, i.payment_mode FROM invoice_payments ip JOIN invoices i "
                    "ON i.id = ip.invoice_id AND i.tenant_id = ip.tenant_id WHERE ip.tenant_id = %s", (tenant_id,))
        links = cur.fetchall()

    out = [f"# Proof run {month}: Mauli Traders through the real upload path", "",
           f"Run {datetime.now():%Y-%m-%d %H:%M}, {seconds:.0f} s. Dev database, throwaway tenant. "
           "No Claude API. Truth = the synthetic dataset CSVs.", ""]

    # ---- 1. bank parser
    exact = 0
    for db, tr in zip(bank_db, bank_csv):
        if (db["txn_date"] == d(tr["Date"]) and db["description"] == " ".join(tr["Narration"].split())
                and (db["debit"] or 0) == money(tr["Debit"]) and (db["credit"] or 0) == money(tr["Credit"])
                and db["balance"] == money(tr["Balance"])):
            exact += 1
    out += ["## 1. Bank statement parser", "",
            f"- Rows in truth: {len(bank_csv)}; rows parsed: {len(bank_db)}",
            f"- Rows exactly right (date, narration, debit, credit, balance): {pct(exact, len(bank_csv))}",
            f"- Rows the parser flagged needs_review: {sum(1 for r in bank_db if r['needs_review'] and r['review_reason'] != 'Category not recognised')}",
            ""]

    # ---- 2. categorizer (stage 1) and final category
    per = defaultdict(lambda: [0, 0, 0])  # n, stage1 ok, final ok
    wrong = Counter()
    aligned = list(zip(bank_db, bank_csv))
    for db, tr in aligned:
        s1, final = TYPE_TRUTH.get(tr["Type"], ("other", "other"))
        got = db["category"]
        s1_ok = (got in RECEIPT_STAGE1) if s1 == "customer_receipt" else (got == s1)
        p = per[tr["Type"]]
        p[0] += 1
        p[1] += s1_ok
        p[2] += got == final
        if got != final:
            wrong[(tr["Type"], got)] += 1
    n = len(aligned)
    s1_total = sum(p[1] for p in per.values())
    fin_total = sum(p[2] for p in per.values())
    src = Counter(r["category_source"] or "none (needs review)" for r in bank_db)
    out += ["## 2. Categorizer", "",
            f"- Stage 1 (categorizer alone): **{pct(s1_total, n)}**",
            f"- Final category (after reconciliation splits receipts into collection / sales_upi): **{pct(fin_total, n)}**",
            f"- Answer source: " + ", ".join(f"{k} {v}" for k, v in src.most_common()),
            "- Caveat: April rows were in the categorizer's training split, so stage 1 here is in-sample "
            "(rules decide almost every row; see tests/test_categorizer.py for the held-out score).", "",
            "| Dataset type | Rows | Stage 1 | Final |", "|---|---:|---:|---:|"]
    for t in sorted(per):
        c, a, b = per[t]
        out.append(f"| {t} | {c} | {pct(a, c)} | {pct(b, c)} |")
    if wrong:
        out += ["", "Wrong final categories (dataset type -> ours): " +
                ", ".join(f"{t} -> {g}: {k}" for (t, g), k in wrong.most_common())]
    out.append("")

    # ---- 3. invoice parser + enrichment
    parsed = [inv_db.get(f[:-4]) for f in pdfs]
    ok_num = sum(1 for f in pdfs if f[:-4] in inv_db)
    fields = Counter()
    misses = defaultdict(list)
    for num, tr in inv_csv.items():
        r = inv_db.get(num)
        if r is None:
            continue
        mode = tr["Payment Mode"].lower()
        checks = {
            "invoice_date": r["invoice_date"] == d(tr["Date"]),
            "total": r["total"] == money(tr["Total Amount"]),
            "direction": r["direction"] == "sale",
            "party_name": (r["party_name"] or "") == tr["Customer Name"],
            "payment_mode": r["payment_mode"] == mode,
            "due_date": r["due_date"] == (d(tr["Due Date"]) if mode == "credit" else None),
        }
        if mode in ("cash", "upi"):
            checks["paid_at (cash/upi = invoice date)"] = r["paid_at"] == d(tr["Date"])
        for k, v in checks.items():
            fields[(k, "n")] += 1
            fields[(k, "ok")] += v
            if not v and len(misses[k]) < 3:
                misses[k].append(f"{num}: got {r.get(k.split(' ')[0])!r}")
    out += ["## 3. Invoice parser and enrichment", "",
            f"- Invoice PDFs: {len(pdfs)}; saved: {ok_num}; failed: {len(parse_errors)}", ""]
    for name, err in parse_errors[:5]:
        out.append(f"  - {name}: {err}")
    out += ["| Field | Correct |", "|---|---:|"]
    for k in ["invoice_date", "total", "direction", "party_name", "payment_mode", "due_date",
              "paid_at (cash/upi = invoice date)"]:
        out.append(f"| {k} | {pct(fields[(k, 'ok')], fields[(k, 'n')])} |")
    for k, ex in misses.items():
        out.append(f"\nExamples wrong for {k}: " + "; ".join(ex))
    out.append("")

    # ---- 4. reconciliation
    bank_id_to_row = {str(db["id"]): tr for db, tr in aligned}
    truth_links = set()
    for db, tr in aligned:
        if tr["Type"] == "COLLECTION":
            rc = receipts.get(tr["Source Ref"])
            if rc:
                truth_links.add((str(db["id"]), rc["Invoice ID"]))
    credit_links = [l for l in links if l["payment_mode"] == "credit"]
    upi_links = [l for l in links if l["payment_mode"] == "upi"]
    ours = {(str(l["bank_transaction_id"]), l["invoice_number"]) for l in credit_links}
    correct = ours & truth_links
    by_status = Counter(l["status"] for l in credit_links)
    status_ok = Counter(l["status"] for l in credit_links
                        if (str(l["bank_transaction_id"]), l["invoice_number"]) in truth_links)
    truth_upi = {(str(db["id"]), tr["Source Ref"]) for db, tr in aligned if tr["Type"] == "UPI_SALE"}
    ours_upi = {(str(l["bank_transaction_id"]), l["invoice_number"]) for l in upi_links}
    false_coll = sum(1 for db, tr in aligned if tr["Type"] == "UPI_SALE" and db["category"] == "collection")

    # truth paid_at: credit invoices fully paid by this month's bank receipts
    paid_truth = {}
    running = defaultdict(Decimal)
    for db, tr in aligned:
        if tr["Type"] == "COLLECTION" and tr["Source Ref"] in receipts:
            inv = receipts[tr["Source Ref"]]["Invoice ID"]
            running[inv] += money(tr["Credit"])
            if inv in inv_csv and inv not in paid_truth and running[inv] >= money(inv_csv[inv]["Total Amount"]) - Decimal("0.50"):
                paid_truth[inv] = d(tr["Date"])
    credit_invs = [k for k, v in inv_csv.items() if v["Payment Mode"] == "Credit" and k in inv_db]
    paid_ok = sum(1 for k in credit_invs if inv_db[k]["paid_at"] == paid_truth.get(k))
    wrongly_paid = sum(1 for k in credit_invs if inv_db[k]["paid_at"] and k not in paid_truth)
    missed_paid = sum(1 for k in credit_invs if k in paid_truth and inv_db[k]["paid_at"] is None)
    cash_receipts = sum(1 for r in receipts.values() if r["Invoice ID"] in inv_csv and r["Date"].startswith(month)) \
        - sum(1 for db, tr in aligned if tr["Type"] == "COLLECTION")

    out += ["## 4. Reconciliation", "",
            "Collections (receipt pays a credit invoice):",
            f"- True collection links in the bank statement: {len(truth_links)}",
            f"- Collection links made: {len(ours)} (" + ", ".join(f"{k} {v}" for k, v in by_status.most_common()) + ")",
            f"- **Precision** (links that are right): {pct(len(correct), len(ours))}",
            f"- **Recall** (true links found): {pct(len(correct), len(truth_links))}",
            "- Right links by status: " + ", ".join(f"{k} {status_ok[k]}/{by_status[k]}" for k in by_status),
            "",
            "UPI shop sales (receipt matched to its own same-day UPI invoice):",
            f"- UPI sales in the statement: {len(truth_upi)}; matched to an invoice: {len(ours_upi)}",
            f"- Matched to the right invoice: {pct(len(ours_upi & truth_upi), len(ours_upi))}; "
            f"of all UPI sales: {pct(len(ours_upi & truth_upi), len(truth_upi))}",
            "",
            f"- UPI shop sales wrongly turned into collections: {false_coll} of "
            f"{sum(1 for _, tr in aligned if tr['Type'] == 'UPI_SALE')}",
            f"- Credit invoices with the right paid_at (paid date, or still open): {pct(paid_ok, len(credit_invs))}",
            f"  - marked paid but not paid by bank: {wrongly_paid}; paid by bank but still open: {missed_paid}",
            f"- {cash_receipts} receipts this month for these invoices were paid in cash (not in the bank), "
            "so those invoices correctly stay open here.",
            "- Supplier payments: purchase bills are not in the dataset as PDFs, so none were uploaded; "
            "supplier payments are categorized but not linked.", ""]

    wrong_links = sorted(ours - truth_links)[:5]
    if wrong_links:
        out.append("Examples of wrong links (bank narration -> invoice we chose):")
        for bid, inv in wrong_links:
            tr = bank_id_to_row.get(bid)
            truth_inv = receipts.get(tr["Source Ref"], {}).get("Invoice ID") if tr else None
            out.append(f"- {tr['Narration'] if tr else bid} -> {inv} (truth: {truth_inv or 'no invoice, ' + (tr['Type'] if tr else '?')})")
        out.append("")
    return "\n".join(out) + "\n"


if __name__ == "__main__":
    sys.exit(main())
