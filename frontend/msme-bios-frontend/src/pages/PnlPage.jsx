import { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Calendar,
  Lock,
  ArrowUpRight,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Plus,
  HelpCircle,
  FileText,
  DollarSign,
  Info,
} from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout'
import { Skeleton } from '../components/ui'
import { getPnl } from '../lib/api'
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

function formatMonthLabel(monthStr) {
  if (!monthStr || monthStr.length < 7) return monthStr
  try {
    const [y, m] = monthStr.split('-')
    const d = new Date(Number(y), Number(m) - 1, 1)
    const monthName = d.toLocaleString('en-IN', { month: 'short' })
    const shortYear = y.slice(2)
    return `${monthName} '${shortYear}`
  } catch {
    return monthStr
  }
}

export default function PnlPage() {
  const { t } = useTranslation('pnl')
  const navigate = useNavigate()
  const { isOwner } = useBusiness()

  const [initialLoading, setInitialLoading] = useState(true)
  const [refetching, setRefetching] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [inlineError, setInlineError] = useState(null)
  const [isLocked, setIsLocked] = useState(false)

  // Date filters
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [activePreset, setActivePreset] = useState('full')
  const [hoveredMonthIndex, setHoveredMonthIndex] = useState(null)

  const reqIdRef = useRef(0)
  const isFirstMount = useRef(true)

  const fetchPnlData = async (fDate, tDate) => {
    const currentReq = ++reqIdRef.current
    setRefetching(true)
    setError(null)
    setInlineError(null)

    try {
      const res = await getPnl(fDate || null, tDate || null)
      if (reqIdRef.current === currentReq) {
        setData(res)
        setIsLocked(false)
      }
    } catch (err) {
      if (reqIdRef.current === currentReq) {
        if (
          err.status === 403 ||
          err.status === 402 ||
          err.code === 'feature_not_available' ||
          err.code === 'payment_required'
        ) {
          setIsLocked(true)
        } else if (err.status === 422) {
          setInlineError(err.message || 'Invalid date range specified')
        } else {
          setError(err.message || t('error.title'))
        }
      }
    } finally {
      if (reqIdRef.current === currentReq) {
        setInitialLoading(false)
        setRefetching(false)
      }
    }
  }

  // Initial load
  useEffect(() => {
    fetchPnlData('', '')
  }, [])

  // Refetch when dates change (excluding initial mount)
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      return
    }

    if (fromDate && toDate && fromDate > toDate) {
      setInlineError('From date cannot be after to date')
      return
    }

    fetchPnlData(fromDate, toDate)
  }, [fromDate, toDate])

  // Presets handling
  const applyPreset = (presetKey) => {
    setActivePreset(presetKey)
    const baseTo = data?.available_to ? new Date(data.available_to) : new Date()

    if (presetKey === 'full') {
      setFromDate('')
      setToDate('')
      return
    }

    if (presetKey === 'lastMonth') {
      const start = new Date(baseTo)
      start.setMonth(start.getMonth() - 1)
      setFromDate(start.toISOString().slice(0, 10))
      setToDate(baseTo.toISOString().slice(0, 10))
      return
    }

    if (presetKey === 'last3Months') {
      const start = new Date(baseTo)
      start.setMonth(start.getMonth() - 3)
      setFromDate(start.toISOString().slice(0, 10))
      setToDate(baseTo.toISOString().slice(0, 10))
      return
    }
  }

  const getCategoryLabel = (catKey) => {
    if (!catKey) return ''
    const translated = t(`categories.${catKey}`, { defaultValue: '' })
    return translated || catKey
  }

  // SVG Bar Chart Math
  const chartData = useMemo(() => {
    if (!data?.months || data.months.length === 0) return null
    const months = data.months

    const allNets = months.map((m) => m.net_profit)
    const rawMin = Math.min(0, ...allNets)
    const rawMax = Math.max(0, ...allNets)

    const span = rawMax - rawMin || 1
    const padding = span * 0.15
    const minVal = rawMin - padding
    const maxVal = rawMax + padding
    const range = maxVal - minVal

    const width = 640
    const height = 230
    const padLeft = 60
    const padRight = 30
    const padTop = 25
    const padBottom = 35
    const plotWidth = width - padLeft - padRight
    const plotHeight = height - padTop - padBottom

    const zeroY = padTop + plotHeight - ((0 - minVal) / range) * plotHeight
    const slotWidth = plotWidth / months.length
    const barWidth = Math.min(Math.max(slotWidth * 0.55, 14), 44)

    const bars = months.map((m, i) => {
      const cx = padLeft + (i + 0.5) * slotWidth
      const isPositive = m.net_profit >= 0

      let barTop = zeroY
      let barHeight = 0

      if (isPositive) {
        const yVal = padTop + plotHeight - ((m.net_profit - minVal) / range) * plotHeight
        barTop = yVal
        barHeight = Math.max(zeroY - yVal, 2)
      } else {
        const yVal = padTop + plotHeight - ((m.net_profit - minVal) / range) * plotHeight
        barTop = zeroY
        barHeight = Math.max(yVal - zeroY, 2)
      }

      return {
        month: m.month,
        net: m.net_profit,
        revenue: m.revenue,
        purchases: m.purchases,
        opex: m.operating_costs,
        cx,
        barX: cx - barWidth / 2,
        barTop,
        barWidth,
        barHeight,
        isPositive,
      }
    })

    return {
      width,
      height,
      padLeft,
      padRight,
      padTop,
      padBottom,
      plotWidth,
      plotHeight,
      zeroY,
      bars,
    }
  }, [data])

  const totals = data?.totals || {}
  const isNetPositive = (totals.net_profit ?? 0) >= 0

  return (
    <DashboardLayout activeItem="Profit & Loss">
      {/* Root wrapper with w-full max-w-7xl mx-auto min-w-0 */}
      <div className="w-full max-w-7xl mx-auto min-w-0 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block rounded-md bg-[var(--color-surface-2)] dark:bg-[#1C222B] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#1E9E6E] border border-[var(--color-line)] dark:border-[#272F3A]">
                {t('department')}
              </span>
              {(data?.to || data?.available_to) && (
                <span className="text-xs text-[var(--color-muted)] font-medium">
                  {t('asOf', { date: formatDate(data.to || data.available_to) })}
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
            {refetching && !initialLoading && (
              <span className="flex items-center gap-1.5 text-xs text-[var(--color-muted)] font-medium animate-pulse">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Updating...</span>
              </span>
            )}
            <button
              onClick={() => fetchPnlData(fromDate, toDate)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] px-3.5 py-2 text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-all cursor-pointer shadow-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>{t('error.retry')}</span>
            </button>
          </div>
        </div>

        {/* Date Filter & Preset Controls */}
        <div className="rounded-2xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-4 sm:p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-[var(--color-muted)] uppercase tracking-wider mr-1">
              Presets:
            </span>
            <button
              type="button"
              onClick={() => applyPreset('full')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                activePreset === 'full' && !fromDate && !toDate
                  ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)] shadow-xs'
                  : 'bg-[var(--color-surface-2)] border-[var(--color-line)] dark:border-[#272F3A] text-[var(--color-text)] hover:border-[var(--color-accent)]/50'
              }`}
            >
              {t('filters.presets.full')}
            </button>
            <button
              type="button"
              onClick={() => applyPreset('last3Months')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                activePreset === 'last3Months'
                  ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)] shadow-xs'
                  : 'bg-[var(--color-surface-2)] border-[var(--color-line)] dark:border-[#272F3A] text-[var(--color-text)] hover:border-[var(--color-accent)]/50'
              }`}
            >
              {t('filters.presets.last3Months')}
            </button>
            <button
              type="button"
              onClick={() => applyPreset('lastMonth')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                activePreset === 'lastMonth'
                  ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)] shadow-xs'
                  : 'bg-[var(--color-surface-2)] border-[var(--color-line)] dark:border-[#272F3A] text-[var(--color-text)] hover:border-[var(--color-accent)]/50'
              }`}
            >
              {t('filters.presets.lastMonth')}
            </button>
          </div>

          {/* Date Pickers */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[var(--color-muted)] font-medium">{t('filters.from')}:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setActivePreset('')
                  setFromDate(e.target.value)
                }}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[var(--color-muted)] font-medium">{t('filters.to')}:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setActivePreset('')
                  setToDate(e.target.value)
                }}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              />
            </div>
          </div>
        </div>

        {/* Inline Error (e.g. 422 or from > to) */}
        {inlineError && (
          <div className="p-4 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{inlineError}</span>
          </div>
        )}

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
              onClick={() => fetchPnlData(fromDate, toDate)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-700 transition-all cursor-pointer shrink-0"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>{t('error.retry')}</span>
            </button>
          </div>
        )}

        {/* INITIAL LOADING SKELETON */}
        {initialLoading && !isLocked && !error && (
          <div className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-5 space-y-3"
                >
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-36" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
            <div className="rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-6 space-y-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-64 w-full" />
            </div>
          </div>
        )}

        {/* CONTENT */}
        {!initialLoading && !isLocked && !error && data && (
          <>
            {/* EMPTY STATE */}
            {!data.has_data ? (
              <div className="rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-12 text-center shadow-sm space-y-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 dark:bg-[#1C222B] text-[var(--color-muted)]">
                  <BarChart3 className="h-7 w-7" />
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
                {/* 4 SUMMARY TILES */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {/* Tile 1: Revenue */}
                  <div className="rounded-2xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-5 shadow-sm hover:shadow-md transition-shadow">
                    <span className="text-[11px] font-bold text-[var(--color-muted)] uppercase tracking-wider block">
                      {t('tiles.revenue')}
                    </span>
                    <div className="mt-2 font-[family-name:var(--font-display)] text-2xl font-extrabold text-[var(--color-text)]">
                      {formatIndianRupees(totals.revenue)}
                    </div>
                    <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                      <TrendingUp className="h-3.5 w-3.5" />
                      <span>{data.row_count} cash transactions</span>
                    </p>
                  </div>

                  {/* Tile 2: Gross Profit */}
                  <div className="rounded-2xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-5 shadow-sm hover:shadow-md transition-shadow">
                    <span className="text-[11px] font-bold text-[var(--color-muted)] uppercase tracking-wider block">
                      {t('tiles.grossProfit')}
                    </span>
                    <div className="mt-2 font-[family-name:var(--font-display)] text-2xl font-extrabold text-[var(--color-text)]">
                      {formatIndianRupees(totals.gross_profit)}
                    </div>
                    <p className="mt-1 text-xs text-[var(--color-muted)] font-semibold">
                      {totals.gross_margin_pct !== null && totals.gross_margin_pct !== undefined
                        ? t('tiles.grossMargin', { margin: totals.gross_margin_pct })
                        : '–'}
                    </p>
                  </div>

                  {/* Tile 3: Operating Profit */}
                  <div className="rounded-2xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-5 shadow-sm hover:shadow-md transition-shadow">
                    <span className="text-[11px] font-bold text-[var(--color-muted)] uppercase tracking-wider block">
                      {t('tiles.operatingProfit')}
                    </span>
                    <div className="mt-2 font-[family-name:var(--font-display)] text-2xl font-extrabold text-[var(--color-text)]">
                      {formatIndianRupees(totals.operating_profit)}
                    </div>
                    <p className="mt-1 text-xs text-[var(--color-muted)] font-medium">
                      Opex: {formatIndianRupees(totals.operating_costs)}
                    </p>
                  </div>

                  {/* Tile 4: Net Profit (red if negative, green if positive) */}
                  <div className="rounded-2xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-5 shadow-sm hover:shadow-md transition-shadow">
                    <span className="text-[11px] font-bold text-[var(--color-muted)] uppercase tracking-wider block">
                      {t('tiles.netProfit')}
                    </span>
                    <div
                      className={`mt-2 font-[family-name:var(--font-display)] text-2xl font-extrabold ${
                        isNetPositive
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {formatIndianRupees(totals.net_profit)}
                    </div>
                    <p
                      className={`mt-1 text-xs font-bold ${
                        isNetPositive
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {totals.net_margin_pct !== null && totals.net_margin_pct !== undefined
                        ? t('tiles.netMargin', { margin: totals.net_margin_pct })
                        : '–'}
                    </p>
                  </div>
                </div>

                {/* UNCLASSIFIED NOTE (if unclassified_rows > 0) */}
                {data.unclassified_rows > 0 && (
                  <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/20 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                      </div>
                      <p className="text-xs sm:text-sm font-semibold text-amber-950 dark:text-amber-100">
                        {data.unclassified_rows === 1
                          ? t('unclassifiedNote', { count: data.unclassified_rows })
                          : t('unclassifiedNote_plural', { count: data.unclassified_rows })}
                      </p>
                    </div>
                    <button
                      onClick={() => navigate('/results')}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-1.5 text-xs font-bold shadow-xs transition-all cursor-pointer shrink-0"
                    >
                      <span>Review in Documents</span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {/* P&L STATEMENT TABLE CARD */}
                <div className="rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-5 sm:p-7 shadow-sm space-y-4">
                  <div>
                    <h2 className="text-lg font-bold text-[var(--color-text)]">
                      {t('statement.title')}
                    </h2>
                    <p className="text-xs text-[var(--color-muted)] mt-0.5">
                      {data.from && data.to ? `${formatDate(data.from)} — ${formatDate(data.to)}` : 'All time'}
                    </p>
                  </div>

                  {/* Horizontally scrollable table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-[var(--color-line)] dark:border-[#272F3A] text-[var(--color-muted)] font-semibold">
                          <th className="py-2.5 pr-4">{t('statement.line')}</th>
                          <th className="py-2.5 px-3 text-right">{t('statement.share')}</th>
                          <th className="py-2.5 pl-3 text-right">{t('statement.amount')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-line)]/50 dark:divide-[#272F3A]/50">
                        {/* 1. REVENUE SECTION */}
                        <tr className="bg-[var(--color-surface-2)]/60 font-bold text-[var(--color-text)]">
                          <td className="py-2.5 pr-4 text-sm">{t('statement.revenue')}</td>
                          <td className="py-2.5 px-3 text-right">100.0%</td>
                          <td className="py-2.5 pl-3 text-right text-sm">
                            {formatIndianRupees(totals.revenue)}
                          </td>
                        </tr>
                        {data.revenue_lines?.map((line) => (
                          <tr key={line.category} className="text-[var(--color-text)] hover:bg-[var(--color-surface-2)]/30">
                            <td className="py-2 pl-6 pr-4 font-medium text-[var(--color-muted)]">
                              ↳ {getCategoryLabel(line.category)}
                            </td>
                            <td className="py-2 px-3 text-right text-[var(--color-muted)]">
                              {line.share_pct !== null ? `${line.share_pct}%` : '–'}
                            </td>
                            <td className="py-2 pl-3 text-right font-medium">
                              {formatIndianRupees(line.amount)}
                            </td>
                          </tr>
                        ))}

                        {/* 2. LESS PURCHASES */}
                        <tr className="bg-[var(--color-surface-2)]/40 font-semibold text-[var(--color-text)]">
                          <td className="py-2.5 pr-4 text-xs">{t('statement.lessPurchases')}</td>
                          <td className="py-2.5 px-3 text-right text-[var(--color-muted)]">
                            {totals.purchases && totals.revenue ? `${((totals.purchases * 100) / totals.revenue).toFixed(2)}%` : '–'}
                          </td>
                          <td className="py-2.5 pl-3 text-right text-rose-600 dark:text-rose-400 font-bold">
                            -{formatIndianRupees(totals.purchases)}
                          </td>
                        </tr>
                        {data.purchase_lines?.map((line) => (
                          <tr key={line.category} className="text-[var(--color-text)] hover:bg-[var(--color-surface-2)]/30">
                            <td className="py-2 pl-6 pr-4 font-medium text-[var(--color-muted)]">
                              ↳ {getCategoryLabel(line.category)}
                            </td>
                            <td className="py-2 px-3 text-right text-[var(--color-muted)]">
                              {line.share_pct !== null ? `${line.share_pct}%` : '–'}
                            </td>
                            <td className="py-2 pl-3 text-right font-medium">
                              {formatIndianRupees(line.amount)}
                            </td>
                          </tr>
                        ))}

                        {/* 3. GROSS PROFIT */}
                        <tr className="bg-[var(--color-surface-2)]/80 font-extrabold text-[var(--color-text)] border-t border-b border-[var(--color-line)] dark:border-[#272F3A]">
                          <td className="py-3 pr-4 text-sm">= {t('statement.grossProfit')}</td>
                          <td className="py-3 px-3 text-right text-xs">
                            {totals.gross_margin_pct !== null ? `${totals.gross_margin_pct}%` : '–'}
                          </td>
                          <td
                            className={`py-3 pl-3 text-right text-sm ${
                              totals.gross_profit < 0 ? 'text-rose-600 dark:text-rose-400' : ''
                            }`}
                          >
                            {formatIndianRupees(totals.gross_profit)}
                          </td>
                        </tr>

                        {/* 4. LESS OPERATING COSTS */}
                        <tr className="bg-[var(--color-surface-2)]/40 font-semibold text-[var(--color-text)]">
                          <td className="py-2.5 pr-4 text-xs">{t('statement.lessOperatingCosts')}</td>
                          <td className="py-2.5 px-3 text-right text-[var(--color-muted)]">
                            {totals.operating_costs && totals.revenue ? `${((totals.operating_costs * 100) / totals.revenue).toFixed(2)}%` : '–'}
                          </td>
                          <td className="py-2.5 pl-3 text-right text-rose-600 dark:text-rose-400 font-bold">
                            -{formatIndianRupees(totals.operating_costs)}
                          </td>
                        </tr>
                        {data.operating_lines?.map((line) => (
                          <tr key={line.category} className="text-[var(--color-text)] hover:bg-[var(--color-surface-2)]/30">
                            <td className="py-2 pl-6 pr-4 font-medium text-[var(--color-muted)]">
                              ↳ {getCategoryLabel(line.category)}
                            </td>
                            <td className="py-2 px-3 text-right text-[var(--color-muted)]">
                              {line.share_pct !== null ? `${line.share_pct}%` : '–'}
                            </td>
                            <td className="py-2 pl-3 text-right font-medium">
                              {formatIndianRupees(line.amount)}
                            </td>
                          </tr>
                        ))}

                        {/* 5. OPERATING PROFIT */}
                        <tr className="bg-[var(--color-surface-2)]/80 font-extrabold text-[var(--color-text)] border-t border-b border-[var(--color-line)] dark:border-[#272F3A]">
                          <td className="py-3 pr-4 text-sm">= {t('statement.operatingProfit')}</td>
                          <td className="py-3 px-3 text-right text-xs">
                            {totals.operating_profit && totals.revenue ? `${((totals.operating_profit * 100) / totals.revenue).toFixed(2)}%` : '–'}
                          </td>
                          <td
                            className={`py-3 pl-3 text-right text-sm ${
                              totals.operating_profit < 0 ? 'text-rose-600 dark:text-rose-400' : ''
                            }`}
                          >
                            {formatIndianRupees(totals.operating_profit)}
                          </td>
                        </tr>

                        {/* 6. LESS FINANCE COSTS */}
                        <tr className="bg-[var(--color-surface-2)]/40 font-semibold text-[var(--color-text)]">
                          <td className="py-2.5 pr-4 text-xs">{t('statement.lessFinanceCosts')}</td>
                          <td className="py-2.5 px-3 text-right text-[var(--color-muted)]">
                            {totals.finance_costs && totals.revenue ? `${((totals.finance_costs * 100) / totals.revenue).toFixed(2)}%` : '–'}
                          </td>
                          <td className="py-2.5 pl-3 text-right text-rose-600 dark:text-rose-400 font-bold">
                            -{formatIndianRupees(totals.finance_costs)}
                          </td>
                        </tr>
                        {data.finance_lines?.map((line) => (
                          <tr key={line.category} className="text-[var(--color-text)] hover:bg-[var(--color-surface-2)]/30">
                            <td className="py-2 pl-6 pr-4 font-medium text-[var(--color-muted)]">
                              ↳ {getCategoryLabel(line.category)}
                            </td>
                            <td className="py-2 px-3 text-right text-[var(--color-muted)]">
                              {line.share_pct !== null ? `${line.share_pct}%` : '–'}
                            </td>
                            <td className="py-2 pl-3 text-right font-medium">
                              {formatIndianRupees(line.amount)}
                            </td>
                          </tr>
                        ))}

                        {/* 7. NET PROFIT (Bold, Double Top Border) */}
                        <tr className="border-t-4 border-double border-[var(--color-line)] dark:border-[#272F3A] bg-[var(--color-surface-2)] font-black text-[var(--color-text)]">
                          <td className="py-4 pr-4 text-base font-extrabold">= {t('statement.netProfit')}</td>
                          <td className="py-4 px-3 text-right text-sm font-bold">
                            {totals.net_margin_pct !== null ? `${totals.net_margin_pct}%` : '–'}
                          </td>
                          <td
                            className={`py-4 pl-3 text-right font-[family-name:var(--font-display)] text-lg font-black ${
                              isNetPositive
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {formatIndianRupees(totals.net_profit)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Basis Note */}
                  <div className="pt-3 border-t border-[var(--color-line)] dark:border-[#272F3A] flex items-center gap-2 text-[11px] text-[var(--color-muted)]">
                    <HelpCircle className="h-3.5 w-3.5 shrink-0" />
                    <p>{t('basisNote')}</p>
                  </div>
                </div>

                {/* MONTHLY NET PROFIT SVG BAR CHART */}
                {chartData && (
                  <div className="rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-5 sm:p-7 shadow-sm space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-[var(--color-text)]">
                          {t('chart.title')}
                        </h3>
                        <p className="text-xs text-[var(--color-muted)] mt-0.5">
                          {t('chart.subtitle')}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-semibold">
                        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                          <span className="w-3 h-3 rounded-xs bg-emerald-500" />
                          <span>{t('chart.netPositive')}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                          <span className="w-3 h-3 rounded-xs bg-rose-500" />
                          <span>{t('chart.netNegative')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="relative w-full overflow-x-auto">
                      <svg
                        viewBox={`0 0 ${chartData.width} ${chartData.height}`}
                        className="w-full h-auto min-w-[340px] max-w-full overflow-visible"
                      >
                        {/* Zero Line */}
                        <line
                          x1={chartData.padLeft}
                          x2={chartData.padLeft + chartData.plotWidth}
                          y1={chartData.zeroY}
                          y2={chartData.zeroY}
                          stroke="currentColor"
                          strokeDasharray="3 3"
                          className="text-gray-400 dark:text-gray-600"
                          strokeWidth="1.5"
                        />
                        <text
                          x={chartData.padLeft - 8}
                          y={chartData.zeroY + 3}
                          textAnchor="end"
                          className="text-[10px] fill-[var(--color-muted)] font-bold"
                        >
                          ₹0
                        </text>

                        {/* Bars */}
                        {chartData.bars.map((bar, i) => {
                          const isHovered = hoveredMonthIndex === i
                          return (
                            <g
                              key={bar.month}
                              onMouseEnter={() => setHoveredMonthIndex(i)}
                              onMouseLeave={() => setHoveredMonthIndex(null)}
                              className="cursor-pointer transition-opacity"
                            >
                              <rect
                                x={bar.barX}
                                y={bar.barTop}
                                width={bar.barWidth}
                                height={bar.barHeight}
                                rx="3"
                                fill={bar.isPositive ? '#10B981' : '#EF4444'}
                                className={`transition-all ${isHovered ? 'brightness-110' : ''}`}
                              />
                              <text
                                x={bar.cx}
                                y={chartData.padTop + chartData.plotHeight + 20}
                                textAnchor="middle"
                                className="text-[10px] fill-[var(--color-muted)] font-medium"
                              >
                                {formatMonthLabel(bar.month)}
                              </text>
                            </g>
                          )
                        })}
                      </svg>

                      {/* Tooltip Box */}
                      {hoveredMonthIndex !== null && chartData.bars[hoveredMonthIndex] && (
                        <div className="mt-2 p-3 rounded-xl bg-gray-900 text-white text-xs shadow-lg flex flex-wrap items-center justify-between gap-4">
                          <span className="font-bold text-gray-200">
                            {chartData.bars[hoveredMonthIndex].month}
                          </span>
                          <div className="flex items-center gap-4">
                            <span>
                              Revenue:{' '}
                              <strong className="text-gray-200">
                                {formatIndianRupees(chartData.bars[hoveredMonthIndex].revenue)}
                              </strong>
                            </span>
                            <span>
                              Net Profit:{' '}
                              <strong
                                className={
                                  chartData.bars[hoveredMonthIndex].isPositive
                                    ? 'text-emerald-400'
                                    : 'text-rose-400'
                                }
                              >
                                {formatIndianRupees(chartData.bars[hoveredMonthIndex].net)}
                              </strong>
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* "NOT PART OF PROFIT" MEMO CARD */}
                <div className="rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-5 sm:p-7 shadow-sm space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-[var(--color-text)]">
                      {t('memo.title')}
                    </h3>
                    <p className="text-xs text-[var(--color-muted)] mt-0.5">
                      {t('memo.subtitle')}
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {/* Memo 1: GST Paid */}
                    <div className="rounded-2xl border border-[var(--color-line)] dark:border-[#272F3A] bg-[var(--color-surface-2)]/50 p-4 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[var(--color-text)]">
                          {t('memo.items.gst_paid.title')}
                        </span>
                        <span className="font-extrabold text-sm text-[var(--color-text)]">
                          {formatIndianRupees(data.memo?.gst_paid)}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--color-muted)] leading-relaxed">
                        {t('memo.items.gst_paid.desc')}
                      </p>
                    </div>

                    {/* Memo 2: Owner Drawings */}
                    <div className="rounded-2xl border border-[var(--color-line)] dark:border-[#272F3A] bg-[var(--color-surface-2)]/50 p-4 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[var(--color-text)]">
                          {t('memo.items.owner_drawings.title')}
                        </span>
                        <span className="font-extrabold text-sm text-[var(--color-text)]">
                          {formatIndianRupees(data.memo?.owner_drawings)}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--color-muted)] leading-relaxed">
                        {t('memo.items.owner_drawings.desc')}
                      </p>
                    </div>

                    {/* Memo 3: Owner Capital */}
                    <div className="rounded-2xl border border-[var(--color-line)] dark:border-[#272F3A] bg-[var(--color-surface-2)]/50 p-4 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[var(--color-text)]">
                          {t('memo.items.owner_capital.title')}
                        </span>
                        <span className="font-extrabold text-sm text-[var(--color-text)]">
                          {formatIndianRupees(data.memo?.owner_capital)}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--color-muted)] leading-relaxed">
                        {t('memo.items.owner_capital.desc')}
                      </p>
                    </div>

                    {/* Memo 4: Other Receipts */}
                    <div className="rounded-2xl border border-[var(--color-line)] dark:border-[#272F3A] bg-[var(--color-surface-2)]/50 p-4 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[var(--color-text)]">
                          {t('memo.items.other_receipts.title')}
                        </span>
                        <span className="font-extrabold text-sm text-[var(--color-text)]">
                          {formatIndianRupees(data.memo?.other_receipts)}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--color-muted)] leading-relaxed">
                        {t('memo.items.other_receipts.desc')}
                      </p>
                    </div>
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
