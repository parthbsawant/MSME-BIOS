// The single source of truth for every feature shown across the landing
// page, the custom builder, and the feature dashboard. Prices are
// deliberately illustrative placeholders, not real figures - flagged
// wherever they're shown in the UI.

export const FEATURES = [
  {
    id: 'document_parser',
    name: 'Document parser',
    tagline: 'Read once, understood forever',
    description: 'Turns bank statements, invoices, and handwritten bills into structured records automatically.',
    price: 1499,
    locked: true, // included in every plan, can't be removed in the custom builder
  },
  {
    id: 'cash_dashboard',
    name: 'Cash dashboard',
    tagline: 'Know your position, daily',
    description: 'A live view of cash and bank balances, updated as transactions come in.',
    price: 999,
  },
  {
    id: 'invoice_generator',
    name: 'Invoice generator',
    tagline: 'GST-correct, in seconds',
    description: 'Create compliant invoices with correct CGST/SGST splits, ready to send.',
    price: 1299,
  },
  {
    id: 'receivables_payables',
    name: 'Receivables & payables',
    tagline: 'Know who owes whom',
    description: 'Track outstanding customer payments and supplier dues in one place.',
    price: 1499,
  },
  {
    id: 'pnl_statement',
    name: 'P&L statement',
    tagline: 'Profit, without the spreadsheet',
    description: 'An automatically generated profit and loss statement from your real transactions.',
    price: 999,
  },
  {
    id: 'aging_reports',
    name: 'Aging reports',
    tagline: 'See what\u2019s overdue, at a glance',
    description: 'Breaks down outstanding amounts by how long they\u2019ve been unpaid.',
    price: 799,
  },
  {
    id: 'anomaly_detection',
    name: 'Anomaly detection',
    tagline: 'Catch what looks wrong',
    description: 'Flags unusual transactions automatically, before they become a problem.',
    price: 2499,
  },
  {
    id: 'business_health_index',
    name: 'Business health index',
    tagline: 'One score, the full picture',
    description: 'A single score summarizing how the business is doing, updated continuously.',
    price: 1999,
  },
  {
    id: 'revenue_concentration',
    name: 'Revenue concentration',
    tagline: 'Know your real dependencies',
    description: 'Shows how much of your revenue depends on your top few customers.',
    price: 1299,
  },
  {
    id: 'demand_forecasting',
    name: 'Demand forecasting',
    tagline: 'See next month, today',
    description: 'Predicts upcoming demand based on historical sales patterns.',
    price: 2999,
  },
  {
    id: 'cash_flow_simulator',
    name: 'Cash flow simulator',
    tagline: 'Test decisions before you make them',
    description: 'Model the cash impact of a big purchase, hire, or slow month before it happens.',
    price: 2499,
  },
  {
    id: 'whatsapp_alerts',
    name: 'WhatsApp alerts',
    tagline: 'The news finds you',
    description: 'Get notified on WhatsApp when something needs your attention.',
    price: 599,
  },
]

export const featureById = (id) => FEATURES.find((f) => f.id === id)

export const TIERS = [
  {
    id: 'starter',
    name: 'Starter',
    band: '\u20b95L\u201350L turnover',
    price: 2999,
    featureIds: ['document_parser', 'cash_dashboard', 'invoice_generator'],
  },
  {
    id: 'growth',
    name: 'Growth',
    band: '\u20b950L\u20135Cr turnover',
    price: 6999,
    featureIds: ['document_parser', 'cash_dashboard', 'invoice_generator', 'receivables_payables', 'pnl_statement', 'aging_reports'],
  },
  {
    id: 'intelligence',
    name: 'Intelligence',
    band: '\u20b95Cr\u201320Cr turnover',
    price: 14999,
    featureIds: ['document_parser', 'cash_dashboard', 'invoice_generator', 'receivables_payables', 'pnl_statement', 'aging_reports', 'anomaly_detection', 'business_health_index', 'revenue_concentration'],
  },
  {
    id: 'full_suite',
    name: 'Full suite',
    band: '\u20b920Cr\u201350Cr turnover',
    price: 24999,
    featureIds: FEATURES.map((f) => f.id),
  },
]

export function formatPrice(n) {
  return `\u20b9${n.toLocaleString('en-IN')}`
}
