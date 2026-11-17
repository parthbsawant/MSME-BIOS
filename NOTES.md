# Receivables & Payables

## 1. Feature Overview

The Receivables & Payables feature provides businesses with an overview of their outstanding customer payments and supplier dues.

### Key functionalities
- Track outstanding receivables from customers.
- Track outstanding payables to suppliers.
- Identify overdue invoices and upcoming payments.
- View outstanding amounts grouped by customer or supplier.
- Expand individual parties to view their invoice details.
- Display the net position, calculated as total receivables minus total payables.

### Access and data security
- The feature is protected by the `receivables_payables` feature-access permission.
- Invoice data is scoped using the authenticated tenant and department context.
- Tenant IDs are not accepted from frontend requests.

## 2. Backend Implementation

### Database migration
Migration file: `backend/parser-backend/schema/005_invoice_party_fields.sql`

The migration adds the following invoice fields:
- `direction` – identifies whether the invoice is a sale or purchase.
- `party_name` – stores the customer or supplier name.
- `payment_mode` – identifies credit or other payment modes.
- `due_date` – stores the invoice payment due date.
- `paid_at` – records when an invoice was paid.

### API endpoint

`GET /api/analytics/receivables-payables`

The endpoint:
1. Validates feature access.
2. Retrieves invoices using the authenticated tenant and department context.
3. Calculates receivables and payables.
4. Returns outstanding amounts, overdue amounts, upcoming dues, party details, and net position.

### Calculation logic

Implementation file: `backend/parser-backend/analytics_receivables.py`

- Only unpaid credit invoices are considered open.
- `sale` invoices are classified as receivables.
- `purchase` invoices are classified as payables.
- An invoice is overdue when its due date is earlier than the selected `as_of` date.
- Upcoming dues include invoices due from the `as_of` date through the next seven days.
- Party balances are sorted in descending order of outstanding amount.
- Monetary calculations use Python's `Decimal` type and are formatted to two decimal places.

Net position = Total Receivables − Total Payables.

## 3. Frontend Implementation

### New page
`frontend/msme-bios-frontend/src/pages/ReceivablesPayablesPage.jsx`

The page includes:
- Summary cards for total receivables, total payables, and net position.
- Separate Receivables and Payables tabs.
- Metrics for outstanding amount, overdue amount, upcoming dues, and open invoices.
- Expandable customer and supplier lists.
- Individual invoice details, including invoice number, invoice date, due date, and amount.
- Visual indicators for overdue invoices.
- Loading, error, and retry states.

### Navigation and routing
- Added the `/receivables-payables` route in `App.jsx`.
- Added the feature to the dashboard sidebar in `DashboardLayout.jsx`.
- Updated the feature dashboard to open the new page.
- Added the API helper in `src/lib/api.js`.

### Localization
Updated the dashboard locale files:
- `src/locales/en/dashboard.json`
- `src/locales/hi/dashboard.json`
- `src/locales/mr/dashboard.json`

The new page's interface text is available in English, Hindi, and Marathi.

## 4. Testing and Validation

### Backend tests
The following tests were executed successfully:

| Test category | Result |
|---|---:|
| Receivables calculation | Passed |
| Payables calculation | Passed |
| Party-wise invoice grouping | Passed |
| Tenant data isolation | Passed |
| Subscription-based feature access | Passed |

- Feature-specific tests: **5/5 passed**
- Complete backend test suite: **191/191 passed**

### Frontend validation
- Frontend production build completed successfully using `npm run build`.
- The Receivables & Payables page was tested in the browser.
- Summary cards, tabs, party lists, invoice details, and overdue indicators were verified.
- The frontend build reported a non-blocking warning about the JavaScript bundle size.

### Database validation
- Migration scripts 001–005 were applied to the dedicated development and test databases.
- Synthetic invoice data was seeded for feature validation.
- Tenant-level data isolation was verified.

## 5. Known Limitations and Pending Clarifications

1. **Sales role access:** The feature has not been added to the Sales role, as instructed. Users without the required feature permission will receive a 403 response.

2. **Department-level access testing:** Tenant isolation has been tested. Department-level isolation through the API has not been independently tested because feature access is denied to the Sales role before department-level filtering can be verified.

3. **Existing invoice uploads:** The existing invoice extraction workflow does not yet populate all the newly introduced fields (`direction`, `party_name`, `payment_mode`, `due_date`, and `paid_at`). Consequently, invoices without the required classification and payment details may not appear in the Receivables & Payables dashboard.

4. **Future integration:** The invoice upload and extraction workflow needs to populate these fields for newly uploaded invoices to be included automatically in the dashboard.

## 6. Setup and Execution

### Database setup
Apply migrations 001–005 in order using the existing schema application script.

### Backend
From `backend/parser-backend`:

```powershell
python -m pytest tests/ -v
```

Expected result: 191 tests passed.

### Frontend
From `frontend/msme-bios-frontend`:

```powershell
npm install
npm run build
npm run dev
```

### Development notes
- Tesseract OCR must be installed and available in the system PATH for handwritten-document tests.
- Database credentials and environment variables must be configured locally.
- Do not commit `.env` files, Firebase credentials, or other secrets.

## 7. Handover Notes

- Development was carried out on the `receivables_payables` branch.
- The feature implementation, migration, synthetic test-data script, and automated tests are included in the branch.
- The complete backend test suite passed: **191/191 tests**.
- Frontend production build completed successfully.
- Review the known limitations and pending integration work before merging the feature into the main branch.
