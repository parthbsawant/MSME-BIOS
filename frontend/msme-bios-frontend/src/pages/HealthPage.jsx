import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Plus,
  Lock,
  ArrowUpRight,
  TrendingUp,
  Scale,
  Users,
  ShieldAlert,
  Wallet,
  Info,
  ChevronRight,
} from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout'
import { Skeleton } from '../components/ui'
import { getHealthIndex } from '../lib/api'
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

const COMPONENT_ICONS = {
  liquidity: Wallet,
  cash_trend: TrendingUp,
  receivables: Scale,
  concentration: Users,
  controls: ShieldAlert,
}

const BAND_THEMES = {
  healthy: {
    stroke: '#10B981',
    text: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    border: 'border-emerald-200 dark:border-emerald-900/60',
    bar: 'bg-emerald-500',
  },
  watch: {
    stroke: '#F59E0B',
    text: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-200 dark:border-amber-900/60',
    bar: 'bg-amber-500',
  },
  at_risk: {
    stroke: '#EF4444',
    text: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    border: 'border-rose-200 dark:border-rose-900/60',
    bar: 'bg-rose-500',
  },
}

export default function HealthPage() {
  const { t } = useTranslation('health')
  const navigate = useNavigate()
  const { isOwner } = useBusiness()

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [isLocked, setIsLocked] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getHealthIndex()
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

  // Semicircle gauge math:
  // Center: (120, 115), Radius: 85
  // Arc path from (35, 115) to (205, 115)
  // Arc circumference = PI * 85 = 267.035
  const arcRadius = 85
  const arcCircumference = Math.PI * arcRadius
  const rawScore = data?.score ?? 0
  const scorePercent = Math.max(0, Math.min(100, rawScore))
  const strokeDashoffset = arcCircumference * (1 - scorePercent / 100)

  const currentBandTheme = BAND_THEMES[data?.band] || BAND_THEMES.watch

  const driverComponents = useMemo(() => {
    if (!data?.drivers || !data?.components) return []
    return data.drivers
      .map((key) => data.components.find((c) => c.key === key))
      .filter(Boolean)
  }, [data])

  return (
    <DashboardLayout activeItem="Business Health">
      <div className="space-y-8 w-full max-w-7xl mx-auto min-w-0">
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

          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] px-4 py-2 text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{t('error.retry')}</span>
            </button>
          </div>
        </div>

        {/* LOCKED STATE (402 / 403) */}
        {isLocked && (
          <div className="rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-8 sm:p-12 text-center shadow-sm space-y-4">
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
        {error && !isLocked && (
          <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/20 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-rose-900 dark:text-rose-200">{t('error.title')}</h3>
                <p className="text-xs text-rose-700 dark:text-rose-400">{error}</p>
              </div>
            </div>
            <button
              onClick={fetchData}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-700 transition-all cursor-pointer shrink-0"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>{t('error.retry')}</span>
            </button>
          </div>
        )}

        {/* LOADING SKELETON */}
        {loading && !isLocked && !error && (
          <div className="space-y-8">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-1 rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-6 space-y-4">
                <Skeleton className="h-6 w-32 mx-auto" />
                <Skeleton className="h-40 w-48 mx-auto rounded-full" />
                <Skeleton className="h-8 w-24 mx-auto rounded-lg" />
              </div>
              <div className="lg:col-span-2 rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-6 space-y-4">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-16 w-full rounded-2xl" />
                <Skeleton className="h-16 w-full rounded-2xl" />
              </div>
            </div>
            <div className="rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-6 space-y-4">
              <Skeleton className="h-6 w-48" />
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-2xl" />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* CONTENT */}
        {!loading && !isLocked && !error && data && (
          <>
            {/* EMPTY STATE */}
            {!data.has_data || data.score === null ? (
              <div className="rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-12 text-center shadow-sm space-y-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 dark:bg-[#1C222B] text-[var(--color-muted)]">
                  <Activity className="h-7 w-7" />
                </div>
                <h2 className="text-xl font-bold text-[var(--color-text)]">{t('empty.title')}</h2>
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
              <>
                {/* COVERAGE NOTE (if coverage_pct < 100) */}
                {data.coverage_pct < 100 && (
                  <div className="rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/20 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                        <Info className="h-4 w-4 shrink-0" />
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm font-semibold text-blue-950 dark:text-blue-100">
                          {t('coverage.note', { coverage: data.coverage_pct })}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate('/upload')}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#2F6FDE] text-white px-3.5 py-1.5 text-xs font-bold shadow-xs hover:brightness-110 transition-all cursor-pointer shrink-0"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>{t('empty.uploadBtn')}</span>
                    </button>
                  </div>
                )}

                {/* Top Section: Score Gauge & Drivers Card */}
                <div className="grid gap-6 lg:grid-cols-12">
                  {/* Gauge Card (5 cols on lg) */}
                  <div className="lg:col-span-5 rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-6 sm:p-8 shadow-sm flex flex-col items-center justify-between text-center relative overflow-hidden">
                    <div className="w-full flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
                        {t('title')}
                      </span>
                      <span className="text-xs font-semibold text-[var(--color-muted)]">
                        {data.coverage_pct}% {t('stats.coverage')}
                      </span>
                    </div>

                    {/* SVG Gauge */}
                    <div className="relative my-4 flex items-center justify-center">
                      <svg width="240" height="135" viewBox="0 0 240 135" className="overflow-visible">
                        {/* Background track arc */}
                        <path
                          d="M 35 115 A 85 85 0 0 1 205 115"
                          fill="none"
                          stroke="currentColor"
                          className="text-gray-100 dark:text-[#272F3A]"
                          strokeWidth="16"
                          strokeLinecap="round"
                        />
                        {/* Foreground score arc */}
                        <motion.path
                          d="M 35 115 A 85 85 0 0 1 205 115"
                          fill="none"
                          stroke={currentBandTheme.stroke}
                          strokeWidth="16"
                          strokeLinecap="round"
                          strokeDasharray={arcCircumference}
                          initial={{ strokeDashoffset: arcCircumference }}
                          animate={{ strokeDashoffset }}
                          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                        />
                      </svg>

                      {/* Inside Score Typography */}
                      <div className="absolute inset-0 flex flex-col items-center justify-end pb-1 pointer-events-none">
                        <div className="flex items-baseline">
                          <span className="font-[family-name:var(--font-display)] text-5xl font-extrabold text-[var(--color-text)] tracking-tight">
                            {data.score}
                          </span>
                          <span className="ml-1 text-sm font-semibold text-[var(--color-muted)]">
                            {t('scoreOutOf')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status Pill & Description */}
                    <div className="space-y-2 mt-1">
                      <div
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${currentBandTheme.bg} ${currentBandTheme.text} ${currentBandTheme.border}`}
                      >
                        {data.band === 'healthy' && <CheckCircle2 className="h-3.5 w-3.5" />}
                        {data.band === 'watch' && <AlertTriangle className="h-3.5 w-3.5" />}
                        {data.band === 'at_risk' && <AlertCircle className="h-3.5 w-3.5" />}
                        <span>{t(`bands.${data.band}`)}</span>
                      </div>
                      <p className="text-xs text-[var(--color-muted)] max-w-xs">
                        {t(`bandDescriptions.${data.band}`)}
                      </p>
                    </div>

                    {/* Quick Stats Footnote */}
                    <div className="w-full grid grid-cols-2 gap-2 mt-6 pt-5 border-t border-[var(--color-line)] dark:border-[#272F3A] text-left">
                      <div>
                        <p className="text-[11px] text-[var(--color-muted)] font-medium">
                          {t('stats.closingBalance')}
                        </p>
                        {Number(data.inputs?.closing_balance) < 0 ? (
                          <>
                            <p className="text-sm font-bold text-rose-500 truncate">
                              {t('stats.overdraft')}
                            </p>
                            <p className="text-[11px] text-[var(--color-muted)] truncate">
                              {t('stats.overdrawnBy', { amount: formatIndianRupees(Math.abs(data.inputs.closing_balance)) })}
                            </p>
                          </>
                        ) : (
                          <p className="text-sm font-bold text-[var(--color-text)] truncate">
                            {formatIndianRupees(data.inputs?.closing_balance)}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] text-[var(--color-muted)] font-medium">
                          {t('stats.anomaliesFlagged')}
                        </p>
                        <p className="text-sm font-bold text-[var(--color-text)]">
                          {data.inputs?.anomaly_total ?? 0}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* "What is pulling the score down" Card (7 cols on lg) */}
                  <div className="lg:col-span-7 rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-6 sm:p-8 shadow-sm flex flex-col justify-between space-y-5">
                    <div>
                      <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-[var(--color-text)]">
                          {t('drivers.title')}
                        </h2>
                        <span className="text-xs font-medium text-[var(--color-muted)]">
                          {driverComponents.length} {driverComponents.length === 1 ? 'factor' : 'factors'}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--color-muted)] mt-0.5">
                        {t('drivers.subtitle')}
                      </p>
                    </div>

                    {driverComponents.length > 0 ? (
                      <div className="space-y-3.5">
                        {driverComponents.map((c) => {
                          const IconComp = COMPONENT_ICONS[c.key] || Activity
                          const theme = BAND_THEMES[c.status] || BAND_THEMES.watch
                          return (
                            <div
                              key={c.key}
                              className="rounded-2xl border border-[var(--color-line)] dark:border-[#272F3A] bg-[var(--color-surface-2)]/60 dark:bg-[#1C222B]/70 p-4 sm:p-5 space-y-2.5 transition-all hover:shadow-xs"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                  <div className="p-2 rounded-xl bg-white dark:bg-[#151A21] border border-[var(--color-line)] dark:border-[#272F3A] text-[var(--color-text)]">
                                    <IconComp className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <h3 className="text-sm font-bold text-[var(--color-text)]">
                                      {t(`components.labels.${c.key}`, c.label)}
                                    </h3>
                                    <span className="text-[11px] text-[var(--color-muted)]">
                                      {t('components.weight', { weight: c.effective_weight_pct })}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  {c.points_lost > 0 && (
                                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-extrabold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60">
                                      {t('drivers.pointsLost', { points: c.points_lost })}
                                    </span>
                                  )}
                                  <span
                                    className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${theme.bg} ${theme.text} ${theme.border}`}
                                  >
                                    {c.score} / 100
                                  </span>
                                </div>
                              </div>

                              <p className="text-xs text-[var(--color-text)] leading-relaxed">
                                {c.reason}
                              </p>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/20 p-6 flex items-center gap-3">
                        <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <p className="text-xs sm:text-sm font-medium text-emerald-900 dark:text-emerald-200">
                          {t('drivers.empty')}
                        </p>
                      </div>
                    )}

                    <div className="text-[11px] text-[var(--color-muted)] pt-3 border-t border-[var(--color-line)] dark:border-[#272F3A]">
                      <span>{t('coverage.complete')}</span>
                    </div>
                  </div>
                </div>

                {/* "How the score is built" Breakdown List */}
                <div className="rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-6 sm:p-8 shadow-sm space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-[var(--color-text)]">
                      {t('components.title')}
                    </h2>
                    <p className="text-xs text-[var(--color-muted)] mt-0.5">
                      {t('components.subtitle')}
                    </p>
                  </div>

                  <div className="space-y-4">
                    {data.components.map((c) => {
                      const IconComp = COMPONENT_ICONS[c.key] || Activity
                      const theme = BAND_THEMES[c.status] || BAND_THEMES.watch
                      return (
                        <div
                          key={c.key}
                          className="rounded-2xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-4 sm:p-5 space-y-3 hover:shadow-xs transition-shadow"
                        >
                          {/* Row 1: Icon, Label, Weight, Score & Badge */}
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-xl bg-[var(--color-surface-2)] dark:bg-[#1C222B] text-[var(--color-text)]">
                                <IconComp className="h-4 w-4" />
                              </div>
                              <div>
                                <h3 className="text-sm font-bold text-[var(--color-text)]">
                                  {t(`components.labels.${c.key}`, c.label)}
                                </h3>
                                <p className="text-[11px] text-[var(--color-muted)]">
                                  {t('components.weight', { weight: c.effective_weight_pct })}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 self-end sm:self-auto">
                              <span
                                className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${theme.bg} ${theme.text} ${theme.border}`}
                              >
                                {t(`bands.${c.status}`)}
                              </span>
                              <div className="font-[family-name:var(--font-display)] text-base font-extrabold text-[var(--color-text)]">
                                {c.score} <span className="text-xs font-normal text-[var(--color-muted)]">/ 100</span>
                              </div>
                            </div>
                          </div>

                          {/* Row 2: Progress Bar */}
                          <div className="w-full bg-gray-100 dark:bg-[#1C222B] h-2 rounded-full overflow-hidden">
                            <motion.div
                              className={`h-full ${theme.bar} rounded-full`}
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.max(0, Math.min(100, c.score))}%` }}
                              transition={{ duration: 0.8, ease: 'easeOut' }}
                            />
                          </div>

                          {/* Row 3: Plain-English explanation */}
                          <p className="text-xs text-[var(--color-muted)] leading-relaxed pt-1">
                            {c.reason}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
