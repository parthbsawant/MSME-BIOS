import { useLocation, useNavigate, Navigate } from 'react-router-dom'
import Navbar from '../components/Navbar'

const typeLabels = {
  bank_statement: 'Bank statement',
  invoice_bill: 'Invoice / bill',
  photo_bill: 'Handwritten bill',
}

function money(n) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function ResultsPage() {
  const { state } = useLocation()
  const navigate = useNavigate()

  if (!state?.result) return <Navigate to="/upload" replace />

  const { result, documentType, fileName } = state

  return (
    <div className="min-h-screen bg-white text-black dark:bg-black dark:text-white transition-colors">
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 py-14">
        <div className="border border-black/15 bg-black/[0.03] px-4 py-2 text-xs dark:border-white/15 dark:bg-white/[0.03]">
          Demo output — this is placeholder data, not a live parser result yet.
        </div>

        <div className="mt-8 flex items-baseline justify-between">
          <div>
            <p className="font-[family-name:var(--font-data)] text-xs text-black/40 dark:text-white/40">{typeLabels[documentType]}</p>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight mt-1">{fileName}</h1>
          </div>
          <span className={`font-[family-name:var(--font-data)] text-xs px-2 py-1 border ${
            result.needs_review ? 'border-black/40 text-black/70 dark:border-white/40 dark:text-white/70' : 'border-black/20 text-black/50 dark:border-white/20 dark:text-white/50'
          }`}>
            {result.needs_review ? 'Needs review' : 'Trusted'}
          </span>
        </div>

        {documentType === 'bank_statement' && (
          <table className="mt-10 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/15 dark:border-white/15 text-black/50 dark:text-white/50">
                <th className="pb-3 font-medium">Date</th>
                <th className="pb-3 font-medium">Description</th>
                <th className="pb-3 pl-4 font-medium text-right">Debit</th>
                <th className="pb-3 pl-4 font-medium text-right">Credit</th>
                <th className="pb-3 pl-4 font-medium text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="font-[family-name:var(--font-data)]">
              {result.transactions.map((t, i) => (
                <tr key={i} className={`border-b border-black/10 dark:border-white/10 ${t.needs_review ? 'bg-black/[0.03] dark:bg-white/[0.05]' : ''}`}>
                  <td className="py-3 pr-4">{t.txn_date}</td>
                  <td className="py-3 pr-4 font-[family-name:var(--font-body)]">
                    {t.description}
                    {t.needs_review && (
                      <span className="ml-2 font-[family-name:var(--font-data)] text-[10px] text-black/50 dark:text-white/50">
                        needs review{t.review_reason ? ` — ${t.review_reason}` : ''}
                      </span>
                    )}
                  </td>
                  <td className="py-3 pl-4 text-right">{t.debit ? money(t.debit) : '—'}</td>
                  <td className="py-3 pl-4 text-right">{t.credit ? money(t.credit) : '—'}</td>
                  <td className="py-3 pl-4 text-right">{money(t.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {documentType === 'invoice_bill' && (
          <div className="mt-10">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-black/50 dark:text-white/50">Vendor</p><p className="mt-1">{result.vendor_name}</p></div>
              <div><p className="text-black/50 dark:text-white/50">Invoice number</p><p className="mt-1 font-[family-name:var(--font-data)]">{result.invoice_number}</p></div>
              <div><p className="text-black/50 dark:text-white/50">Date</p><p className="mt-1 font-[family-name:var(--font-data)]">{result.invoice_date}</p></div>
              <div><p className="text-black/50 dark:text-white/50">GSTIN</p><p className="mt-1">{result.gstin}</p></div>
            </div>
            <table className="mt-8 w-full text-left text-sm">
              <thead>
                <tr className="border-b border-black/15 dark:border-white/15 text-black/50 dark:text-white/50">
                  <th className="pb-3 font-medium">Item</th>
                  <th className="pb-3 pl-4 font-medium text-right">Qty</th>
                  <th className="pb-3 pl-4 font-medium text-right">Rate</th>
                  <th className="pb-3 pl-4 font-medium text-right">GST %</th>
                </tr>
              </thead>
              <tbody className="font-[family-name:var(--font-data)]">
                {result.line_items.map((item, i) => (
                  <tr key={i} className="border-b border-black/10 dark:border-white/10">
                    <td className="py-3 pr-4 font-[family-name:var(--font-body)]">{item.description}</td>
                    <td className="py-3 pl-4 text-right">{item.qty}</td>
                    <td className="py-3 pl-4 text-right">{money(item.rate)}</td>
                    <td className="py-3 pl-4 text-right">{item.gst_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-6 flex justify-end">
              <div className="w-48 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-black/50 dark:text-white/50">Subtotal</span><span className="font-[family-name:var(--font-data)]">{money(result.subtotal)}</span></div>
                <div className="flex justify-between border-t border-black/15 dark:border-white/15 pt-1 font-medium"><span>Total</span><span className="font-[family-name:var(--font-data)]">{money(result.total)}</span></div>
              </div>
            </div>
          </div>
        )}

        {documentType === 'photo_bill' && (
          <div className="mt-10">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-black/50 dark:text-white/50">Vendor / customer</p><p className="mt-1">{result.vendor_or_customer_name}</p></div>
              <div><p className="text-black/50 dark:text-white/50">Date</p><p className="mt-1 font-[family-name:var(--font-data)]">{result.bill_date}</p></div>
            </div>
            <table className="mt-8 w-full text-left text-sm">
              <thead>
                <tr className="border-b border-black/15 dark:border-white/15 text-black/50 dark:text-white/50">
                  <th className="pb-3 font-medium">Item</th>
                  <th className="pb-3 pl-4 font-medium text-right">Qty</th>
                  <th className="pb-3 pl-4 font-medium text-right">Amount</th>
                  <th className="pb-3 pl-4 font-medium text-right">Confidence</th>
                </tr>
              </thead>
              <tbody className="font-[family-name:var(--font-data)]">
                {result.line_items.map((item, i) => (
                  <tr key={i} className="border-b border-black/10 dark:border-white/10">
                    <td className="py-3 pr-4 font-[family-name:var(--font-body)]">{item.description}</td>
                    <td className="py-3 pl-4 text-right">{item.qty}</td>
                    <td className="py-3 pl-4 text-right">{money(item.amount)}</td>
                    <td className={`py-3 pl-4 text-right ${item.confidence === 'low' ? 'text-black/40 dark:text-white/40' : ''}`}>{item.confidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-6 flex justify-end">
              <div className="w-48 flex justify-between border-t border-black/15 dark:border-white/15 pt-1 text-sm font-medium">
                <span>Total</span><span className="font-[family-name:var(--font-data)]">{money(result.total)}</span>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={() => navigate('/upload')}
          className="mt-12 text-sm font-medium border border-black dark:border-white px-4 py-2 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
        >
          Upload another document
        </button>
      </main>
    </div>
  )
}
