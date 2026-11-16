# Proof run 2025-04: Mauli Traders through the real upload path

Run 2026-11-16 22:24, 765 s. Dev database, throwaway tenant. No Claude API. Truth = the synthetic dataset CSVs.

## 1. Bank statement parser

- Rows in truth: 244; rows parsed: 244
- Rows exactly right (date, narration, debit, credit, balance): 100.0% (244/244)
- Rows the parser flagged needs_review: 0

## 2. Categorizer

- Stage 1 (categorizer alone): **100.0% (244/244)**
- Final category (after reconciliation splits receipts into collection / sales_upi): **100.0% (244/244)**
- Answer source: rule 244
- Caveat: April rows were in the categorizer's training split, so stage 1 here is in-sample (rules decide almost every row; see tests/test_categorizer.py for the held-out score).

| Dataset type | Rows | Stage 1 | Final |
|---|---:|---:|---:|
| CASH_DEPOSIT | 4 | 100.0% (4/4) | 100.0% (4/4) |
| COLLECTION | 48 | 100.0% (48/48) | 100.0% (48/48) |
| EMI | 2 | 100.0% (2/2) | 100.0% (2/2) |
| EXPENSE_BANK_CHARGES | 1 | 100.0% (1/1) | 100.0% (1/1) |
| EXPENSE_ELECTRICITY | 1 | 100.0% (1/1) | 100.0% (1/1) |
| EXPENSE_INTERNET | 1 | 100.0% (1/1) | 100.0% (1/1) |
| EXPENSE_MISC | 1 | 100.0% (1/1) | 100.0% (1/1) |
| EXPENSE_PACKAGING | 1 | 100.0% (1/1) | 100.0% (1/1) |
| EXPENSE_REPAIRS | 1 | 100.0% (1/1) | 100.0% (1/1) |
| EXPENSE_SALARY | 1 | 100.0% (1/1) | 100.0% (1/1) |
| EXPENSE_TRANSPORT | 1 | 100.0% (1/1) | 100.0% (1/1) |
| OD_INTEREST | 1 | 100.0% (1/1) | 100.0% (1/1) |
| SUPPLIER_PAYMENT | 73 | 100.0% (73/73) | 100.0% (73/73) |
| UPI_SALE | 108 | 100.0% (108/108) | 100.0% (108/108) |

## 3. Invoice parser and enrichment

- Invoice PDFs: 428; saved: 428; failed: 0

| Field | Correct |
|---|---:|
| invoice_date | 100.0% (428/428) |
| total | 100.0% (428/428) |
| direction | 100.0% (428/428) |
| party_name | 100.0% (428/428) |
| payment_mode | 100.0% (428/428) |
| due_date | 100.0% (428/428) |
| paid_at (cash/upi = invoice date) | 100.0% (264/264) |

## 4. Reconciliation

Collections (receipt pays a credit invoice):
- True collection links in the bank statement: 48
- Collection links made: 48 (matched 48)
- **Precision** (links that are right): 100.0% (48/48)
- **Recall** (true links found): 100.0% (48/48)
- Right links by status: matched 48/48

UPI shop sales (receipt matched to its own same-day UPI invoice):
- UPI sales in the statement: 108; matched to an invoice: 108
- Matched to the right invoice: 100.0% (108/108); of all UPI sales: 100.0% (108/108)

- UPI shop sales wrongly turned into collections: 0 of 108
- Credit invoices with the right paid_at (paid date, or still open): 100.0% (164/164)
  - marked paid but not paid by bank: 0; paid by bank but still open: 0
- 25 receipts this month for these invoices were paid in cash (not in the bank), so those invoices correctly stay open here.
- Supplier payments: purchase bills are not in the dataset as PDFs, so none were uploaded; supplier payments are categorized but not linked.

