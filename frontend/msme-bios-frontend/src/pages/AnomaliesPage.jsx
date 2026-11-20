import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Info,
  Lock,
  Plus,
  RefreshCw,
  ArrowUpRight,
  ShieldAlert,
  Layers,
} from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout'
import { Skeleton } from '../components/ui'
import { getAnomalies } from '../lib/api'
import { useBusiness } from '../context/BusinessContext'

function formatIndianRupees(val) {
  if (val === null || val === undefined || isNaN(val)) return '₹0.00'
  const num = Number(val)
  const isNegative = num < 0
  const abs = Math.abs(num)
  const formatted = abs.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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

const RULE_CONFIG = {
  large_owner_withdrawal: {
    color: '#8B5CF6',
    border: 'border-purple-200 dark:border-purple-900/60',
    badge: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400',
  },
  unusual_expense: {
    color: '#EF4444',
    border: 'border-rose-200 dark:border-rose-900/60',
    badge: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400',
  },
  duplicate_payment: {
    color: '#F59E0B',
    border: 'border-amber-200 dark:border-amber-900/60',
    badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  },
  overdue_customer: {
    color: '#3B82F6',
    border: 'border-blue-200 dark:border-blue-900/60',
    badge: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
  },
}

export default function AnomaliesPage() {
  const { t } = useTranslation('anomalies')
  const navigate = useNavigate()
  const { isOwner } = useBusiness()

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [isLocked, setIsLocked] = useState(false)

  // Filter chip selection: 'all' | 'large_owner_withdrawal' | 'unusual_expense' | 'duplicate_payment' | 'overdue_customer'
  const [selectedRule, setSelectedRule] = useState('all')

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getAnomalies()
      setData(res)
      setIsLocked(false)
    } catch (err) {
      if (
        err.status === 403 ||
        err.status === 402 ||
        err.code === 'feature_not_available' ||
        err.code === 'payment_required'
      ) {
        setIsLocked(true)
      } else {
        setError(err.message || t('error.title'))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const anomaliesList = data?.anomalies || []
  const filteredAnomalies = useMemo(() => {
    if (selectedRule === 'all') return anomaliesList
    return anomaliesList.filter((a) => a.rule === selectedRule)
  }, [anomaliesList, selectedRule])

  // Rules list with counts
  const rulesWithCounts = useMemo(() => {
    const byRule = data?.by_rule || {}
    return [
      { id: 'all', label: t('rules.all'), count: data?.total ?? 0 },
      { id: 'large_owner_withdrawal', label: t('rules.large_owner_withdrawal'), count: byRule.large_owner_withdrawal ?? 0 },
      { id: 'unusual_expense', label: t('rules.unusual_expense'), count: byRule.unusual_expense ?? 0 },
      { id: 'duplicate_payment', label: t('rules.duplicate_payment'), count: byRule.duplicate_payment ?? 0 },
      { id: 'overdue_customer', label: t('rules.overdue_customer'), count: byRule.overdue_customer ?? 0 },
    ]
  }, [data, t])

  // SVG bar distribution calculations
  const ruleDistribution = useMemo(() => {
    const total = data?.total || 0
    if (total === 0) return []
    const byRule = data?.by_rule || {}
    const rules = ['large_owner_withdrawal', 'unusual_expense', 'duplicate_payment', 'overdue_customer']
    let currentOffset = 0

    return rules
      .map((r) => {
        const count = byRule[r] || 0
        if (count === 0) return null
        const pct = (count / total) * 100
        const segment = {
          rule: r,
          count,
          pct,
          offset: currentOffset,
          color: RULE_CONFIG[r]?.color || '#3B82F6',
          label: t(`rules.${r}`),
        }
        currentOffset += pct
        return segment
      })
      .filter(Boolean)
  }, [data, t])

  return (
    <DashboardLayout activeItem="Anomalies">
      <div className="space-y-8 max-w-7xl mx-auto min-w-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block rounded-md bg-[var(--color-surface-2)] dark:bg-[#1C222B] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#1E9E6E] border border-[var(--color-line)] dark:border-[#272F3A]">
                {t('department')}
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
            className="self-start sm:self-auto flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2 text-xs font-bold text-white shadow-md shadow-[var(--color-accent)]/20 hover:brightness-110 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            <span>{t('empty.uploadBtn')}</span>
          </button>
        </div>

        {/* LOCKED STATE */}
        {isLocked && (
          <div className="rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-10 text-center shadow-sm space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <Lock className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-bold text-[var(--color-text)]">{t('locked.title')}</h2>
            <p className="max-w-md mx-auto text-sm text-[var(--color-muted)]">
              {t('locked.description')}
            </p>
            {isOwner && (
              <button
                onClick={() => navigate('/billing')}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-xs font-bold text-white shadow-md hover:brightness-110 transition-all cursor-pointer"
              >
                <span>{t('locked.upgradeBtn')}</span>
                <ArrowUpRight className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* ERROR STATE */}
        {!isLocked && error && (
          <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />
              <span className="text-sm font-medium text-rose-800 dark:text-rose-300">{error}</span>
            </div>
            <button
              onClick={fetchData}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-colors cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>{t('error.retry')}</span>
            </button>
          </div>
        )}

        {/* LOADING SKELETON */}
        {loading && !isLocked && !error && (
          <div className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-5 space-y-3"
                >
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-28" />
                  <Skeleton className="h-3 w-full" />
                </div>
              ))}
            </div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-6 space-y-3"
                >
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-60" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CONTENT */}
        {!loading && !isLocked && !error && data && (
          <>
            {/* 4 SUMMARY TILES */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Tile 1: Total Flagged */}
              <div className="rounded-2xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
                    {t('cards.totalFlagged')}
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600">
                    <ShieldAlert className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3 font-[family-name:var(--font-display)] text-2xl font-extrabold text-[var(--color-text)]">
                  {data.total}
                </div>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  {data.total > 0 ? (data.by_severity?.high > 0 ? t('cards.actionRequired') : t('cards.monitorRegularly')) : t('cards.activeMonitor')}
                </p>
              </div>

              {/* Tile 2: High Severity */}
              <div className="rounded-2xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
                    {t('cards.highSeverity')}
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600">
                    <AlertCircle className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3 font-[family-name:var(--font-display)] text-2xl font-extrabold text-rose-600 dark:text-rose-400">
                  {data.by_severity?.high || 0}
                </div>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  {t('cards.actionRequired')}
                </p>
              </div>

              {/* Tile 3: Medium Severity */}
              <div className="rounded-2xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
                    {t('cards.mediumSeverity')}
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600">
                    <Clock className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3 font-[family-name:var(--font-display)] text-2xl font-extrabold text-amber-600 dark:text-amber-400">
                  {data.by_severity?.medium || 0}
                </div>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  {t('cards.monitorRegularly')}
                </p>
              </div>

              {/* Tile 4: As of Date */}
              <div className="rounded-2xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
                    {t('cards.asOfDate')}
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600">
                    <Calendar className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3 font-[family-name:var(--font-display)] text-xl font-bold text-[var(--color-text)] truncate">
                  {formatDate(data.as_of)}
                </div>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  {t('cards.activeMonitor')}
                </p>
              </div>
            </div>

            {/* HAND-BUILT SVG BAR FOR RULE DISTRIBUTION */}
            {data.total > 0 && (
              <div className="rounded-2xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[var(--color-text)]">{t('chart.title')}</span>
                  <span className="text-[var(--color-muted)]">
                    {t('chart.count', { count: data.total })}
                  </span>
                </div>

                {/* SVG Segmented Bar */}
                <div className="w-full">
                  <svg viewBox="0 0 100 8" preserveAspectRatio="none" className="w-full h-2.5 rounded-full overflow-hidden">
                    {ruleDistribution.map((seg) => (
                      <rect
                        key={seg.rule}
                        x={seg.offset}
                        y={0}
                        width={seg.pct}
                        height={8}
                        fill={seg.color}
                      />
                    ))}
                  </svg>
                </div>

                {/* Legend Chips */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-xs">
                  {ruleDistribution.map((seg) => (
                    <div key={seg.rule} className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                      <span className="text-[var(--color-muted)] font-medium">
                        {seg.label}: <strong className="text-[var(--color-text)]">{seg.count}</strong>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* FILTER CHIPS ROW */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
              {rulesWithCounts.map((chip) => {
                const isActive = selectedRule === chip.id
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setSelectedRule(chip.id)}
                    className={`shrink-0 flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                      isActive
                        ? 'bg-[var(--color-text)] text-[var(--color-canvas)] border-[var(--color-text)] shadow-sm'
                        : 'bg-white dark:bg-[#151A21] text-[var(--color-muted)] border-[var(--color-line)] dark:border-[#272F3A] hover:text-[var(--color-text)] hover:border-gray-400'
                    }`}
                  >
                    <span>{chip.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-[var(--color-muted)]'
                      }`}
                    >
                      {chip.count}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* ANOMALIES LIST OR EMPTY STATE */}
            {data.total === 0 || filteredAnomalies.length === 0 ? (
              <div className="rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-12 text-center shadow-sm space-y-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <h2 className="text-xl font-bold text-[var(--color-text)]">
                  {t('empty.title')}
                </h2>
                <p className="max-w-md mx-auto text-sm text-[var(--color-muted)]">
                  {t('empty.description')}
                </p>
                <button
                  onClick={() => navigate('/upload')}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-xs font-bold text-white shadow-md hover:brightness-110 transition-all cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>{t('empty.uploadBtn')}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredAnomalies.map((anom) => {
                  const isHigh = anom.severity === 'high'
                  const ruleCfg = RULE_CONFIG[anom.rule] || RULE_CONFIG.unusual_expense

                  return (
                    <div
                      key={anom.id}
                      className="rounded-2xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-5 sm:p-6 shadow-sm hover:shadow-md transition-all space-y-3"
                    >
                      {/* Top Row: Severity & Rule Badges, Date */}
                      <div className="flex flex-wrap items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2">
                          {/* Severity Badge */}
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold uppercase tracking-wider border ${
                              isHigh
                                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200 dark:border-rose-900/60'
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-900/60'
                            }`}
                          >
                            {isHigh ? (
                              <AlertCircle className="h-3 w-3 shrink-0" />
                            ) : (
                              <Clock className="h-3 w-3 shrink-0" />
                            )}
                            <span>{isHigh ? t('card.high') : t('card.medium')}</span>
                          </span>

                          {/* Rule Badge */}
                          <span className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold ${ruleCfg.badge}`}>
                            {t(`rules.${anom.rule}`)}
                          </span>
                        </div>

                        {/* Date */}
                        <div className="flex items-center gap-1.5 text-xs text-[var(--color-muted)] font-medium">
                          <Calendar className="h-3.5 w-3.5 text-[var(--color-muted)]" />
                          <span>{formatDate(anom.date)}</span>
                        </div>
                      </div>

                      {/* Middle Row: Title & Rupee Amount */}
                      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 pt-1">
                        <h3 className="text-base font-bold text-[var(--color-text)]">
                          {anom.title}
                        </h3>
                        <div className="font-[family-name:var(--font-display)] text-xl font-extrabold text-[var(--color-text)]">
                          {formatIndianRupees(anom.amount)}
                        </div>
                      </div>

                      {/* Plain-English Reason Text */}
                      <p className="text-xs sm:text-sm text-[var(--color-text)] leading-relaxed">
                        {anom.reason}
                      </p>

                      {/* Reference (Bank Narration / Counterparty / Customer) */}
                      {anom.reference && (
                        <div className="pt-2 border-t border-[var(--color-line)] dark:border-[#272F3A] flex items-center gap-2 text-xs text-[var(--color-muted)]">
                          <span className="font-semibold">{t('card.reference')}:</span>
                          <span className="font-mono truncate" title={anom.reference}>
                            {anom.reference}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
