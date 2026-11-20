import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  FileText,
  Lock,
  AlertTriangle,
  RefreshCw,
  Search,
  ChevronDown,
  Calendar,
  AlertCircle,
  Plus,
  ArrowUpDown,
  Building2,
  Clock,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout'
import { Skeleton } from '../components/ui'
import { getReceivablesPayables } from '../lib/api'
import { useBusiness } from '../context/BusinessContext'

const BUCKET_COLORS = {
  current: {
    bg: '#12A06B',
    text: 'text-[#12A06B] dark:text-[#34D399]',
    badge: 'bg-[#E3F6EC] text-[#12A06B] dark:bg-[#12302A] dark:text-[#34D399]',
  },
  '1-30': {
    bg: '#3B82F6',
    text: 'text-[#3B82F6] dark:text-[#60A5FA]',
    badge: 'bg-[#EFF6FF] text-[#2563EB] dark:bg-[#1E293B] dark:text-[#60A5FA]',
  },
  '31-60': {
    bg: '#FF8A1F',
    text: 'text-[#FF8A1F]',
    badge: 'bg-[#FFF1E0] text-[#FF8A1F] dark:bg-[#3A2A18]',
  },
  '61-90': {
    bg: '#EA580C',
    text: 'text-[#EA580C] dark:text-[#FB923C]',
    badge: 'bg-[#FFEDD5] text-[#C2410C] dark:bg-[#431407] dark:text-[#FB923C]',
  },
  '90+': {
    bg: '#D92D20',
    text: 'text-[#D92D20] dark:text-[#F87171]',
    badge: 'bg-[#FDE7EA] text-[#D92D20] dark:bg-[#3A1C24] dark:text-[#F87171]',
  },
}

function formatIndianRupees(val) {
  if (val === null || val === undefined || isNaN(val)) return '₹0'
  const isNegative = val < 0
  const abs = Math.abs(val)
  const formatted = abs.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })
  return isNegative ? `-₹${formatted}` : `₹${formatted}`
}

function formatDate(isoStr) {
  if (!isoStr) return '–'
  try {
    const d = new Date(isoStr)
    if (isNaN(d.getTime())) return isoStr
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return isoStr
  }
}

export default function ReceivablesPage() {
  const { t } = useTranslation('receivables')
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { isOwner } = useBusiness()

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  // Active tab: 'receivables' | 'payables' | 'aging'
  const initialTab = searchParams.get('view') === 'aging' ? 'aging' : 'receivables'
  const [activeTab, setActiveTab] = useState(initialTab)

  // Table controls
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedBucket, setSelectedBucket] = useState('all')
  const [sortField, setSortField] = useState('days_overdue')
  const [sortAsc, setSortAsc] = useState(false)
  const [displayCount, setDisplayCount] = useState(50)

  const loadData = () => {
    setLoading(true)
    setError(null)
    getReceivablesPayables()
      .then((res) => {
        setData(res)
        setLoading(false)
      })
      .catch((err) => {
        setError(err)
        setLoading(false)
      })
  }

  useEffect(() => {
    loadData()
  }, [])

  // Sync tab with URL if URL changes
  useEffect(() => {
    const view = searchParams.get('view')
    if (view === 'aging' && activeTab !== 'aging') {
      setActiveTab('aging')
    }
  }, [searchParams])

  const handleTabChange = (tabId) => {
    setActiveTab(tabId)
    setSearchTerm('')
    setSelectedBucket('all')
    setDisplayCount(50)
    if (tabId === 'aging') {
      setSearchParams({ view: 'aging' })
    } else {
      setSearchParams({})
    }
  }

  const isLocked = Boolean(
    error && (error.status === 402 || error.status === 403 || error.code === 'feature_not_available' || error.code === 'payment_required')
  )

  const receivables = data?.receivables
  const payables = data?.payables
  const suppliersPaid = data?.suppliers_paid

  // Filter and sort active invoice list (receivables or payables)
  const currentInvoiceList = useMemo(() => {
    const baseList = activeTab === 'payables' ? payables?.invoices || [] : receivables?.invoices || []
    return baseList.filter((inv) => {
      const matchSearch =
        searchTerm.trim() === '' ||
        (inv.party_name && inv.party_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (inv.invoice_number && inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()))
      const matchBucket = selectedBucket === 'all' || inv.bucket === selectedBucket
      return matchSearch && matchBucket
    })
  }, [activeTab, receivables, payables, searchTerm, selectedBucket])

  const sortedInvoices = useMemo(() => {
    return [...currentInvoiceList].sort((a, b) => {
      let aVal = a[sortField]
      let bVal = b[sortField]
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase()
        bVal = (bVal || '').toLowerCase()
      }
      if (aVal < bVal) return sortAsc ? -1 : 1
      if (aVal > bVal) return sortAsc ? 1 : -1
      return 0
    })
  }, [currentInvoiceList, sortField, sortAsc])

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortField(field)
      setSortAsc(false)
    }
  }

  // Singular / Plural helper
  const pluralizeInvoices = (count) => (count === 1 ? '1 invoice' : `${count} invoices`)
  const pluralizeCustomers = (count) => (count === 1 ? '1 customer' : `${count} customers`)
  const pluralizeSuppliers = (count) => (count === 1 ? '1 supplier' : `${count} suppliers`)

  return (
    <DashboardLayout activeItem="Receivables">
      <div className="space-y-8 max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block rounded-md bg-[var(--color-surface-2)] dark:bg-[#1C222B] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[var(--color-accent)] border border-[var(--color-line)] dark:border-[#272F3A]">
                Finance
              </span>
              {data?.as_of && (
                <span className="text-xs text-[var(--color-muted)] font-medium">
                  {t('asOf', { date: formatDate(data.as_of) })}
                </span>
              )}
            </div>
            <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-extrabold text-[var(--color-text)] tracking-tight">
              {t('title')}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[var(--color-muted)]">
              {t('subtitle')}
            </p>
          </div>

          <button
            onClick={() => navigate('/upload')}
            className="self-start sm:self-auto flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-[var(--color-accent)]/20 hover:brightness-110 transition-all duration-300 ease-out transform active:scale-95 cursor-pointer"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            <span>{t('upload')}</span>
          </button>
        </div>

        {/* LOADING SKELETON */}
        {loading && (
          <div className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-5 space-y-4"
                >
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-36" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
            <div className="rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-6 space-y-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-64 w-full" />
            </div>
          </div>
        )}

        {/* LOCKED STATE (402 or 403) */}
        {!loading && isLocked && (
          <div className="rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-8 sm:p-12 text-center shadow-[var(--shadow-cool-md)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-surface-2)] dark:bg-[#1C222B] text-[var(--color-muted)]">
              <Lock className="h-7 w-7" strokeWidth={2} />
            </div>
            <h2 className="mt-4 font-[family-name:var(--font-display)] text-xl font-bold text-[var(--color-text)]">
              {t('lockedTitle')}
            </h2>
            <p className="mt-2 text-sm text-[var(--color-muted)] max-w-md mx-auto">
              {t('lockedSubtitle')}
            </p>
            <div className="mt-6 flex justify-center">
              {isOwner ? (
                <button
                  onClick={() => navigate('/billing')}
                  className="rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-[var(--color-accent)]/20 hover:brightness-110 transition-all cursor-pointer"
                >
                  {t('upgradePlan')}
                </button>
              ) : (
                <span className="text-xs text-[var(--color-muted)]">
                  {t('contactOwner')}
                </span>
              )}
            </div>
          </div>
        )}

        {/* ERROR STATE */}
        {!loading && error && !isLocked && (
          <div className="rounded-3xl border border-[#FBD0D6] dark:border-[#52222E] bg-white dark:bg-[#151A21] p-8 sm:p-10 text-center shadow-[var(--shadow-cool-md)]">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FDE7EA] dark:bg-[#3A1C24] text-[#D92D20] dark:text-[#F87171]">
              <AlertTriangle className="h-6 w-6" strokeWidth={2} />
            </div>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-lg font-bold text-[var(--color-text)]">
              {t('errorTitle')}
            </h2>
            <p className="mt-1 text-xs text-[var(--color-muted)] max-w-md mx-auto">
              {error.message || 'Could not fetch receivables and payables data.'}
            </p>
            <button
              onClick={loadData}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2 text-xs font-bold text-white hover:brightness-110 transition-all cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>{t('retry')}</span>
            </button>
          </div>
        )}

        {/* LOADED CONTENT */}
        {!loading && data && (
          <>
            {/* 4 SUMMARY STAT CARDS */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Card 1: To Collect */}
              <div className="group rounded-2xl border border-[#C8D6F2] dark:border-[#223152] bg-[#E4ECFF] dark:bg-[#16213A] p-5 shadow-xs hover:-translate-y-1 hover:shadow-[var(--shadow-cool-md)] transition-all duration-350 ease-out flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--color-muted)]">
                      {t('toCollect')}
                    </span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 dark:bg-[#141F38] text-[var(--color-accent)] shadow-xs">
                      <ArrowDownLeft className="h-4 w-4" strokeWidth={2.2} />
                    </div>
                  </div>
                  <p className="mt-3 font-[family-name:var(--font-display)] text-2xl font-extrabold text-[var(--color-text)] tabular-nums">
                    {formatIndianRupees(receivables?.total_outstanding)}
                  </p>
                </div>
                <div className="mt-4 pt-2 border-t border-[#C8D6F2]/60 dark:border-[#223152]/60 text-[11px] font-semibold text-[var(--color-muted)] truncate">
                  {t('toCollectSub', {
                    invoices: pluralizeInvoices(receivables?.invoice_count || 0),
                    parties: pluralizeCustomers(receivables?.party_count || 0),
                  })}
                </div>
              </div>

              {/* Card 2: Overdue */}
              <div className="group rounded-2xl border border-[#FBD0D6] dark:border-[#52222E] bg-[#FDE7EA] dark:bg-[#3A1C24] p-5 shadow-xs hover:-translate-y-1 hover:shadow-[var(--shadow-cool-md)] transition-all duration-350 ease-out flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--color-muted)]">
                      {t('overdue')}
                    </span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 dark:bg-[#4E222D] text-[#D92D20] dark:text-[#F87171] shadow-xs">
                      <Clock className="h-4 w-4" strokeWidth={2.2} />
                    </div>
                  </div>
                  <p className="mt-3 font-[family-name:var(--font-display)] text-2xl font-extrabold text-[#D92D20] dark:text-[#F87171] tabular-nums">
                    {formatIndianRupees(receivables?.overdue_amount)}
                  </p>
                </div>
                <div className="mt-4 pt-2 border-t border-[#FBD0D6]/60 dark:border-[#52222E]/60 text-[11px] font-semibold text-[var(--color-muted)]">
                  {receivables?.total_outstanding > 0
                    ? t('overdueSub', {
                        pct: ((receivables.overdue_amount * 100) / receivables.total_outstanding).toFixed(1),
                      })
                    : '0% of total'}
                </div>
              </div>

              {/* Card 3: To Pay */}
              <div className="group rounded-2xl border border-[#FDE1C3] dark:border-[#523A20] bg-[#FFF1E0] dark:bg-[#3A2A18] p-5 shadow-xs hover:-translate-y-1 hover:shadow-[var(--shadow-cool-md)] transition-all duration-350 ease-out flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--color-muted)]">
                      {t('toPay')}
                    </span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 dark:bg-[#4A321B] text-[#FF8A1F] shadow-xs">
                      <ArrowUpRight className="h-4 w-4" strokeWidth={2.2} />
                    </div>
                  </div>
                  <p className="mt-3 font-[family-name:var(--font-display)] text-2xl font-extrabold text-[#FF8A1F] tabular-nums">
                    {formatIndianRupees(payables?.total_outstanding)}
                  </p>
                </div>
                <div className="mt-4 pt-2 border-t border-[#FDE1C3]/60 dark:border-[#523A20]/60 text-[11px] font-semibold text-[var(--color-muted)] truncate">
                  {payables?.invoice_count > 0
                    ? t('toPaySub', {
                        invoices: pluralizeInvoices(payables.invoice_count),
                        parties: pluralizeSuppliers(payables.party_count),
                      })
                    : t('toPayEmpty')}
                </div>
              </div>

              {/* Card 4: Paid to suppliers */}
              <div className="group rounded-2xl border border-[#C2EDD5] dark:border-[#1E4A3F] bg-[#E3F6EC] dark:bg-[#12302A] p-5 shadow-xs hover:-translate-y-1 hover:shadow-[var(--shadow-cool-md)] transition-all duration-350 ease-out flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--color-muted)]">
                      {t('paidToSuppliers')}
                    </span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 dark:bg-[#1A3D35] text-[#12A06B] shadow-xs">
                      <CheckCircle2 className="h-4 w-4" strokeWidth={2.2} />
                    </div>
                  </div>
                  <p className="mt-3 font-[family-name:var(--font-display)] text-2xl font-extrabold text-[#12A06B] dark:text-[#34D399] tabular-nums">
                    {formatIndianRupees(suppliersPaid?.total_paid)}
                  </p>
                </div>
                <div className="mt-4 pt-2 border-t border-[#C2EDD5]/60 dark:border-[#1E4A3F]/60 text-[11px] font-semibold text-[var(--color-muted)] truncate">
                  {t('paidToSuppliersSub', {
                    count: pluralizeSuppliers(suppliersPaid?.supplier_count || 0),
                  })}
                </div>
              </div>
            </div>

            {/* EMPTY STATE IF HAS_DATA IS FALSE */}
            {!data.has_data ? (
              <div className="rounded-3xl border border-dashed border-[var(--color-line)] dark:border-[#272F3A] bg-[var(--color-surface-2)]/40 dark:bg-[#161C25]/40 p-8 sm:p-12 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white dark:bg-[#151A21] text-[var(--color-accent)] shadow-xs">
                  <FileText className="h-7 w-7" strokeWidth={2} />
                </div>
                <h3 className="mt-4 font-[family-name:var(--font-display)] text-lg font-bold text-[var(--color-text)]">
                  {t('emptyTitle')}
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-[var(--color-muted)] max-w-md mx-auto">
                  {t('emptySubtitle')}
                </p>
                <div className="mt-6">
                  <button
                    onClick={() => navigate('/upload')}
                    className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-[var(--color-accent)]/20 hover:brightness-110 transition-all cursor-pointer"
                  >
                    <Plus className="h-4 w-4" strokeWidth={2.5} />
                    <span>{t('upload')}</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* 3 TABS SWITCHER */}
                <div className="flex border-b border-[var(--color-line)] dark:border-[#272F3A] gap-8">
                  {['receivables', 'payables', 'aging'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => handleTabChange(tab)}
                      className={`pb-3 text-sm font-bold tracking-tight transition-colors relative cursor-pointer ${
                        activeTab === tab
                          ? 'text-[var(--color-accent)]'
                          : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                      }`}
                    >
                      <span>{t(`tabs.${tab}`)}</span>
                      {activeTab === tab && (
                        <motion.div
                          layoutId="activeTabUnderline"
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-accent)]"
                        />
                      )}
                    </button>
                  ))}
                </div>

                {/* TAB 1: RECEIVABLES */}
                {activeTab === 'receivables' && (
                  <div className="space-y-6">
                    {/* Horizontal Stacked Bar of 5 Buckets */}
                    <div className="rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-6 sm:p-7 shadow-[var(--shadow-cool-md)]">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[var(--color-line)] dark:border-[#272F3A] gap-2">
                        <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-[var(--color-text)]">
                          {t('agingBreakdown')} &middot; {t('tabs.receivables')}
                        </h3>
                        <span className="text-xs font-extrabold text-[var(--color-accent)]">
                          {formatIndianRupees(receivables?.total_outstanding)}
                        </span>
                      </div>

                      {/* Stacked Progress Bar */}
                      <div className="mt-5 h-4 w-full rounded-full bg-[var(--color-surface-2)] dark:bg-[#1C222B] overflow-hidden flex shadow-inner">
                        {receivables?.buckets.map((b) => (
                          <div
                            key={b.bucket}
                            style={{
                              width: `${b.share_pct}%`,
                              backgroundColor: BUCKET_COLORS[b.bucket]?.bg,
                            }}
                            title={`${t(`buckets.${b.bucket}`)}: ${formatIndianRupees(b.amount)} (${b.share_pct}%)`}
                            className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                          />
                        ))}
                      </div>

                      {/* Legend grid */}
                      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        {receivables?.buckets.map((b) => (
                          <div
                            key={b.bucket}
                            onClick={() => setSelectedBucket(selectedBucket === b.bucket ? 'all' : b.bucket)}
                            className={`p-3 rounded-xl border transition-all cursor-pointer ${
                              selectedBucket === b.bucket
                                ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]/20'
                                : 'border-[var(--color-line)] dark:border-[#272F3A] bg-[var(--color-surface-2)]/40 dark:bg-[#1C222B]/40 hover:border-[var(--color-line-hover)]'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: BUCKET_COLORS[b.bucket]?.bg }}
                              />
                              <span className="text-[11px] font-semibold text-[var(--color-muted)] truncate">
                                {t(`buckets.${b.bucket}`)}
                              </span>
                            </div>
                            <div className="mt-2 text-sm font-extrabold text-[var(--color-text)] tabular-nums">
                              {formatIndianRupees(b.amount)}
                            </div>
                            <div className="text-[10px] text-[var(--color-muted)] mt-0.5 flex justify-between font-medium">
                              <span>{pluralizeInvoices(b.count)}</span>
                              <span>{b.share_pct.toFixed(1)}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Top Customers Owing List */}
                    {receivables?.top_parties && receivables.top_parties.length > 0 && (
                      <div className="rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-6 shadow-[var(--shadow-cool-md)]">
                        <div className="flex items-center justify-between pb-4 border-b border-[var(--color-line)] dark:border-[#272F3A]">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                              <Building2 className="h-4 w-4" />
                            </div>
                            <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-[var(--color-text)]">
                              {t('topCustomersOwing')}
                            </h3>
                          </div>
                        </div>

                        <div className="mt-4 space-y-3.5">
                          {receivables.top_parties.map((p) => (
                            <div key={p.party_name} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-[var(--color-text)]">
                                  {p.party_name}
                                </span>
                                <div className="flex items-center gap-3">
                                  <span className="text-[var(--color-muted)] text-[11px]">
                                    {pluralizeInvoices(p.invoice_count)} &middot; {p.oldest_days_overdue}d oldest
                                  </span>
                                  <span className="font-bold text-[var(--color-text)] tabular-nums">
                                    {formatIndianRupees(p.outstanding)}
                                  </span>
                                </div>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-[var(--color-surface-2)] dark:bg-[#1C222B] overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-[var(--color-accent)]"
                                  style={{ width: `${Math.min(100, Math.max(2, p.share_pct))}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Invoices Table */}
                    <div className="rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-6 shadow-[var(--shadow-cool-md)]">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--color-line)] dark:border-[#272F3A]">
                        <div>
                          <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-[var(--color-text)]">
                            {t('invoicesTitle')}
                          </h3>
                          <p className="text-xs text-[var(--color-muted)] mt-0.5">
                            {t('showingCount', {
                              shown: Math.min(displayCount, sortedInvoices.length),
                              total: sortedInvoices.length,
                            })}
                          </p>
                        </div>

                        {/* Search & Bucket Filter */}
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="relative">
                            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
                            <input
                              type="text"
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              placeholder={t('searchPlaceholder')}
                              className="pl-8 pr-3 py-1.5 rounded-xl border border-[var(--color-line)] dark:border-[#272F3A] bg-[var(--color-surface-2)] dark:bg-[#161C25] text-xs text-[var(--color-text)] focus:outline-hidden focus:border-[var(--color-accent)] w-52 sm:w-64"
                            />
                          </div>

                          {selectedBucket !== 'all' && (
                            <button
                              onClick={() => setSelectedBucket('all')}
                              className="px-2.5 py-1.5 rounded-xl border border-[var(--color-line)] dark:border-[#272F3A] text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-text)] cursor-pointer"
                            >
                              {t('allBuckets')} ✕
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Responsive Table */}
                      <div className="mt-4 overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-[var(--color-line)] dark:border-[#272F3A] text-[var(--color-muted)] font-semibold">
                              <th
                                onClick={() => handleSort('party_name')}
                                className="pb-3 pr-4 cursor-pointer hover:text-[var(--color-text)]"
                              >
                                <span className="inline-flex items-center gap-1">
                                  {t('party')} <ArrowUpDown className="h-3 w-3" />
                                </span>
                              </th>
                              <th className="pb-3 pr-4">{t('invoiceNo')}</th>
                              <th
                                onClick={() => handleSort('invoice_date')}
                                className="pb-3 pr-4 cursor-pointer hover:text-[var(--color-text)]"
                              >
                                <span className="inline-flex items-center gap-1">
                                  {t('date')} <ArrowUpDown className="h-3 w-3" />
                                </span>
                              </th>
                              <th
                                onClick={() => handleSort('due_date')}
                                className="pb-3 pr-4 cursor-pointer hover:text-[var(--color-text)]"
                              >
                                <span className="inline-flex items-center gap-1">
                                  {t('dueDate')} <ArrowUpDown className="h-3 w-3" />
                                </span>
                              </th>
                              <th className="pb-3 pr-4 text-right">{t('total')}</th>
                              <th className="pb-3 pr-4 text-right">{t('paid')}</th>
                              <th
                                onClick={() => handleSort('outstanding')}
                                className="pb-3 pr-4 text-right cursor-pointer hover:text-[var(--color-text)]"
                              >
                                <span className="inline-flex items-center gap-1 justify-end">
                                  {t('outstanding')} <ArrowUpDown className="h-3 w-3" />
                                </span>
                              </th>
                              <th
                                onClick={() => handleSort('days_overdue')}
                                className="pb-3 pr-4 text-center cursor-pointer hover:text-[var(--color-text)]"
                              >
                                <span className="inline-flex items-center gap-1 justify-center">
                                  {t('daysOverdue')} <ArrowUpDown className="h-3 w-3" />
                                </span>
                              </th>
                              <th className="pb-3 text-center">{t('bucket')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--color-line)]/60 dark:divide-[#272F3A]/60">
                            {sortedInvoices.slice(0, displayCount).map((inv) => (
                              <tr
                                key={inv.invoice_number || inv.party_name + inv.invoice_date}
                                className="hover:bg-[var(--color-surface-2)]/50 dark:hover:bg-[#1C222B]/50 transition-colors"
                              >
                                <td className="py-3 pr-4 font-bold text-[var(--color-text)] max-w-[180px] truncate">
                                  {inv.party_name}
                                </td>
                                <td className="py-3 pr-4 font-mono text-[11px] text-[var(--color-muted)]">
                                  <div className="flex items-center gap-1.5">
                                    <span>{inv.invoice_number || '–'}</span>
                                    {inv.has_possible_payment && (
                                      <span
                                        title={t('possiblePayment')}
                                        className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#FEF3C7] text-[#92400E] dark:bg-[#78350F] dark:text-[#FDE68A]"
                                      >
                                        ?
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 pr-4 text-[var(--color-muted)] tabular-nums">
                                  {formatDate(inv.invoice_date)}
                                </td>
                                <td className="py-3 pr-4 text-[var(--color-muted)] tabular-nums">
                                  {formatDate(inv.due_date)}
                                </td>
                                <td className="py-3 pr-4 text-right tabular-nums text-[var(--color-text)]">
                                  {formatIndianRupees(inv.total)}
                                </td>
                                <td className="py-3 pr-4 text-right tabular-nums text-[var(--color-muted)]">
                                  {formatIndianRupees(inv.paid)}
                                </td>
                                <td className="py-3 pr-4 text-right font-bold tabular-nums text-[var(--color-text)]">
                                  {formatIndianRupees(inv.outstanding)}
                                </td>
                                <td className="py-3 pr-4 text-center tabular-nums font-semibold">
                                  {inv.days_overdue > 0 ? (
                                    <span className="text-[#D92D20] dark:text-[#F87171]">
                                      {inv.days_overdue}d
                                    </span>
                                  ) : (
                                    <span className="text-[var(--color-muted)]">0d</span>
                                  )}
                                </td>
                                <td className="py-3 text-center">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                      BUCKET_COLORS[inv.bucket]?.badge
                                    }`}
                                  >
                                    {t(`buckets.${inv.bucket}`)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {sortedInvoices.length === 0 && (
                          <p className="text-center py-8 text-xs text-[var(--color-muted)]">
                            {t('noInvoicesFound')}
                          </p>
                        )}
                      </div>

                      {sortedInvoices.length > displayCount && (
                        <div className="mt-6 flex justify-center border-t border-[var(--color-line)] dark:border-[#272F3A] pt-4">
                          <button
                            onClick={() => setDisplayCount((c) => c + 50)}
                            className="rounded-xl border border-[var(--color-line)] dark:border-[#272F3A] bg-[var(--color-surface-2)] dark:bg-[#1C222B] px-5 py-2 text-xs font-bold text-[var(--color-text)] hover:border-[var(--color-accent)] transition-all cursor-pointer"
                          >
                            {t('showMore')}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 2: PAYABLES */}
                {activeTab === 'payables' && (
                  <div className="space-y-6">
                    {payables?.invoice_count === 0 ? (
                      /* No purchase bills uploaded notice */
                      <div className="rounded-3xl border border-dashed border-[var(--color-line)] dark:border-[#272F3A] bg-[var(--color-surface-2)]/40 dark:bg-[#161C25]/40 p-8 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white dark:bg-[#151A21] text-[#FF8A1F] shadow-xs">
                          <Receipt className="h-6 w-6" strokeWidth={2} />
                        </div>
                        <h3 className="mt-3 font-[family-name:var(--font-display)] text-base font-bold text-[var(--color-text)]">
                          {t('noPurchaseBills')}
                        </h3>
                        <p className="mt-1 text-xs text-[var(--color-muted)] max-w-sm mx-auto">
                          {t('noPurchaseBillsSub')}
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Horizontal Stacked Bar of 5 Buckets for Payables */}
                        <div className="rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-6 sm:p-7 shadow-[var(--shadow-cool-md)]">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[var(--color-line)] dark:border-[#272F3A] gap-2">
                            <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-[var(--color-text)]">
                              {t('agingBreakdown')} &middot; {t('tabs.payables')}
                            </h3>
                            <span className="text-xs font-extrabold text-[#FF8A1F]">
                              {formatIndianRupees(payables?.total_outstanding)}
                            </span>
                          </div>

                          <div className="mt-5 h-4 w-full rounded-full bg-[var(--color-surface-2)] dark:bg-[#1C222B] overflow-hidden flex shadow-inner">
                            {payables?.buckets.map((b) => (
                              <div
                                key={b.bucket}
                                style={{
                                  width: `${b.share_pct}%`,
                                  backgroundColor: BUCKET_COLORS[b.bucket]?.bg,
                                }}
                                title={`${t(`buckets.${b.bucket}`)}: ${formatIndianRupees(b.amount)} (${b.share_pct}%)`}
                                className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                              />
                            ))}
                          </div>

                          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                            {payables?.buckets.map((b) => (
                              <div
                                key={b.bucket}
                                onClick={() => setSelectedBucket(selectedBucket === b.bucket ? 'all' : b.bucket)}
                                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                                  selectedBucket === b.bucket
                                    ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]/20'
                                    : 'border-[var(--color-line)] dark:border-[#272F3A] bg-[var(--color-surface-2)]/40 dark:bg-[#1C222B]/40 hover:border-[var(--color-line-hover)]'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span
                                    className="h-2.5 w-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: BUCKET_COLORS[b.bucket]?.bg }}
                                  />
                                  <span className="text-[11px] font-semibold text-[var(--color-muted)] truncate">
                                    {t(`buckets.${b.bucket}`)}
                                  </span>
                                </div>
                                <div className="mt-2 text-sm font-extrabold text-[var(--color-text)] tabular-nums">
                                  {formatIndianRupees(b.amount)}
                                </div>
                                <div className="text-[10px] text-[var(--color-muted)] mt-0.5 flex justify-between font-medium">
                                  <span>{pluralizeInvoices(b.count)}</span>
                                  <span>{b.share_pct.toFixed(1)}%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Top Suppliers Owing */}
                        {payables?.top_parties && payables.top_parties.length > 0 && (
                          <div className="rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-6 shadow-[var(--shadow-cool-md)]">
                            <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-[var(--color-text)] pb-4 border-b border-[var(--color-line)] dark:border-[#272F3A]">
                              {t('topSuppliersOwing')}
                            </h3>
                            <div className="mt-4 space-y-3.5">
                              {payables.top_parties.map((p) => (
                                <div key={p.party_name} className="space-y-1">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="font-semibold text-[var(--color-text)]">
                                      {p.party_name}
                                    </span>
                                    <div className="flex items-center gap-3">
                                      <span className="text-[var(--color-muted)] text-[11px]">
                                        {pluralizeInvoices(p.invoice_count)} &middot; {p.oldest_days_overdue}d oldest
                                      </span>
                                      <span className="font-bold text-[var(--color-text)] tabular-nums">
                                        {formatIndianRupees(p.outstanding)}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="h-1.5 w-full rounded-full bg-[var(--color-surface-2)] dark:bg-[#1C222B] overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-[#FF8A1F]"
                                      style={{ width: `${Math.min(100, Math.max(2, p.share_pct))}%` }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* Paid to Suppliers List (Always shown under Payables) */}
                    {suppliersPaid?.top_suppliers && suppliersPaid.top_suppliers.length > 0 && (
                      <div className="rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-6 shadow-[var(--shadow-cool-md)]">
                        <div className="flex items-center justify-between pb-4 border-b border-[var(--color-line)] dark:border-[#272F3A]">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E3F6EC] dark:bg-[#12302A] text-[#12A06B]">
                              <CheckCircle2 className="h-4 w-4" />
                            </div>
                            <div>
                              <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-[var(--color-text)]">
                                {t('paidToSuppliersList')}
                              </h3>
                              <p className="text-xs text-[var(--color-muted)] mt-0.5">
                                {t('paidToSuppliersSub', {
                                  count: pluralizeSuppliers(suppliersPaid.supplier_count),
                                })}
                              </p>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-[#12A06B] dark:text-[#34D399]">
                            {formatIndianRupees(suppliersPaid.total_paid)}
                          </span>
                        </div>

                        <div className="mt-4 space-y-3.5">
                          {suppliersPaid.top_suppliers.map((s) => (
                            <div key={s.supplier} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <div>
                                  <span className="font-semibold text-[var(--color-text)]">
                                    {s.supplier}
                                  </span>
                                  {s.last_payment && (
                                    <span className="text-[10px] text-[var(--color-muted)] ml-2">
                                      {t('lastPayment', { date: formatDate(s.last_payment) })}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-[var(--color-muted)] text-[11px]">
                                    {s.payments === 1 ? '1 payment' : `${s.payments} payments`}
                                  </span>
                                  <span className="font-bold text-[var(--color-text)] tabular-nums">
                                    {formatIndianRupees(s.amount)}
                                  </span>
                                </div>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-[var(--color-surface-2)] dark:bg-[#1C222B] overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-[#12A06B]"
                                  style={{ width: `${Math.min(100, Math.max(2, s.share_pct))}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: AGING (Side-by-side charts + Top 10 most overdue) */}
                {activeTab === 'aging' && (
                  <div className="space-y-6">
                    {/* Side-by-side Bucket Charts */}
                    <div className="grid gap-6 lg:grid-cols-2">
                      {/* Left: Receivables Aging */}
                      <div className="rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-6 shadow-[var(--shadow-cool-md)] flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between pb-4 border-b border-[var(--color-line)] dark:border-[#272F3A]">
                            <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-[var(--color-text)]">
                              {t('receivablesAging')}
                            </h3>
                            <span className="text-xs font-bold text-[var(--color-accent)]">
                              {formatIndianRupees(receivables?.total_outstanding)}
                            </span>
                          </div>

                          <div className="mt-4 h-3 w-full rounded-full bg-[var(--color-surface-2)] dark:bg-[#1C222B] overflow-hidden flex shadow-inner">
                            {receivables?.buckets.map((b) => (
                              <div
                                key={b.bucket}
                                style={{
                                  width: `${b.share_pct}%`,
                                  backgroundColor: BUCKET_COLORS[b.bucket]?.bg,
                                }}
                                className="h-full"
                              />
                            ))}
                          </div>

                          <div className="mt-4 space-y-2">
                            {receivables?.buckets.map((b) => (
                              <div
                                key={b.bucket}
                                className="flex items-center justify-between text-xs py-1.5 border-b border-[var(--color-line)]/40 dark:border-[#272F3A]/40 last:border-none"
                              >
                                <div className="flex items-center gap-2">
                                  <span
                                    className="h-2.5 w-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: BUCKET_COLORS[b.bucket]?.bg }}
                                  />
                                  <span className="font-medium text-[var(--color-text)]">
                                    {t(`buckets.${b.bucket}`)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 tabular-nums">
                                  <span className="text-[var(--color-muted)] text-[11px]">
                                    {pluralizeInvoices(b.count)}
                                  </span>
                                  <span className="font-bold text-[var(--color-text)]">
                                    {formatIndianRupees(b.amount)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Right: Payables Aging */}
                      <div className="rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-6 shadow-[var(--shadow-cool-md)] flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between pb-4 border-b border-[var(--color-line)] dark:border-[#272F3A]">
                            <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-[var(--color-text)]">
                              {t('payablesAging')}
                            </h3>
                            <span className="text-xs font-bold text-[#FF8A1F]">
                              {formatIndianRupees(payables?.total_outstanding)}
                            </span>
                          </div>

                          <div className="mt-4 h-3 w-full rounded-full bg-[var(--color-surface-2)] dark:bg-[#1C222B] overflow-hidden flex shadow-inner">
                            {payables?.buckets.map((b) => (
                              <div
                                key={b.bucket}
                                style={{
                                  width: `${b.share_pct}%`,
                                  backgroundColor: BUCKET_COLORS[b.bucket]?.bg,
                                }}
                                className="h-full"
                              />
                            ))}
                          </div>

                          <div className="mt-4 space-y-2">
                            {payables?.buckets.map((b) => (
                              <div
                                key={b.bucket}
                                className="flex items-center justify-between text-xs py-1.5 border-b border-[var(--color-line)]/40 dark:border-[#272F3A]/40 last:border-none"
                              >
                                <div className="flex items-center gap-2">
                                  <span
                                    className="h-2.5 w-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: BUCKET_COLORS[b.bucket]?.bg }}
                                  />
                                  <span className="font-medium text-[var(--color-text)]">
                                    {t(`buckets.${b.bucket}`)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 tabular-nums">
                                  <span className="text-[var(--color-muted)] text-[11px]">
                                    {pluralizeInvoices(b.count)}
                                  </span>
                                  <span className="font-bold text-[var(--color-text)]">
                                    {formatIndianRupees(b.amount)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Top 10 Most Overdue Receivable Invoices */}
                    <div className="rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-6 shadow-[var(--shadow-cool-md)]">
                      <div className="pb-4 border-b border-[var(--color-line)] dark:border-[#272F3A]">
                        <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-[var(--color-text)]">
                          {t('mostOverdueTitle')}
                        </h3>
                        <p className="text-xs text-[var(--color-muted)] mt-0.5">
                          {t('mostOverdueSubtitle')}
                        </p>
                      </div>

                      <div className="mt-4 overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-[var(--color-line)] dark:border-[#272F3A] text-[var(--color-muted)] font-semibold">
                              <th className="pb-3 pr-4">{t('party')}</th>
                              <th className="pb-3 pr-4">{t('invoiceNo')}</th>
                              <th className="pb-3 pr-4">{t('dueDate')}</th>
                              <th className="pb-3 pr-4 text-right">{t('outstanding')}</th>
                              <th className="pb-3 pr-4 text-center">{t('daysOverdue')}</th>
                              <th className="pb-3 text-center">{t('bucket')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--color-line)]/60 dark:divide-[#272F3A]/60">
                            {(receivables?.invoices || []).slice(0, 10).map((inv) => (
                              <tr
                                key={inv.invoice_number || inv.party_name + inv.invoice_date}
                                className="hover:bg-[var(--color-surface-2)]/50 dark:hover:bg-[#1C222B]/50 transition-colors"
                              >
                                <td className="py-3 pr-4 font-bold text-[var(--color-text)] max-w-[180px] truncate">
                                  {inv.party_name}
                                </td>
                                <td className="py-3 pr-4 font-mono text-[11px] text-[var(--color-muted)]">
                                  <div className="flex items-center gap-1.5">
                                    <span>{inv.invoice_number || '–'}</span>
                                    {inv.has_possible_payment && (
                                      <span
                                        title={t('possiblePayment')}
                                        className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#FEF3C7] text-[#92400E] dark:bg-[#78350F] dark:text-[#FDE68A]"
                                      >
                                        ?
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 pr-4 text-[var(--color-muted)] tabular-nums">
                                  {formatDate(inv.due_date)}
                                </td>
                                <td className="py-3 pr-4 text-right font-bold tabular-nums text-[var(--color-text)]">
                                  {formatIndianRupees(inv.outstanding)}
                                </td>
                                <td className="py-3 pr-4 text-center tabular-nums font-semibold">
                                  <span className="text-[#D92D20] dark:text-[#F87171]">
                                    {inv.days_overdue}d
                                  </span>
                                </td>
                                <td className="py-3 text-center">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                      BUCKET_COLORS[inv.bucket]?.badge
                                    }`}
                                  >
                                    {t(`buckets.${inv.bucket}`)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {(!receivables?.invoices || receivables.invoices.length === 0) && (
                          <p className="text-center py-8 text-xs text-[var(--color-muted)]">
                            {t('noInvoicesFound')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
