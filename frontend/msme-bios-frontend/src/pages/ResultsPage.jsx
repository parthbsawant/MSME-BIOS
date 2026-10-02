import { useLocation, useNavigate, Navigate } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'

const typeLabels = {
  bank_statement: 'Bank Statement',
  invoice_bill: 'Invoice / Bill',
  photo_bill: 'Handwritten Bill',
}

function money(n) {
  if (n === null || n === undefined) return '—'
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function ResultsPage() {
  const { state } = useLocation()
  const navigate = useNavigate()

  if (!state?.result) return <Navigate to="/upload" replace />

  const { result, documentType, fileName } = state
  const isReviewNeeded = Boolean(result.needs_review)

  return (
    <DashboardLayout activeItem="Documents">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header & Status Badge Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-3xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] p-6 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A7F74] dark:text-[#A89E92] bg-[#FBF3EC] dark:bg-[#1A1714] px-2.5 py-0.5 rounded-full border border-[#F0E4D8] dark:border-[#3A332A]">
                {typeLabels[documentType] || 'Parsed Record'}
              </span>
              <span className="text-xs text-[#8A7F74] dark:text-[#A89E92] font-[family-name:var(--font-data)]">
                {fileName}
              </span>
            </div>
            <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-extrabold text-[#2A2521] dark:text-[#F5EFE8]">
              Parsed Document Results
            </h1>
          </div>

          {/* Status Badge */}
          <div className="self-start sm:self-auto">
            {isReviewNeeded ? (
              <div className="flex items-center gap-2 rounded-full border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 px-3.5 py-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                <span>Needs Review</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-full border border-emerald-300 dark:border-emerald-700 bg-[#E8F5EC] dark:bg-[#132E21] px-3.5 py-1.5 text-xs font-bold text-[#1F9254] dark:text-[#34D399]">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Trusted Document</span>
              </div>
            )}
          </div>
        </div>

        {/* BANK STATEMENT DATA VIEW */}
        {documentType === 'bank_statement' && (
          <div className="space-y-6">
            <div className="rounded-3xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] p-6 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between pb-4 border-b border-[#F0E4D8] dark:border-[#3A332A]">
                <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-[#2A2521] dark:text-[#F5EFE8]">
                  Bank Ledger Transactions
                </h3>
                <span className="text-xs text-[#8A7F74] dark:text-[#A89E92]">
                  {result.transactions?.length || 0} Transactions Found
                </span>
              </div>

              <div className="overflow-x-auto mt-4">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#F0E4D8] dark:border-[#3A332A] text-[#8A7F74] dark:text-[#A89E92] font-semibold">
                      <th className="pb-3 pr-4">Date</th>
                      <th className="pb-3 pr-4">Description</th>
                      <th className="pb-3 px-4 text-right">Debit</th>
                      <th className="pb-3 px-4 text-right">Credit</th>
                      <th className="pb-3 pl-4 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0E4D8] dark:divide-[#3A332A]/50 font-[family-name:var(--font-data)]">
                    {result.transactions?.map((t, i) => (
                      <tr key={i} className={`hover:bg-[#FBF3EC]/50 dark:hover:bg-[#1A1714]/50 transition-colors ${t.needs_review ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}`}>
                        <td className="py-3.5 pr-4 text-[#2A2521] dark:text-[#F5EFE8] font-medium whitespace-nowrap">{t.txn_date}</td>
                        <td className="py-3.5 pr-4 font-[family-name:var(--font-body)] text-[#2A2521] dark:text-[#F5EFE8]">
                          {t.description}
                          {t.needs_review && (
                            <span className="ml-2 inline-block rounded-md bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                              Review: {t.review_reason || 'Check amount'}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right text-red-600 dark:text-red-400 font-semibold">{t.debit ? money(t.debit) : '—'}</td>
                        <td className="py-3.5 px-4 text-right text-[#1F9254] dark:text-[#34D399] font-semibold">{t.credit ? money(t.credit) : '—'}</td>
                        <td className="py-3.5 pl-4 text-right font-bold text-[#2A2521] dark:text-[#F5EFE8]">{money(t.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* INVOICE BILL DATA VIEW */}
        {documentType === 'invoice_bill' && (
          <div className="space-y-6">
            {/* Header Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-3xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] p-6 shadow-sm">
              <div>
                <p className="text-[11px] font-semibold text-[#8A7F74] dark:text-[#A89E92]">Vendor Name</p>
                <p className="mt-1 text-sm font-bold text-[#2A2521] dark:text-[#F5EFE8]">{result.vendor_name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#8A7F74] dark:text-[#A89E92]">Invoice Number</p>
                <p className="mt-1 text-sm font-bold font-[family-name:var(--font-data)] text-[#E8622C] dark:text-[#F27A4A]">{result.invoice_number || 'N/A'}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#8A7F74] dark:text-[#A89E92]">Invoice Date</p>
                <p className="mt-1 text-sm font-bold font-[family-name:var(--font-data)] text-[#2A2521] dark:text-[#F5EFE8]">{result.invoice_date || 'N/A'}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#8A7F74] dark:text-[#A89E92]">GSTIN Number</p>
                <p className="mt-1 text-sm font-bold font-[family-name:var(--font-data)] text-[#2A2521] dark:text-[#F5EFE8]">{result.gstin || 'N/A'}</p>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="rounded-3xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] p-6 shadow-sm overflow-hidden">
              <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-[#2A2521] dark:text-[#F5EFE8] pb-4 border-b border-[#F0E4D8] dark:border-[#3A332A]">
                Line Items Breakdown
              </h3>
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#F0E4D8] dark:border-[#3A332A] text-[#8A7F74] dark:text-[#A89E92] font-semibold">
                      <th className="pb-3 pr-4">Item Description</th>
                      <th className="pb-3 px-4 text-right">Qty</th>
                      <th className="pb-3 px-4 text-right">Rate</th>
                      <th className="pb-3 pl-4 text-right">GST %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0E4D8] dark:divide-[#3A332A]/50 font-[family-name:var(--font-data)]">
                    {result.line_items?.map((item, i) => (
                      <tr key={i}>
                        <td className="py-3.5 pr-4 font-[family-name:var(--font-body)] text-[#2A2521] dark:text-[#F5EFE8] font-medium">{item.description}</td>
                        <td className="py-3.5 px-4 text-right text-[#2A2521] dark:text-[#F5EFE8]">{item.qty}</td>
                        <td className="py-3.5 px-4 text-right text-[#2A2521] dark:text-[#F5EFE8]">{money(item.rate)}</td>
                        <td className="py-3.5 pl-4 text-right text-[#2A2521] dark:text-[#F5EFE8]">{item.gst_pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals Summary */}
              <div className="mt-6 flex justify-end border-t border-[#F0E4D8] dark:border-[#3A332A] pt-4">
                <div className="w-64 space-y-2 text-xs">
                  <div className="flex justify-between text-[#8A7F74] dark:text-[#A89E92]">
                    <span>Subtotal</span>
                    <span className="font-[family-name:var(--font-data)] font-semibold text-[#2A2521] dark:text-[#F5EFE8]">{money(result.subtotal)}</span>
                  </div>
                  <div className="flex justify-between items-center rounded-xl bg-[#E8622C]/10 dark:bg-[#F27A4A]/15 p-3 font-bold text-sm text-[#E8622C] dark:text-[#F27A4A]">
                    <span>Grand Total</span>
                    <span className="font-[family-name:var(--font-data)] text-base">{money(result.total)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* HANDWRITTEN PHOTO BILL VIEW */}
        {documentType === 'photo_bill' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 rounded-3xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] p-6 shadow-sm">
              <div>
                <p className="text-[11px] font-semibold text-[#8A7F74] dark:text-[#A89E92]">Vendor / Customer</p>
                <p className="mt-1 text-sm font-bold text-[#2A2521] dark:text-[#F5EFE8]">{result.vendor_or_customer_name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#8A7F74] dark:text-[#A89E92]">Bill Date</p>
                <p className="mt-1 text-sm font-bold font-[family-name:var(--font-data)] text-[#2A2521] dark:text-[#F5EFE8]">{result.bill_date || 'N/A'}</p>
              </div>
            </div>

            <div className="rounded-3xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] p-6 shadow-sm overflow-hidden">
              <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-[#2A2521] dark:text-[#F5EFE8] pb-4 border-b border-[#F0E4D8] dark:border-[#3A332A]">
                Extracted Line Items (AI Vision)
              </h3>
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#F0E4D8] dark:border-[#3A332A] text-[#8A7F74] dark:text-[#A89E92] font-semibold">
                      <th className="pb-3 pr-4">Item</th>
                      <th className="pb-3 px-4 text-right">Qty</th>
                      <th className="pb-3 px-4 text-right">Amount</th>
                      <th className="pb-3 pl-4 text-right">AI Confidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0E4D8] dark:divide-[#3A332A]/50 font-[family-name:var(--font-data)]">
                    {result.line_items?.map((item, i) => (
                      <tr key={i}>
                        <td className="py-3.5 pr-4 font-[family-name:var(--font-body)] text-[#2A2521] dark:text-[#F5EFE8] font-medium">{item.description}</td>
                        <td className="py-3.5 px-4 text-right text-[#2A2521] dark:text-[#F5EFE8]">{item.qty}</td>
                        <td className="py-3.5 px-4 text-right font-bold text-[#2A2521] dark:text-[#F5EFE8]">{money(item.amount)}</td>
                        <td className="py-3.5 pl-4 text-right">
                          <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            item.confidence === 'low'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          }`}>
                            {item.confidence || 'high'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-end border-t border-[#F0E4D8] dark:border-[#3A332A] pt-4">
                <div className="w-64 flex justify-between items-center rounded-xl bg-[#E8622C]/10 dark:bg-[#F27A4A]/15 p-3 font-bold text-sm text-[#E8622C] dark:text-[#F27A4A]">
                  <span>Total Amount</span>
                  <span className="font-[family-name:var(--font-data)] text-base">{money(result.total)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* BOTTOM ACTION BUTTONS */}
        <div className="flex items-center justify-between pt-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="rounded-xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] px-5 py-2.5 text-xs font-bold text-[#2A2521] dark:text-[#F5EFE8] hover:border-[#E8622C] transition-colors cursor-pointer"
          >
            &larr; Back to Dashboard
          </button>

          <button
            onClick={() => navigate('/upload')}
            className="flex items-center gap-2 rounded-xl bg-[#E8622C] dark:bg-[#F27A4A] px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-[#E8622C]/20 hover:bg-[#D4531F] dark:hover:bg-[#E56938] transition-all transform active:scale-95 cursor-pointer"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            <span>Upload Another Document</span>
          </button>
        </div>

      </div>
    </DashboardLayout>
  )
}
