import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import {
  Plus,
  ArrowUpRight,
  IndianRupee,
  Receipt,
  TrendingUp,
  FileText,
  Lock,
  Activity,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Wallet,
} from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout'
import { Skeleton } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { usePlan } from '../context/PlanContext'
import { FEATURES, FEATURE_ROUTES } from '../lib/featuresData'
import { useCatalog } from '../lib/useCatalog'
import { getCashSummary } from '../lib/api'
import { useBusiness } from '../context/BusinessContext'

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

const CATEGORY_LABELS = {
  sales_upi: 'Sales UPI',
  emi: 'EMI',
  od_interest: 'OD interest',
  gst_payment: 'GST payment',
}

function formatCategory(cat) {
  if (!cat) return 'Uncategorized'
  if (CATEGORY_LABELS[cat]) return CATEGORY_LABELS[cat]
  return cat
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatDateDisplay(isoStr) {
  if (!isoStr) return ''
  try {
    const d = new Date(isoStr)
    if (isNaN(d.getTime())) return isoStr
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return isoStr
  }
}

function generateSparkline(values) {
  if (!values || values.length === 0) return ''
  if (values.length === 1) return 'M2 12 L62 12'
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  return values
    .map((v, i) => {
      const x = 2 + (i / (values.length - 1)) * 60
      const y = 20 - ((v - min) / range) * 16
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

function AnimatedNumber({ value, prefix = '', suffix = '', duration = 1000 }) {
  const [displayValue, setDisplayValue] = useState(0)
  const isNegative = typeof value === 'number' && value < 0
  const numericTarget = typeof value === 'number'
    ? Math.abs(Math.round(value))
    : parseInt(String(value || '0').replace(/\D/g, ''), 10) || 0

  useEffect(() => {
    let startTimestamp = null
    let animationFrameId

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp
      const progress = Math.min((timestamp - startTimestamp) / duration, 1)
      const easeOut = 1 - Math.pow(1 - progress, 3)
      setDisplayValue(Math.floor(easeOut * numericTarget))
      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step)
      } else {
        setDisplayValue(numericTarget)
      }
    }

    animationFrameId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(animationFrameId)
  }, [numericTarget, duration])

  if (typeof value !== 'number' && !numericTarget) {
    return <span>{value ?? '–'}</span>
  }

  const formatted = displayValue.toLocaleString('en-IN')
  return (
    <span>
      {isNegative ? '-' : ''}
      {prefix}
      {formatted}
      {suffix}
    </span>
  )
}

export default function FeatureDashboardPage() {
  const { user } = useAuth()
  const { plan } = usePlan()
  const navigate = useNavigate()
  const { t } = useTranslation('dashboard')
  const { t: tTeam } = useTranslation('team')
  const { featureName, featureTagline, featureDescription, tierName, customPlanName } = useCatalog()

  const rawName = user?.displayName || user?.name || user?.email || ''
  const firstName = rawName.split(' ')[0] || t('page.partner')

  const hour = new Date().getHours()
  const greetingKey = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'

  const { role, isOwner, effectiveFeatures } = useBusiness()
  const planFeatureIds = role ? effectiveFeatures : (plan?.featureIds || ['document_parser'])
  const canUpload = planFeatureIds.includes('document_parser')

  const [loading, setLoading] = useState(true)
  const [cashData, setCashData] = useState(null)
  const [error, setError] = useState(null)
  const [hoveredMonthIdx, setHoveredMonthIdx] = useState(null)

  const loadCashData = () => {
    setLoading(true)
    setError(null)
    getCashSummary()
      .then((data) => {
        setCashData(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err)
        setLoading(false)
      })
  }

  useEffect(() => {
    loadCashData()
  }, [])

  const isLocked = Boolean(
    error && (error.status === 402 || error.status === 403 || error.code === 'feature_not_available' || error.code === 'payment_required')
  )

  const months = useMemo(() => cashData?.months || [], [cashData])

  // Sparkline arrays from month history
  const closingBalanceHistory = useMemo(() => {
    if (!months.length) return []
    return months.map((m) => m.closing_balance ?? 0)
  }, [months])

  const moneyInHistory = useMemo(() => {
    if (!months.length) return []
    return months.map((m) => m.money_in ?? 0)
  }, [months])

  const moneyOutHistory = useMemo(() => {
    if (!months.length) return []
    return months.map((m) => m.money_out ?? 0)
  }, [months])

  // Max value calculation for the SVG chart
  const maxChartVal = useMemo(() => {
    if (!months.length) return 1
    const vals = months.flatMap((m) => [
      m.money_in || 0,
      m.money_out || 0,
      Math.abs(m.closing_balance || 0),
    ])
    return Math.max(1, ...vals)
  }, [months])

  return (
    <DashboardLayout activeItem="Dashboard">
      <div className="space-y-8 max-w-7xl mx-auto">
        {/* Personalized Greeting */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="inline-block rounded-md bg-[var(--color-surface-2)] dark:bg-[#1C222B] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[var(--color-accent)] border border-[var(--color-line)] dark:border-[#272F3A]">
              {t('page.overview')}
            </span>
            <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-extrabold text-[var(--color-text)] tracking-tight">
              {t(`page.greeting.${greetingKey}`, { name: firstName })}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[var(--color-muted)]">
              {t('page.subtitle')}
            </p>
          </div>

          <button
            onClick={() => navigate('/upload')}
            hidden={!canUpload}
            className="self-start sm:self-auto flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-[var(--color-accent)]/20 hover:brightness-110 transition-all duration-300 ease-out transform active:scale-95 cursor-pointer"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            <span>{t('page.upload')}</span>
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
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-9 w-9 rounded-xl" />
                  </div>
                  <Skeleton className="h-8 w-36" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
            <div className="rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-6 space-y-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-56 w-full" />
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
              {t('page.cash.lockedTitle')}
            </h2>
            <p className="mt-2 text-sm text-[var(--color-muted)] max-w-md mx-auto">
              {t('page.cash.lockedSubtitle')}
            </p>
            <div className="mt-6 flex justify-center">
              {isOwner ? (
                <button
                  onClick={() => navigate('/billing')}
                  className="rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-[var(--color-accent)]/20 hover:brightness-110 transition-all cursor-pointer"
                >
                  {t('page.cash.upgradePlan')}
                </button>
              ) : (
                <span className="text-xs text-[var(--color-muted)]">
                  {t('page.cash.contactOwner')}
                </span>
              )}
            </div>
          </div>
        )}

        {/* GENERIC ERROR STATE */}
        {!loading && error && !isLocked && (
          <div className="rounded-3xl border border-[#FBD0D6] dark:border-[#52222E] bg-white dark:bg-[#151A21] p-8 sm:p-10 text-center shadow-[var(--shadow-cool-md)]">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FDE7EA] dark:bg-[#3A1C24] text-[#D92D20] dark:text-[#F87171]">
              <AlertTriangle className="h-6 w-6" strokeWidth={2} />
            </div>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-lg font-bold text-[var(--color-text)]">
              {t('page.cash.errorTitle')}
            </h2>
            <p className="mt-1 text-xs text-[var(--color-muted)] max-w-md mx-auto">
              {error.message || 'Could not fetch cash dashboard data.'}
            </p>
            <button
              onClick={loadCashData}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2 text-xs font-bold text-white hover:brightness-110 transition-all cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>{t('page.cash.retry')}</span>
            </button>
          </div>
        )}

        {/* MAIN DASHBOARD CONTENT (WHEN LOADED AND ACCESSIBLE) */}
        {!loading && cashData && (
          <>
            {/* 4 STAT CARDS ROW */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Card 1: Cash balance (closing_balance) */}
              <div className="group rounded-2xl border border-[#C8D6F2] dark:border-[#223152] bg-[#E4ECFF] dark:bg-[#16213A] p-5 shadow-xs hover:-translate-y-1 hover:shadow-[var(--shadow-cool-md)] transition-all duration-350 ease-out flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--color-muted)]">
                      {t('page.cash.balance')}
                    </span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 dark:bg-[#141F38] text-[var(--color-accent)] shadow-xs">
                      <Wallet className="h-4 w-4" strokeWidth={2.2} />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <p
                      className={`font-[family-name:var(--font-display)] text-2xl font-extrabold tabular-nums ${
                        cashData.closing_balance < 0
                          ? 'text-[#D92D20] dark:text-[#F87171]'
                          : 'text-[var(--color-text)]'
                      }`}
                    >
                      <AnimatedNumber value={cashData.closing_balance} prefix="₹" />
                    </p>
                    {cashData.closing_balance < 0 && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#FDE7EA] text-[#D92D20] dark:bg-[#3A1C24] dark:text-[#F87171] uppercase tracking-wider">
                        {t('page.cash.overdraft')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 pt-2 border-t border-[#C8D6F2]/60 dark:border-[#223152]/60">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--color-muted)] truncate">
                    <span>
                      {cashData.as_of
                        ? t('page.cash.asOf', { date: formatDateDisplay(cashData.as_of) })
                        : t('page.cash.noTransactions')}
                    </span>
                  </div>
                  {/* Real Sparkline: Monthly Closing Balance */}
                  <svg className="w-16 h-6 overflow-visible shrink-0" viewBox="0 0 64 24" fill="none">
                    {closingBalanceHistory.length > 0 ? (
                      <motion.path
                        d={generateSparkline(closingBalanceHistory)}
                        stroke="#2F5BFF"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                      />
                    ) : (
                      <line x1="2" y1="12" x2="62" y2="12" stroke="#2F5BFF" strokeWidth="1.5" strokeDasharray="3 3" />
                    )}
                  </svg>
                </div>
              </div>

              {/* Card 2: Money In */}
              <div className="group rounded-2xl border border-[#C2EDD5] dark:border-[#1E4A3F] bg-[#E3F6EC] dark:bg-[#12302A] p-5 shadow-xs hover:-translate-y-1 hover:shadow-[var(--shadow-cool-md)] transition-all duration-350 ease-out flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--color-muted)]">
                      {t('page.cash.moneyIn')}
                    </span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 dark:bg-[#1A3D35] text-[#12A06B] shadow-xs">
                      <TrendingUp className="h-4 w-4" strokeWidth={2.2} />
                    </div>
                  </div>
                  <p className="mt-3 font-[family-name:var(--font-display)] text-2xl font-extrabold text-[#12A06B] dark:text-[#34D399] tabular-nums">
                    <AnimatedNumber value={cashData.money_in} prefix="₹" />
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 pt-2 border-t border-[#C2EDD5]/60 dark:border-[#1E4A3F]/60">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--color-muted)] truncate">
                    <span>
                      {cashData.owner_capital_in > 0
                        ? `Capital: ${formatIndianRupees(cashData.owner_capital_in)}`
                        : t('page.cash.moneyIn')}
                    </span>
                  </div>
                  {/* Real Sparkline: Monthly Money In */}
                  <svg className="w-16 h-6 overflow-visible shrink-0" viewBox="0 0 64 24" fill="none">
                    {moneyInHistory.length > 0 ? (
                      <motion.path
                        d={generateSparkline(moneyInHistory)}
                        stroke="#12A06B"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
                      />
                    ) : (
                      <line x1="2" y1="12" x2="62" y2="12" stroke="#12A06B" strokeWidth="1.5" strokeDasharray="3 3" />
                    )}
                  </svg>
                </div>
              </div>

              {/* Card 3: Money Out */}
              <div className="group rounded-2xl border border-[#FDE1C3] dark:border-[#523A20] bg-[#FFF1E0] dark:bg-[#3A2A18] p-5 shadow-xs hover:-translate-y-1 hover:shadow-[var(--shadow-cool-md)] transition-all duration-350 ease-out flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--color-muted)]">
                      {t('page.cash.moneyOut')}
                    </span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 dark:bg-[#4A321B] text-[#FF8A1F] shadow-xs">
                      <Receipt className="h-4 w-4" strokeWidth={2.2} />
                    </div>
                  </div>
                  <p className="mt-3 font-[family-name:var(--font-display)] text-2xl font-extrabold text-[#FF8A1F] tabular-nums">
                    <AnimatedNumber value={cashData.money_out} prefix="₹" />
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 pt-2 border-t border-[#FDE1C3]/60 dark:border-[#523A20]/60">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--color-muted)] truncate">
                    <span>
                      {cashData.owner_drawings_out > 0
                        ? `Drawings: ${formatIndianRupees(cashData.owner_drawings_out)}`
                        : t('page.cash.moneyOut')}
                    </span>
                  </div>
                  {/* Real Sparkline: Monthly Money Out */}
                  <svg className="w-16 h-6 overflow-visible shrink-0" viewBox="0 0 64 24" fill="none">
                    {moneyOutHistory.length > 0 ? (
                      <motion.path
                        d={generateSparkline(moneyOutHistory)}
                        stroke="#FF8A1F"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                      />
                    ) : (
                      <line x1="2" y1="12" x2="62" y2="12" stroke="#FF8A1F" strokeWidth="1.5" strokeDasharray="3 3" />
                    )}
                  </svg>
                </div>
              </div>

              {/* Card 4: Documents Count */}
              <div className="group rounded-2xl border border-[#FBD0D6] dark:border-[#52222E] bg-[#FDE7EA] dark:bg-[#3A1C24] p-5 shadow-xs hover:-translate-y-1 hover:shadow-[var(--shadow-cool-md)] transition-all duration-350 ease-out flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--color-muted)]">
                      {t('page.cash.documents')}
                    </span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 dark:bg-[#4E222D] text-[#E0457B] shadow-xs">
                      <FileText className="h-4 w-4" strokeWidth={2.2} />
                    </div>
                  </div>
                  <p className="mt-3 font-[family-name:var(--font-display)] text-2xl font-extrabold text-[var(--color-text)] tabular-nums">
                    <AnimatedNumber value={cashData.documents_count ?? 0} />
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 pt-2 border-t border-[#FBD0D6]/60 dark:border-[#52222E]/60">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--color-muted)]">
                    <span>{t('page.cash.documentsNote')}</span>
                  </div>
                  <svg className="w-16 h-6 overflow-visible shrink-0" viewBox="0 0 64 24" fill="none">
                    <motion.path
                      d="M2 18 L18 14 L34 16 L50 8 L62 4"
                      stroke="#E0457B"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* NOTICES: LOWEST BALANCE & UNCATEGORIZED ROWS */}
            {((cashData.lowest_balance !== null && cashData.lowest_balance !== undefined && cashData.lowest_balance < 0) || (cashData.uncategorized_rows > 0)) && (
              <div className="flex flex-col sm:flex-row gap-3">
                {cashData.lowest_balance !== null && cashData.lowest_balance < 0 && (
                  <div className="flex-1 flex items-center gap-2.5 rounded-xl border border-[#FBD0D6] dark:border-[#52222E] bg-[#FDE7EA]/80 dark:bg-[#3A1C24]/80 px-4 py-2.5 text-xs text-[#D92D20] dark:text-[#F87171] font-semibold">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>
                      {t('page.cash.lowestBalanceNotice', {
                        amount: formatIndianRupees(cashData.lowest_balance),
                        date: formatDateDisplay(cashData.lowest_balance_date),
                      })}
                    </span>
                  </div>
                )}
                {cashData.uncategorized_rows > 0 && (
                  <div className="flex items-center gap-2.5 rounded-xl border border-[#FDE1C3] dark:border-[#523A20] bg-[#FFF1E0]/80 dark:bg-[#3A2A18]/80 px-4 py-2.5 text-xs text-[#B7791F] dark:text-[#FBBF24] font-semibold">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>
                      {cashData.uncategorized_rows === 1
                        ? t('page.cash.rowsNeedReview_one', { count: 1 })
                        : t('page.cash.rowsNeedReview_other', { count: cashData.uncategorized_rows })}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* EMPTY STATE IF HAS_DATA IS FALSE */}
            {!cashData.has_data ? (
              <div className="rounded-3xl border border-dashed border-[var(--color-line)] dark:border-[#272F3A] bg-[var(--color-surface-2)]/40 dark:bg-[#161C25]/40 p-8 sm:p-12 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white dark:bg-[#151A21] text-[var(--color-accent)] shadow-xs">
                  <Receipt className="h-7 w-7" strokeWidth={2} />
                </div>
                <h3 className="mt-4 font-[family-name:var(--font-display)] text-lg font-bold text-[var(--color-text)]">
                  {t('page.cash.emptyTitle')}
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-[var(--color-muted)] max-w-md mx-auto">
                  {t('page.cash.emptySubtitle')}
                </p>
                <div className="mt-6">
                  <button
                    onClick={() => navigate('/upload')}
                    className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-[var(--color-accent)]/20 hover:brightness-110 transition-all cursor-pointer"
                  >
                    <Plus className="h-4 w-4" strokeWidth={2.5} />
                    <span>{t('page.cash.uploadStatement')}</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* BIG CHART: MONTHLY MONEY IN VS MONEY OUT + CLOSING BALANCE LINE */}
                <div className="relative rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-6 sm:p-7 shadow-[var(--shadow-cool-md)] hover:shadow-[var(--shadow-cool-lg)] transition-all duration-350 ease-out">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[var(--color-line)] dark:border-[#272F3A]">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-accent)] shadow-xs">
                        <Activity className="h-5 w-5" strokeWidth={2.2} />
                      </div>
                      <div>
                        <h3 className="font-[family-name:var(--font-display)] text-base sm:text-lg font-bold text-[var(--color-text)]">
                          {t('page.cash.chartTitle')}
                        </h3>
                        <p className="text-xs text-[var(--color-muted)] mt-0.5">
                          {t('page.cash.chartSubtitle')} &middot; {formatIndianRupees(cashData.money_in)} {t('page.cash.moneyIn')} &middot; {formatIndianRupees(cashData.money_out)} {t('page.cash.moneyOut')}
                        </p>
                      </div>
                    </div>

                    {/* Chart Legend */}
                    <div className="flex items-center gap-4 text-xs font-semibold">
                      <div className="flex items-center gap-1.5 text-[var(--color-muted)]">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#12A06B] shadow-xs" />
                        <span className="text-[11px] font-medium text-[var(--color-text)]">{t('page.cash.moneyIn')}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[var(--color-muted)]">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#FF8A1F] shadow-xs" />
                        <span className="text-[11px] font-medium text-[var(--color-text)]">{t('page.cash.moneyOut')}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[var(--color-muted)]">
                        <span className="h-2 w-4 rounded-full bg-[#2F5BFF] shadow-xs" />
                        <span className="text-[11px] font-medium text-[var(--color-text)]">{t('page.cash.closingBalance')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Hand-built SVG Chart */}
                  <div className="relative mt-6 pt-2">
                    <svg
                      className="w-full h-64 sm:h-72 overflow-visible"
                      viewBox="0 0 700 240"
                      preserveAspectRatio="none"
                    >
                      <defs>
                        <filter id="cashLineGlow" x="-20%" y="-20%" width="140%" height="140%">
                          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#2F5BFF" floodOpacity="0.35" />
                        </filter>
                      </defs>

                      {/* Background horizontal grid lines */}
                      <line x1="40" y1="40" x2="680" y2="40" stroke="currentColor" className="text-[var(--color-line)] dark:text-[#272F3A]" strokeDasharray="4 4" strokeWidth="1" />
                      <line x1="40" y1="90" x2="680" y2="90" stroke="currentColor" className="text-[var(--color-line)] dark:text-[#272F3A]" strokeDasharray="4 4" strokeWidth="1" />
                      <line x1="40" y1="140" x2="680" y2="140" stroke="currentColor" className="text-[var(--color-line)] dark:text-[#272F3A]" strokeDasharray="4 4" strokeWidth="1" />
                      <line x1="40" y1="190" x2="680" y2="190" stroke="currentColor" className="text-[var(--color-line)] dark:text-[#272F3A]" strokeWidth="1.2" />

                      {/* Grouped Bars for Months */}
                      {months.map((m, idx) => {
                        const totalColWidth = 640 / months.length
                        const centerX = 40 + (idx + 0.5) * totalColWidth
                        const groupWidth = Math.min(56, Math.max(16, totalColWidth * 0.55))
                        const barWidth = groupWidth / 2 - 2

                        const inHeight = Math.max(3, ((m.money_in || 0) / maxChartVal) * 150)
                        const outHeight = Math.max(3, ((m.money_out || 0) / maxChartVal) * 150)

                        const inX = centerX - barWidth - 1
                        const outX = centerX + 1
                        const inY = 190 - inHeight
                        const outY = 190 - outHeight

                        const isHovered = hoveredMonthIdx === idx

                        return (
                          <g key={m.month}>
                            {/* Hover highlight background */}
                            {isHovered && (
                              <rect
                                x={centerX - totalColWidth / 2 + 4}
                                y={20}
                                width={totalColWidth - 8}
                                height={180}
                                rx="8"
                                className="fill-[var(--color-surface-2)]/60 dark:fill-[#1C222B]/60"
                              />
                            )}

                            {/* Money In Bar (Green) */}
                            <motion.rect
                              x={inX}
                              y={inY}
                              width={barWidth}
                              height={inHeight}
                              rx="4"
                              fill="#12A06B"
                              initial={{ scaleY: 0, originY: 1 }}
                              animate={{ scaleY: 1 }}
                              transition={{ duration: 0.8, delay: idx * 0.05, ease: [0.16, 1, 0.3, 1] }}
                              className={`transition-opacity ${isHovered ? 'opacity-100' : 'opacity-90'}`}
                            />

                            {/* Money Out Bar (Saffron) */}
                            <motion.rect
                              x={outX}
                              y={outY}
                              width={barWidth}
                              height={outHeight}
                              rx="4"
                              fill="#FF8A1F"
                              initial={{ scaleY: 0, originY: 1 }}
                              animate={{ scaleY: 1 }}
                              transition={{ duration: 0.8, delay: 0.05 + idx * 0.05, ease: [0.16, 1, 0.3, 1] }}
                              className={`transition-opacity ${isHovered ? 'opacity-100' : 'opacity-90'}`}
                            />

                            {/* Month Label below bar */}
                            <text
                              x={centerX}
                              y={212}
                              textAnchor="middle"
                              className="fill-[var(--color-muted)] text-[11px] font-semibold font-[family-name:var(--font-data)]"
                            >
                              {m.month}
                            </text>

                            {/* Invisible overlay rect for mouse hover */}
                            <rect
                              x={centerX - totalColWidth / 2}
                              y={10}
                              width={totalColWidth}
                              height={210}
                              fill="transparent"
                              className="cursor-pointer"
                              onMouseEnter={() => setHoveredMonthIdx(idx)}
                              onMouseLeave={() => setHoveredMonthIdx(null)}
                            />
                          </g>
                        )
                      })}

                      {/* Monthly Closing Balance Line */}
                      {months.length > 0 && (
                        <>
                          <motion.path
                            d={months
                              .map((m, idx) => {
                                const totalColWidth = 640 / months.length
                                const cx = 40 + (idx + 0.5) * totalColWidth
                                const bal = m.closing_balance ?? 0
                                const cy = Math.max(25, Math.min(190, 190 - (bal / maxChartVal) * 150))
                                return `${idx === 0 ? 'M' : 'L'} ${cx.toFixed(1)} ${cy.toFixed(1)}`
                              })
                              .join(' ')}
                            fill="none"
                            stroke="#2F5BFF"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            filter="url(#cashLineGlow)"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                          />

                          {/* Dots along closing balance line */}
                          {months.map((m, idx) => {
                            const totalColWidth = 640 / months.length
                            const cx = 40 + (idx + 0.5) * totalColWidth
                            const bal = m.closing_balance ?? 0
                            const cy = Math.max(25, Math.min(190, 190 - (bal / maxChartVal) * 150))
                            const isHovered = hoveredMonthIdx === idx
                            return (
                              <circle
                                key={`dot-${m.month}`}
                                cx={cx}
                                cy={cy}
                                r={isHovered ? 5.5 : 3.5}
                                fill="#2F5BFF"
                                stroke="#FFFFFF"
                                strokeWidth={isHovered ? 2.5 : 1.5}
                                className="transition-all duration-200 pointer-events-none"
                              />
                            )
                          })}
                        </>
                      )}
                    </svg>

                    {/* Interactive Hover Tooltip */}
                    {hoveredMonthIdx !== null && months[hoveredMonthIdx] && (
                      <div
                        className="absolute top-2 z-20 pointer-events-none transform -translate-x-1/2 rounded-xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#1C222B] p-3 shadow-lg text-xs"
                        style={{
                          left: `${((40 + (hoveredMonthIdx + 0.5) * (640 / months.length)) / 700) * 100}%`,
                        }}
                      >
                        <div className="font-bold text-[var(--color-text)] pb-1.5 mb-1.5 border-b border-[var(--color-line)] dark:border-[#272F3A]">
                          {months[hoveredMonthIdx].month}
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between gap-4">
                            <span className="text-[#12A06B] font-medium">{t('page.cash.moneyIn')}:</span>
                            <span className="font-bold tabular-nums text-[var(--color-text)]">
                              {formatIndianRupees(months[hoveredMonthIdx].money_in)}
                            </span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-[#FF8A1F] font-medium">{t('page.cash.moneyOut')}:</span>
                            <span className="font-bold tabular-nums text-[var(--color-text)]">
                              {formatIndianRupees(months[hoveredMonthIdx].money_out)}
                            </span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-[var(--color-muted)] font-medium">{t('page.cash.net')}:</span>
                            <span className={`font-bold tabular-nums ${months[hoveredMonthIdx].net < 0 ? 'text-[#D92D20]' : 'text-[var(--color-text)]'}`}>
                              {formatIndianRupees(months[hoveredMonthIdx].net)}
                            </span>
                          </div>
                          <div className="flex justify-between gap-4 pt-1 border-t border-[var(--color-line)] dark:border-[#272F3A]">
                            <span className="text-[#2F5BFF] font-semibold">{t('page.cash.closingBalance')}:</span>
                            <span className={`font-bold tabular-nums ${months[hoveredMonthIdx].closing_balance < 0 ? 'text-[#D92D20]' : 'text-[#2F5BFF]'}`}>
                              {formatIndianRupees(months[hoveredMonthIdx].closing_balance)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* TWO BREAKDOWN TABLES: WHERE MONEY WENT & WHERE MONEY CAME FROM */}
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Where the money came from (in_by_category) */}
                  <div className="rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-6 shadow-[var(--shadow-cool-md)]">
                    <div className="flex items-center justify-between pb-4 border-b border-[var(--color-line)] dark:border-[#272F3A]">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E3F6EC] dark:bg-[#12302A] text-[#12A06B]">
                          <TrendingUp className="h-4 w-4" />
                        </div>
                        <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-[var(--color-text)]">
                          {t('page.cash.whereCame')}
                        </h3>
                      </div>
                      <span className="text-xs font-bold text-[#12A06B] dark:text-[#34D399]">
                        {formatIndianRupees(cashData.money_in)}
                      </span>
                    </div>

                    <div className="mt-4 space-y-3.5">
                      {cashData.in_by_category && cashData.in_by_category.length > 0 ? (
                        cashData.in_by_category.map((cat) => (
                          <div key={cat.category} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-[var(--color-text)]">
                                {formatCategory(cat.category)}
                              </span>
                              <div className="flex items-center gap-3">
                                <span className="text-[var(--color-muted)] font-medium">
                                  {cat.share_pct.toFixed(1)}%
                                </span>
                                <span className="font-bold text-[var(--color-text)] tabular-nums">
                                  {formatIndianRupees(cat.amount)}
                                </span>
                              </div>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-[var(--color-surface-2)] dark:bg-[#1C222B] overflow-hidden">
                              <div
                                className="h-full rounded-full bg-[#12A06B]"
                                style={{ width: `${Math.min(100, Math.max(2, cat.share_pct))}%` }}
                              />
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-[var(--color-muted)] py-4 text-center">
                          {t('page.cash.noInflows')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Where the money went (out_by_category) */}
                  <div className="rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-6 shadow-[var(--shadow-cool-md)]">
                    <div className="flex items-center justify-between pb-4 border-b border-[var(--color-line)] dark:border-[#272F3A]">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF1E0] dark:bg-[#3A2A18] text-[#FF8A1F]">
                          <Receipt className="h-4 w-4" />
                        </div>
                        <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-[var(--color-text)]">
                          {t('page.cash.whereWent')}
                        </h3>
                      </div>
                      <span className="text-xs font-bold text-[#FF8A1F]">
                        {formatIndianRupees(cashData.money_out)}
                      </span>
                    </div>

                    <div className="mt-4 space-y-3.5">
                      {cashData.out_by_category && cashData.out_by_category.length > 0 ? (
                        cashData.out_by_category.map((cat) => (
                          <div key={cat.category} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-[var(--color-text)]">
                                {formatCategory(cat.category)}
                              </span>
                              <div className="flex items-center gap-3">
                                <span className="text-[var(--color-muted)] font-medium">
                                  {cat.share_pct.toFixed(1)}%
                                </span>
                                <span className="font-bold text-[var(--color-text)] tabular-nums">
                                  {formatIndianRupees(cat.amount)}
                                </span>
                              </div>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-[var(--color-surface-2)] dark:bg-[#1C222B] overflow-hidden">
                              <div
                                className="h-full rounded-full bg-[#FF8A1F]"
                                style={{ width: `${Math.min(100, Math.max(2, cat.share_pct))}%` }}
                              />
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-[var(--color-muted)] py-4 text-center">
                          {t('page.cash.noOutflows')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* TOOLS & FEATURES SECTION */}
        <div>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--color-text)] tracking-tight">
                {t('page.tools.title')}
              </h2>
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                {isOwner
                  ? t('page.tools.subtitle', { plan: plan?.type === 'tier' ? tierName(plan.tierId) : customPlanName() })
                  : t('page.tools.subtitleMember', { role: tTeam(`roles.${role}`) })}
              </p>
            </div>
            <button
              onClick={() => navigate('/billing')}
              hidden={!isOwner}
              className="text-xs font-bold text-[var(--color-accent)] hover:underline cursor-pointer"
            >
              {t('page.tools.upgrade')}
            </button>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, idx) => {
              const isEnabled = planFeatureIds.includes(feature.id)
              const route = FEATURE_ROUTES[feature.id]

              const handleFeatureClick = () => {
                if (feature.id === 'cash_dashboard') {
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                } else if (route) {
                  navigate(route)
                }
              }

              return (
                <motion.div
                  key={feature.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: idx * 0.08, ease: [0.16, 1, 0.3, 1] }}
                  className={`flex flex-col justify-between rounded-2xl border p-6 transition-all duration-350 ease-out ${
                    isEnabled
                      ? 'border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] shadow-xs hover:-translate-y-1 hover:shadow-[var(--shadow-cool-md)] hover:border-[var(--color-accent)]/50'
                      : 'border-[var(--color-line)] dark:border-[#272F3A] bg-[var(--color-surface-2)]/60 dark:bg-[#161C25]/60 opacity-75'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-[var(--color-text)]">
                        {featureName(feature.id)}
                      </h3>
                      {isEnabled ? (
                        <span className="rounded-full bg-[var(--color-surface-2)] dark:bg-[#1C222B] px-2.5 py-0.5 text-[10px] font-bold text-[var(--color-success)] border border-[var(--color-line)] dark:border-[#272F3A]">
                          {t('page.tools.active')}
                        </span>
                      ) : (
                        <span className="rounded-full bg-[var(--color-surface-2)] dark:bg-[#1C222B] px-2.5 py-0.5 text-[10px] font-bold text-[var(--color-muted)] border border-[var(--color-line)] dark:border-[#272F3A]">
                          {t('page.tools.comingSoon')}
                        </span>
                      )}
                    </div>
                    <p className="mt-2.5 text-xs text-[var(--color-muted)] leading-relaxed">
                      {featureDescription(feature.id)}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-[var(--color-line)] dark:border-[#272F3A] flex items-center justify-between">
                    <span className="text-[11px] font-medium text-[var(--color-muted)] truncate max-w-[150px]">
                      {featureTagline(feature.id)}
                    </span>

                    {isEnabled ? (
                      route ? (
                        feature.id === 'document_parser' ? (
                          <button
                            onClick={handleFeatureClick}
                            className="rounded-xl bg-[var(--color-accent)] px-4 py-2 text-xs font-bold text-white shadow-xs hover:brightness-110 transition-all duration-300 ease-out cursor-pointer"
                          >
                            {t('page.tools.useNow')}
                          </button>
                        ) : (
                          <button
                            onClick={handleFeatureClick}
                            className="rounded-xl border border-[var(--color-accent)] px-4 py-2 text-xs font-bold text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-white transition-all duration-300 ease-out cursor-pointer"
                          >
                            {t('page.tools.openTool')}
                          </button>
                        )
                      ) : (
                        <button
                          disabled
                          className="rounded-xl border border-[var(--color-line)] dark:border-[#272F3A] bg-[var(--color-surface-2)]/60 dark:bg-[#161C25]/60 px-3 py-1.5 text-xs font-semibold text-[var(--color-muted)]/60 cursor-not-allowed"
                        >
                          <span>{t('page.tools.comingSoon')}</span>
                        </button>
                      )
                    ) : (
                      <button
                        disabled
                        className="flex items-center gap-1.5 rounded-xl border border-[var(--color-line)] dark:border-[#272F3A] px-3 py-1.5 text-xs font-semibold text-[var(--color-muted)]/60 cursor-not-allowed"
                      >
                        <Lock className="h-3 w-3" strokeWidth={2} />
                        <span>{t('page.tools.locked')}</span>
                      </button>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
