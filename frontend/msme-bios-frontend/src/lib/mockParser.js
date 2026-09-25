// Generates DEMO results only - no backend is connected yet. The shape
// of this data matches the real Python parsers' actual output exactly
// (ParserResult and its per-parser extensions), so swapping this for a
// real fetch() call later is a drop-in replacement, not a redesign.

export function generateMockResult(documentType, fileName) {
  const extractedAt = new Date().toISOString()

  if (documentType === 'bank_statement') {
    return {
      source_type: 'bank_statement',
      source_file: fileName,
      extraction_method: 'structured',
      needs_review: true,
      extracted_at: extractedAt,
      transactions: [
        { txn_date: '2025-04-01', description: 'Opening Balance', debit: 0, credit: 0, balance: 40978.99, needs_review: false },
        { txn_date: '2025-04-02', description: 'ATM WDL-ATM CASH', debit: 10000, credit: 0, balance: 30978.99, needs_review: false },
        { txn_date: '2025-04-05', description: 'BY TRANSFER-UPI/CR/ASHOK SHARMA', debit: 0, credit: 26551.53, balance: 57530.52, needs_review: false },
        { txn_date: '2025-04-11', description: 'TO TRANSFER-UPI/DR/SANJAY GUPTA', debit: 43416.14, credit: 0, balance: 14114.38, needs_review: true, review_reason: 'Balance does not reconcile with the previous row' },
      ],
    }
  }

  if (documentType === 'invoice_bill') {
    return {
      source_type: 'invoice_bill',
      source_file: fileName,
      extraction_method: 'structured',
      needs_review: false,
      extracted_at: extractedAt,
      vendor_name: 'Sharma Caterers',
      invoice_number: '00446/25-26',
      invoice_date: '2025-04-20',
      gstin: 'Unregistered Dealer',
      line_items: [
        { description: 'Ambemohar Type Rice 25kg', qty: 2, rate: 1650, gst_pct: 0 },
      ],
      subtotal: 3300,
      cgst_amount: 0,
      sgst_amount: 0,
      total: 3300,
    }
  }

  return {
    source_type: 'photo_bill',
    source_file: fileName,
    extraction_method: 'structured',
    needs_review: false,
    extracted_at: extractedAt,
    vendor_or_customer_name: 'Shree Ganesh Stores',
    bill_date: '2026-09-14',
    line_items: [
      { description: 'Rice (Indrayani)', qty: 5, rate: 60, amount: 300, confidence: 'high' },
      { description: 'Wheat Flour (Aatta)', qty: 2, rate: 50, amount: 100, confidence: 'high' },
      { description: 'Sugar', qty: 1, rate: 45, amount: 45, confidence: 'high' },
      { description: 'Tea (Tata)', qty: 0.25, rate: 480, amount: 120, confidence: 'low' },
    ],
    total: 1071,
  }
}
