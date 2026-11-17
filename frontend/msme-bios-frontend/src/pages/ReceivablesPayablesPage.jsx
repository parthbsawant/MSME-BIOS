
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import DashboardLayout from '../components/DashboardLayout'
import { getReceivablesPayables } from '../lib/api'

const formatCurrency = (amount = 0) =>
  `₹${Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

export default function ReceivablesPayablesPage() {
  const { t } = useTranslation('dashboard')

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [activeTab, setActiveTab] = useState('receivables')
  const [expandedParty, setExpandedParty] = useState(null)

  const fetchData = async () => {
    setLoading(true)
    setError(false)

    try {
      const result = await getReceivablesPayables()
      setData(result)
    } catch (err) {
      console.error('Receivables and Payables error:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  return (
    <DashboardLayout activeItem="Receivables & Payables">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">
            {t('receivablesPayables.title')}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {t('receivablesPayables.subtitle')}
          </p>
          {data?.as_of && (
  <p className="mt-2 text-xs text-[var(--color-muted)]">
    {t('receivablesPayables.asOf')}: {data.as_of}
  </p>
)}
        </div>

        {loading && (
          <p className="text-sm text-[var(--color-muted)]">
            {t('receivablesPayables.loading')}
          </p>
        )}

        {error && (
          <div className="space-y-3">
            <p className="text-sm text-red-500">
              {t('receivablesPayables.error')}
            </p>
            <button
              onClick={fetchData}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white"
            >
              {t('receivablesPayables.retry')}
            </button>
          </div>
        )}

        

{data && !loading && !error && (
  <>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <div className="rounded-xl border border-[var(--color-line)] p-5">
        <p className="text-sm text-[var(--color-muted)]">
          {t('receivablesPayables.totalReceivables')}
        </p>
        <p className="mt-2 text-2xl font-bold text-[var(--color-text)]">
          {formatCurrency(data.receivables?.total_outstanding)}
        </p>
      </div>

      <div className="rounded-xl border border-[var(--color-line)] p-5">
        <p className="text-sm text-[var(--color-muted)]">
          {t('receivablesPayables.totalPayables')}
        </p>
        <p className="mt-2 text-2xl font-bold text-[var(--color-text)]">
          {formatCurrency(data.payables?.total_outstanding)}
        </p>
      </div>

      <div className="rounded-xl border border-[var(--color-line)] p-5">
        <p className="text-sm text-[var(--color-muted)]">
          {t('receivablesPayables.netPosition')}
        </p>
        <p className="mt-2 text-2xl font-bold text-[var(--color-text)]">
          {formatCurrency(data.net_position)}
        </p>
      </div>
    </div>

    {/* Receivables and Payables tabs */}
    <div className="mt-6 flex gap-3 border-b border-[var(--color-line)]">
      <button
        onClick={() => setActiveTab('receivables')}
        className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
          activeTab === 'receivables'
            ? 'border-blue-500 text-blue-500'
            : 'border-transparent text-[var(--color-muted)]'
        }`}
      >
        {t('receivablesPayables.receivables')}
      </button>

      <button
        onClick={() => setActiveTab('payables')}
        className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
          activeTab === 'payables'
            ? 'border-blue-500 text-blue-500'
            : 'border-transparent text-[var(--color-muted)]'
        }`}
      >
        {t('receivablesPayables.payables')}
      </button>
    </div>

{(() => {
  const current = activeTab === 'receivables'
    ? data.receivables
    : data.payables

  return (
    <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-xl border border-[var(--color-line)] p-4">
        <p className="text-sm text-[var(--color-muted)]">
          {t('receivablesPayables.outstanding')}
        </p>
        <p className="mt-2 text-xl font-semibold text-[var(--color-text)]">
          {formatCurrency(current?.total_outstanding)}
        </p>
      </div>

      <div className="rounded-xl border border-[var(--color-line)] p-4">
        <p className="text-sm text-[var(--color-muted)]">
          {t('receivablesPayables.overdue')}
        </p>
        <p className="mt-2 text-xl font-semibold text-red-500">
          {formatCurrency(current?.overdue_amount)}
        </p>
      </div>

      <div className="rounded-xl border border-[var(--color-line)] p-4">
        <p className="text-sm text-[var(--color-muted)]">
          {t('receivablesPayables.dueNext7Days')}
        </p>
        <p className="mt-2 text-xl font-semibold text-[var(--color-text)]">
          {formatCurrency(current?.due_next_7_days)}
        </p>
      </div>

      <div className="rounded-xl border border-[var(--color-line)] p-4">
        <p className="text-sm text-[var(--color-muted)]">
          {t('receivablesPayables.openInvoices')}
        </p>
        <p className="mt-2 text-xl font-semibold text-[var(--color-text)]">
          {current?.open_count ?? 0}
        </p>
      </div>
    </div>
  )
})()}


{(() => {
  const current = activeTab === 'receivables'
    ? data.receivables
    : data.payables

  const parties = current?.parties || []

  return (
    <div className="mt-6 space-y-4">
      <h2 className="text-lg font-semibold text-[var(--color-text)]">
        {t('receivablesPayables.parties')}
      </h2>

      {parties.length === 0 ? (
        <div className="rounded-xl border border-[var(--color-line)] p-6 text-center">
          <p className="text-sm text-[var(--color-muted)]">
            {t('receivablesPayables.noRecords')}
          </p>
        </div>
      ) : (
        parties.map((party) => {
          const isExpanded = expandedParty === party.party_name

          return (
            <div
              key={party.party_name}
              className="overflow-hidden rounded-xl border border-[var(--color-line)]"
            >
              <button
                type="button"
                onClick={() =>
                  setExpandedParty(
                    isExpanded ? null : party.party_name
                  )
                }
                className="flex w-full flex-wrap items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-[var(--color-line)]/30"
              >
                <div>
                  <p className="font-semibold text-[var(--color-text)]">
                    {party.party_name}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    {t('receivablesPayables.oldestDue')}: {party.oldest_due_date || '—'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-5">
                  <div>
                    <p className="text-xs text-[var(--color-muted)]">
                      {t('receivablesPayables.outstanding')}
                    </p>
                    <p className="font-semibold text-[var(--color-text)]">
                      {formatCurrency(party.outstanding)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-[var(--color-muted)]">
                      {t('receivablesPayables.overdue')}
                    </p>
                    <p className="font-semibold text-red-500">
                      {formatCurrency(party.overdue)}
                    </p>
                  </div>

                  <span className="text-sm text-blue-500">
                    {isExpanded
                      ? t('receivablesPayables.collapse')
                      : t('receivablesPayables.expand')}
                  </span>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-[var(--color-line)] p-4">
                  <h3 className="mb-3 text-sm font-semibold text-[var(--color-text)]">
                    {t('receivablesPayables.invoiceDetails')}
                  </h3>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-[var(--color-line)] text-[var(--color-muted)]">
                          <th className="p-3 font-medium">
                            {t('receivablesPayables.invoiceNumber')}
                          </th>
                          <th className="p-3 font-medium">
                            {t('receivablesPayables.invoiceDate')}
                          </th>
                          <th className="p-3 font-medium">
                            {t('receivablesPayables.dueDate')}
                          </th>
                          <th className="p-3 text-right font-medium">
                            {t('receivablesPayables.amount')}
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {(party.invoices || []).map((invoice) => (
                          <tr
                            key={invoice.invoice_id}
                            className="border-b border-[var(--color-line)] last:border-0"
                          >
                            <td className="p-3 text-[var(--color-text)]">
                              {invoice.invoice_number || '—'}
                            </td>
                            <td className="p-3 text-[var(--color-muted)]">
                              {invoice.invoice_date || '—'}
                            </td>
                            
<td className="p-3">
  {invoice.due_date ? (
    <span
      className={
        invoice.due_date < data.as_of
          ? 'font-medium text-red-500'
          : 'text-[var(--color-muted)]'
      }
    >
      {invoice.due_date}
      {invoice.due_date < data.as_of && (
        <span className="ml-2 rounded-full bg-red-500/10 px-2 py-1 text-xs text-red-500">
          {t('receivablesPayables.overdue')}
        </span>
      )}
    </span>
  ) : (
    <span className="text-[var(--color-muted)]">—</span>
  )}
</td>

                            <td className="p-3 text-right font-medium text-[var(--color-text)]">
                              {formatCurrency(invoice.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
})()}
    </>
)}


      </div>
    </DashboardLayout>
  )
}
