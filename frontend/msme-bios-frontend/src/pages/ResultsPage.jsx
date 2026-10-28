import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Plus,
  Loader2,
} from 'lucide-react'
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

  const hasUpload = Boolean(fromUpload)
  useEffect(() => {
    if (hasUpload || !documentId) return
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
  }, [documentId, hasUpload])

  if (!documentId && !fromUpload) return <Navigate to="/upload" replace />

  const result = fromUpload || loaded
  if (!result) {
    return (
      <DashboardLayout activeItem="Documents">
        <div className="max-w-4xl mx-auto rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-12 shadow-sm text-center">
          {loadError ? (
            <>
              <p className="text-sm font-semibold text-[var(--color-text)]">{t(loadError)}</p>
              <button
                onClick={() => navigate('/upload')}
                className="mt-6 rounded-xl bg-[var(--color-accent)] px-6 py-2.5 text-xs font-bold text-white hover:bg-[var(--color-accent-hover)] transition-all cursor-pointer shadow-xs"
              >
                {t('another')}
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--color-accent)]" strokeWidth={2} />
              <p className="text-xs font-semibold text-[var(--color-muted)]">{t('loading')}</p>
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-6 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)] bg-[var(--color-surface-2)] dark:bg-[#1C222B] px-2.5 py-0.5 rounded-full border border-[var(--color-line)] dark:border-[#272F3A]">
                {documentType ? t(`types.${documentType}`, { defaultValue: t('parsedRecord') }) : t('parsedRecord')}
              </span>
              <span className="text-xs text-[var(--color-muted)] font-[family-name:var(--font-data)] truncate max-w-[200px] sm:max-w-xs">
                {fileName}
              </span>
            </div>
            <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-extrabold text-[var(--color-text)] tracking-tight">
              {t('title')}
            </h1>
          </div>

          {/* Status Badge */}
          <div className="self-start sm:self-auto">
            {isReviewNeeded ? (
              <div className="flex items-center gap-2 rounded-full border border-[#FDE1C3] dark:border-[#523A20] bg-[#FFF1E0] dark:bg-[#3A2A18] px-3.5 py-1.5 text-xs font-bold text-[#FF8A1F] dark:text-[#FFA040]">
                <AlertTriangle className="h-4 w-4" strokeWidth={2.2} />
                <span>{t('status.needsReview')}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-full border border-[#C2EDD5] dark:border-[#1E4A3F] bg-[#E3F6EC] dark:bg-[#12302A] px-3.5 py-1.5 text-xs font-bold text-[#12A06B] dark:text-[#34D399]">
                <CheckCircle2 className="h-4 w-4" strokeWidth={2.2} />
                <span>{t('status.trusted')}</span>
              </div>
            )}
          </div>
        </div>

        {/* BANK STATEMENT DATA VIEW */}
        {documentType === 'bank_statement' && (
          <div className="space-y-6">
            <div className="rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-6 shadow-xs overflow-hidden">
              <div className="flex items-center justify-between pb-4 border-b border-[var(--color-line)] dark:border-[#272F3A]">
                <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-[var(--color-text)]">
                  {t('bank.title')}
                </h3>
                <span className="text-xs text-[var(--color-muted)] tabular-nums font-medium">
                  {t('bank.count', { n: result.transactions?.length || 0 })}
                </span>
              </div>

              <div className="overflow-x-auto mt-4 rounded-xl border border-[var(--color-line)] dark:border-[#272F3A]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--color-surface-2)] dark:bg-[#1C222B] text-[var(--color-text)]">
                    <tr className="border-b border-[var(--color-line)] dark:border-[#272F3A] font-semibold">
                      <th className="py-3 px-4">{t('bank.cols.date')}</th>
                      <th className="py-3 px-4">{t('bank.cols.description')}</th>
                      <th className="py-3 px-4 text-right">{t('bank.cols.debit')}</th>
                      <th className="py-3 px-4 text-right">{t('bank.cols.credit')}</th>
                      <th className="py-3 px-4 text-right">{t('bank.cols.balance')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-line)]/70 dark:divide-[#272F3A]/70 font-[family-name:var(--font-data)]">
                    {result.transactions?.map((row, i) => (
                      <tr
                        key={i}
                        className={`hover:bg-[var(--color-surface-2)]/60 dark:hover:bg-[#1C222B]/60 transition-colors duration-250 ${
                          row.needs_review ? 'bg-[#FFF1E0]/50 dark:bg-[#3A2A18]/50' : ''
                        }`}
                      >
                        <td className="py-3.5 px-4 text-[var(--color-text)] font-medium whitespace-nowrap tabular-nums">
                          {row.txn_date}
                        </td>
                        <td className="py-3.5 px-4 font-[family-name:var(--font-body)] text-[var(--color-text)]">
                          {row.description}
                          {row.needs_review && (
                            <span className="ml-2 inline-block rounded-md bg-[#FFF1E0] dark:bg-[#3A2A18] border border-[#FDE1C3] dark:border-[#523A20] px-2 py-0.5 text-[10px] font-bold text-[#FF8A1F] dark:text-[#FFA040]">
                              {t('bank.review', { reason: row.review_reason || t('bank.checkAmount') })}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right text-[var(--color-danger)] font-semibold tabular-nums">
                          {row.debit ? money(row.debit) : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right text-[var(--color-success)] font-semibold tabular-nums">
                          {row.credit ? money(row.credit) : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-[var(--color-text)] tabular-nums">
                          {money(row.balance)}
                        </td>
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-6 shadow-xs">
              <div>
                <p className="text-[11px] font-semibold text-[var(--color-muted)]">{t('invoice.vendor')}</p>
                <p className="mt-1 text-sm font-bold text-[var(--color-text)] truncate">{result.vendor_name || t('na')}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[var(--color-muted)]">{t('invoice.number')}</p>
                <p className="mt-1 text-sm font-bold font-[family-name:var(--font-data)] text-[var(--color-accent)] truncate">
                  {result.invoice_number || t('na')}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[var(--color-muted)]">{t('invoice.date')}</p>
                <p className="mt-1 text-sm font-bold font-[family-name:var(--font-data)] text-[var(--color-text)]">
                  {result.invoice_date || t('na')}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[var(--color-muted)]">{t('invoice.gstin')}</p>
                <p className="mt-1 text-sm font-bold font-[family-name:var(--font-data)] text-[var(--color-text)] truncate">
                  {result.gstin || t('na')}
                </p>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-6 shadow-xs overflow-hidden">
              <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-[var(--color-text)] pb-4 border-b border-[var(--color-line)] dark:border-[#272F3A]">
                {t('invoice.lineItems')}
              </h3>
              <div className="overflow-x-auto mt-4 rounded-xl border border-[var(--color-line)] dark:border-[#272F3A]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--color-surface-2)] dark:bg-[#1C222B] text-[var(--color-text)]">
                    <tr className="border-b border-[var(--color-line)] dark:border-[#272F3A] font-semibold">
                      <th className="py-3 px-4">{t('invoice.cols.item')}</th>
                      <th className="py-3 px-4 text-right">{t('invoice.cols.qty')}</th>
                      <th className="py-3 px-4 text-right">{t('invoice.cols.rate')}</th>
                      <th className="py-3 px-4 text-right">{t('invoice.cols.gst')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-line)]/70 dark:divide-[#272F3A]/70 font-[family-name:var(--font-data)]">
                    {result.line_items?.map((item, i) => (
                      <tr key={i} className="hover:bg-[var(--color-surface-2)]/60 dark:hover:bg-[#1C222B]/60 transition-colors duration-250">
                        <td className="py-3.5 px-4 font-[family-name:var(--font-body)] text-[var(--color-text)] font-medium">
                          {item.description}
                        </td>
                        <td className="py-3.5 px-4 text-right text-[var(--color-text)] tabular-nums">{item.qty}</td>
                        <td className="py-3.5 px-4 text-right text-[var(--color-text)] tabular-nums">{money(item.rate)}</td>
                        <td className="py-3.5 px-4 text-right text-[var(--color-text)] tabular-nums">{item.gst_pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals Summary */}
              <div className="mt-6 flex justify-end border-t border-[var(--color-line)] dark:border-[#272F3A] pt-4">
                <div className="w-64 space-y-2 text-xs">
                  <div className="flex justify-between text-[var(--color-muted)]">
                    <span>{t('invoice.subtotal')}</span>
                    <span className="font-[family-name:var(--font-data)] font-semibold text-[var(--color-text)] tabular-nums">
                      {money(result.subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center rounded-2xl bg-[#E4ECFF] dark:bg-[#16213A] border border-[#C8D6F2] dark:border-[#223152] p-3 font-bold text-sm text-[var(--color-accent)]">
                    <span>{t('invoice.grandTotal')}</span>
                    <span className="font-[family-name:var(--font-data)] text-base tabular-nums">
                      {money(result.total)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* HANDWRITTEN PHOTO BILL VIEW */}
        {documentType === 'photo_bill' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-6 shadow-xs">
              <div>
                <p className="text-[11px] font-semibold text-[var(--color-muted)]">{t('photo.vendorOrCustomer')}</p>
                <p className="mt-1 text-sm font-bold text-[var(--color-text)] truncate">
                  {result.vendor_or_customer_name || t('na')}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[var(--color-muted)]">{t('photo.billDate')}</p>
                <p className="mt-1 text-sm font-bold font-[family-name:var(--font-data)] text-[var(--color-text)]">
                  {result.bill_date || t('na')}
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-6 shadow-xs overflow-hidden">
              <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-[var(--color-text)] pb-4 border-b border-[var(--color-line)] dark:border-[#272F3A]">
                {t('photo.extracted')}
              </h3>
              <div className="overflow-x-auto mt-4 rounded-xl border border-[var(--color-line)] dark:border-[#272F3A]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--color-surface-2)] dark:bg-[#1C222B] text-[var(--color-text)]">
                    <tr className="border-b border-[var(--color-line)] dark:border-[#272F3A] font-semibold">
                      <th className="py-3 px-4">{t('photo.cols.item')}</th>
                      <th className="py-3 px-4 text-right">{t('photo.cols.qty')}</th>
                      <th className="py-3 px-4 text-right">{t('photo.cols.amount')}</th>
                      <th className="py-3 px-4 text-right">{t('photo.cols.confidence')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-line)]/70 dark:divide-[#272F3A]/70 font-[family-name:var(--font-data)]">
                    {result.line_items?.map((item, i) => (
                      <tr key={i} className="hover:bg-[var(--color-surface-2)]/60 dark:hover:bg-[#1C222B]/60 transition-colors duration-250">
                        <td className="py-3.5 px-4 font-[family-name:var(--font-body)] text-[var(--color-text)] font-medium">
                          {item.description}
                        </td>
                        <td className="py-3.5 px-4 text-right text-[var(--color-text)] tabular-nums">{item.qty}</td>
                        <td className="py-3.5 px-4 text-right font-bold text-[var(--color-text)] tabular-nums">
                          {money(item.amount)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span
                            className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold border ${
                              item.confidence === 'low'
                                ? 'bg-[#FFF1E0] dark:bg-[#3A2A18] text-[#FF8A1F] dark:text-[#FFA040] border-[#FDE1C3] dark:border-[#523A20]'
                                : 'bg-[#E3F6EC] dark:bg-[#12302A] text-[#12A06B] dark:text-[#34D399] border-[#C2EDD5] dark:border-[#1E4A3F]'
                            }`}
                          >
                            {t(`photo.confidence.${item.confidence === 'low' ? 'low' : 'high'}`)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-end border-t border-[var(--color-line)] dark:border-[#272F3A] pt-4">
                <div className="w-64 flex justify-between items-center rounded-2xl bg-[#E4ECFF] dark:bg-[#16213A] border border-[#C8D6F2] dark:border-[#223152] p-3 font-bold text-sm text-[var(--color-accent)]">
                  <span>{t('photo.totalAmount')}</span>
                  <span className="font-[family-name:var(--font-data)] text-base tabular-nums">
                    {money(result.total)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* BOTTOM ACTION BUTTONS */}
        <div className="flex items-center justify-between pt-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 rounded-xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] px-5 py-2.5 text-xs font-bold text-[var(--color-text)] hover:border-[var(--color-accent)] transition-colors duration-300 cursor-pointer shadow-xs"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            <span>{t('back')}</span>
          </button>

          <button
            onClick={() => navigate('/upload')}
            className="flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-[var(--color-accent)]/20 hover:brightness-110 transition-all duration-300 ease-out transform active:scale-95 cursor-pointer"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            <span>{t('another')}</span>
          </button>
        </div>
      </div>
    </DashboardLayout>
  )
}
