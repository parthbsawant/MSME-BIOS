import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import DashboardLayout from '../components/DashboardLayout'
import { getDocument } from '../lib/api'

function money(n) {
  if (n === null || n === undefined) return '—'
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function ResultsPage() {
  const { t } = useTranslation('results')
  const { state } = useLocation()
  const { documentId } = useParams()
  const navigate = useNavigate()

  // Straight after an upload the result arrives in router state, so it
  // shows instantly. On a refresh, bookmark or new tab that state is gone,
  // so the saved document is loaded from the backend by its id instead.
  const fromUpload = state?.result && (!documentId || state.result.document_id === documentId) ? state.result : null
  const [loaded, setLoaded] = useState(null)
  const [loadError, setLoadError] = useState(null) // 'notFound' | 'loadFailed'

  useEffect(() => {
    if (fromUpload || !documentId) return
    let cancelled = false
    setLoaded(null)
    setLoadError(null)
    getDocument(documentId)
      .then((doc) => {
        if (!cancelled) setLoaded(doc)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.status === 404 ? 'notFound' : 'loadFailed')
      })
    return () => {
      cancelled = true
    }
  }, [documentId, Boolean(fromUpload)])

  if (!documentId && !fromUpload) return <Navigate to="/upload" replace />

  const result = fromUpload || loaded
  if (!result) {
    return (
      <DashboardLayout activeItem="Documents">
        <div className="max-w-4xl mx-auto rounded-3xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] p-10 shadow-sm text-center">
          {loadError ? (
            <>
              <p className="text-sm font-semibold text-[#2A2521] dark:text-[#F5EFE8]">{t(loadError)}</p>
              <button
                onClick={() => navigate('/upload')}
                className="mt-6 rounded-xl bg-[#E8622C] dark:bg-[#F27A4A] px-6 py-2.5 text-xs font-bold text-white hover:bg-[#D4531F] dark:hover:bg-[#E56938] transition-colors cursor-pointer"
              >
                {t('another')}
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 rounded-full border-4 border-[#E8622C]/20 border-t-[#E8622C] dark:border-[#F27A4A]/20 dark:border-t-[#F27A4A] animate-spin" />
              <p className="text-xs font-semibold text-[#8A7F74] dark:text-[#A89E92]">{t('loading')}</p>
            </div>
          )}
        </div>
      </DashboardLayout>
    )
  }

  const documentType = result.source_type || state?.documentType
  const fileName = result.source_file || state?.fileName
  const isReviewNeeded = Boolean(result.needs_review)

  return (
    <DashboardLayout activeItem="Documents">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header & Status Badge Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-3xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] p-6 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A7F74] dark:text-[#A89E92] bg-[#FBF3EC] dark:bg-[#1A1714] px-2.5 py-0.5 rounded-full border border-[#F0E4D8] dark:border-[#3A332A]">
                {documentType ? t(`types.${documentType}`, { defaultValue: t('parsedRecord') }) : t('parsedRecord')}
              </span>
              <span className="text-xs text-[#8A7F74] dark:text-[#A89E92] font-[family-name:var(--font-data)]">
                {fileName}
              </span>
            </div>
            <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-extrabold text-[#2A2521] dark:text-[#F5EFE8]">
              {t('title')}
            </h1>
          </div>

          {/* Status Badge */}
          <div className="self-start sm:self-auto">
            {isReviewNeeded ? (
              <div className="flex items-center gap-2 rounded-full border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 px-3.5 py-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                <span>{t('status.needsReview')}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-full border border-emerald-300 dark:border-emerald-700 bg-[#E8F5EC] dark:bg-[#132E21] px-3.5 py-1.5 text-xs font-bold text-[#1F9254] dark:text-[#34D399]">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                <span>{t('status.trusted')}</span>
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
                  {t('bank.title')}
                </h3>
                <span className="text-xs text-[#8A7F74] dark:text-[#A89E92]">
                  {t('bank.count', { n: result.transactions?.length || 0 })}
                </span>
              </div>

              <div className="overflow-x-auto mt-4">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#F0E4D8] dark:border-[#3A332A] text-[#8A7F74] dark:text-[#A89E92] font-semibold">
                      <th className="pb-3 pr-4">{t('bank.cols.date')}</th>
                      <th className="pb-3 pr-4">{t('bank.cols.description')}</th>
                      <th className="pb-3 px-4 text-right">{t('bank.cols.debit')}</th>
                      <th className="pb-3 px-4 text-right">{t('bank.cols.credit')}</th>
                      <th className="pb-3 pl-4 text-right">{t('bank.cols.balance')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0E4D8] dark:divide-[#3A332A]/50 font-[family-name:var(--font-data)]">
                    {result.transactions?.map((row, i) => (
                      <tr key={i} className={`hover:bg-[#FBF3EC]/50 dark:hover:bg-[#1A1714]/50 transition-colors ${row.needs_review ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}`}>
                        <td className="py-3.5 pr-4 text-[#2A2521] dark:text-[#F5EFE8] font-medium whitespace-nowrap">{row.txn_date}</td>
                        <td className="py-3.5 pr-4 font-[family-name:var(--font-body)] text-[#2A2521] dark:text-[#F5EFE8]">
                          {row.description}
                          {row.needs_review && (
                            <span className="ml-2 inline-block rounded-md bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                              {t('bank.review', { reason: row.review_reason || t('bank.checkAmount') })}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right text-red-600 dark:text-red-400 font-semibold">{row.debit ? money(row.debit) : '—'}</td>
                        <td className="py-3.5 px-4 text-right text-[#1F9254] dark:text-[#34D399] font-semibold">{row.credit ? money(row.credit) : '—'}</td>
                        <td className="py-3.5 pl-4 text-right font-bold text-[#2A2521] dark:text-[#F5EFE8]">{money(row.balance)}</td>
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
                <p className="text-[11px] font-semibold text-[#8A7F74] dark:text-[#A89E92]">{t('invoice.vendor')}</p>
                <p className="mt-1 text-sm font-bold text-[#2A2521] dark:text-[#F5EFE8]">{result.vendor_name || t('na')}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#8A7F74] dark:text-[#A89E92]">{t('invoice.number')}</p>
                <p className="mt-1 text-sm font-bold font-[family-name:var(--font-data)] text-[#E8622C] dark:text-[#F27A4A]">{result.invoice_number || t('na')}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#8A7F74] dark:text-[#A89E92]">{t('invoice.date')}</p>
                <p className="mt-1 text-sm font-bold font-[family-name:var(--font-data)] text-[#2A2521] dark:text-[#F5EFE8]">{result.invoice_date || t('na')}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#8A7F74] dark:text-[#A89E92]">{t('invoice.gstin')}</p>
                <p className="mt-1 text-sm font-bold font-[family-name:var(--font-data)] text-[#2A2521] dark:text-[#F5EFE8]">{result.gstin || t('na')}</p>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="rounded-3xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] p-6 shadow-sm overflow-hidden">
              <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-[#2A2521] dark:text-[#F5EFE8] pb-4 border-b border-[#F0E4D8] dark:border-[#3A332A]">
                {t('invoice.lineItems')}
              </h3>
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#F0E4D8] dark:border-[#3A332A] text-[#8A7F74] dark:text-[#A89E92] font-semibold">
                      <th className="pb-3 pr-4">{t('invoice.cols.item')}</th>
                      <th className="pb-3 px-4 text-right">{t('invoice.cols.qty')}</th>
                      <th className="pb-3 px-4 text-right">{t('invoice.cols.rate')}</th>
                      <th className="pb-3 pl-4 text-right">{t('invoice.cols.gst')}</th>
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
                    <span>{t('invoice.subtotal')}</span>
                    <span className="font-[family-name:var(--font-data)] font-semibold text-[#2A2521] dark:text-[#F5EFE8]">{money(result.subtotal)}</span>
                  </div>
                  <div className="flex justify-between items-center rounded-xl bg-[#E8622C]/10 dark:bg-[#F27A4A]/15 p-3 font-bold text-sm text-[#E8622C] dark:text-[#F27A4A]">
                    <span>{t('invoice.grandTotal')}</span>
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
                <p className="text-[11px] font-semibold text-[#8A7F74] dark:text-[#A89E92]">{t('photo.vendorOrCustomer')}</p>
                <p className="mt-1 text-sm font-bold text-[#2A2521] dark:text-[#F5EFE8]">{result.vendor_or_customer_name || t('na')}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#8A7F74] dark:text-[#A89E92]">{t('photo.billDate')}</p>
                <p className="mt-1 text-sm font-bold font-[family-name:var(--font-data)] text-[#2A2521] dark:text-[#F5EFE8]">{result.bill_date || t('na')}</p>
              </div>
            </div>

            <div className="rounded-3xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] p-6 shadow-sm overflow-hidden">
              <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-[#2A2521] dark:text-[#F5EFE8] pb-4 border-b border-[#F0E4D8] dark:border-[#3A332A]">
                {t('photo.extracted')}
              </h3>
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#F0E4D8] dark:border-[#3A332A] text-[#8A7F74] dark:text-[#A89E92] font-semibold">
                      <th className="pb-3 pr-4">{t('photo.cols.item')}</th>
                      <th className="pb-3 px-4 text-right">{t('photo.cols.qty')}</th>
                      <th className="pb-3 px-4 text-right">{t('photo.cols.amount')}</th>
                      <th className="pb-3 pl-4 text-right">{t('photo.cols.confidence')}</th>
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
                            {t(`photo.confidence.${item.confidence === 'low' ? 'low' : 'high'}`)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-end border-t border-[#F0E4D8] dark:border-[#3A332A] pt-4">
                <div className="w-64 flex justify-between items-center rounded-xl bg-[#E8622C]/10 dark:bg-[#F27A4A]/15 p-3 font-bold text-sm text-[#E8622C] dark:text-[#F27A4A]">
                  <span>{t('photo.totalAmount')}</span>
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
            &larr; {t('back')}
          </button>

          <button
            onClick={() => navigate('/upload')}
            className="flex items-center gap-2 rounded-xl bg-[#E8622C] dark:bg-[#F27A4A] px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-[#E8622C]/20 hover:bg-[#D4531F] dark:hover:bg-[#E56938] transition-all transform active:scale-95 cursor-pointer"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            <span>{t('another')}</span>
          </button>
        </div>

      </div>
    </DashboardLayout>
  )
}
