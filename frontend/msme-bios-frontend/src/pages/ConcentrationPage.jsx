import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Plus,
  Lock,
  Calendar,
  ArrowUpRight,
  TrendingUp,
  Percent,
  Receipt,
  Info,
} from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout'
import { Skeleton } from '../components/ui'
import { getRevenueConcentration } from '../lib/api'
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

export default function ConcentrationPage() {
  const { t } = useTranslation('concentration')
  const navigate = useNavigate()
  const { isOwner } = useBusiness()

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [isLocked, setIsLocked] = useState(false)

  // Period selector: 'all' | '90' | '180'
  const [selectedPeriod, setSelectedPeriod] = useState('all')
  const [hoveredCustomerIndex, setHoveredCustomerIndex] = useState(null)

  // Fetch helper
  const fetchData = async (period, refDateStr = null) => {
    setLoading(true)
    setError(null)

    let fromStr = null
    let toStr = null

    if (period !== 'all') {
      const base = refDateStr ? new Date(refDateStr) : new Date()
      const days = period === '90' ? 90 : 180
      const fromD = new Date(base)
      fromD.setDate(fromD.getDate() - days)
      toStr = base.toISOString().slice(0, 10)
      fromStr = fromD.toISOString().slice(0, 10)
    }

    try {
      const res = await getRevenueConcentration(fromStr, toStr)
      setData(res)
      setIsLocked(false)
    } catch (err) {
      if (err.status === 403 || err.status === 402 || err.code === 'feature_not_available' || err.code === 'payment_required') {
        setIsLocked(true)
      } else {
        setError(err.message || t('error.title'))
      }
    } finally {
      setLoading(false)
    }
  }

  // Load initial data
  useEffect(() => {
    fetchData('all')
  }, [])

  const handlePeriodChange = (period) => {
    setSelectedPeriod(period)
    const ref = data?.data_to || data?.to || null
    fetchData(period, ref)
  }

  // Risk styling and metadata
  const riskMeta = useMemo(() => {
    const r = data?.risk || 'low'
    if (r === 'high') {
      return {
        badgeBg: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60',
        icon: <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />,
        label: t('risk.badge.high'),
        desc: t('risk.highDesc', { top1: data?.top1_pct ?? 0, top3: data?.top3_pct ?? 0 }),
      }
    }
    if (r === 'medium') {
      return {
        badgeBg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60',
        icon: <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />,
        label: t('risk.badge.medium'),
        desc: t('risk.mediumDesc', { top1: data?.top1_pct ?? 0, top3: data?.top3_pct ?? 0 }),
      }
    }
    return {
      badgeBg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60',
      icon: <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />,
      label: t('risk.badge.low'),
      desc: t('risk.lowDesc'),
    }
  }, [data, t])

  // Pareto Chart calculations
  const topCustomers = data?.top_customers || []
  const maxSales = useMemo(() => {
    if (!topCustomers.length) return 1
    return Math.max(...topCustomers.map((c) => c.sales), 1)
  }, [topCustomers])

  const chartWidth = 760
  const chartHeight = 240
  const padLeft = 60
  const padRight = 50
  const padTop = 30
  const padBottom = 45
  const plotWidth = chartWidth - padLeft - padRight
  const plotHeight = chartHeight - padTop - padBottom

  const slotWidth = topCustomers.length > 0 ? plotWidth / topCustomers.length : plotWidth
  const barWidth = Math.min(Math.max(slotWidth * 0.52, 14), 44)

  const linePoints = useMemo(() => {
    return topCustomers.map((c, i) => {
      const cx = padLeft + (i + 0.5) * slotWidth
      const cy = padTop + plotHeight - (c.cumulative_pct / 100) * plotHeight
      return { cx, cy, customer: c }
    })
  }, [topCustomers, padLeft, padTop, plotHeight, slotWidth])

  const linePathD = useMemo(() => {
    if (!linePoints.length) return ''
    return linePoints.reduce((acc, pt, i) => {
      return `${acc} ${i === 0 ? 'M' : 'L'} ${pt.cx.toFixed(1)} ${pt.cy.toFixed(1)}`
    }, '')
  }, [linePoints])

  return (
    <DashboardLayout activeItem="Customers">
      <div className="space-y-8 max-w-7xl mx-auto min-w-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block rounded-md bg-[var(--color-surface-2)] dark:bg-[#1C222B] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#2F6FDE] border border-[var(--color-line)] dark:border-[#272F3A]">
                Sales
              </span>
              {data?.data_from && data?.data_to && (
                <span className="text-xs text-[var(--color-muted)] font-medium">
                  {t('dataRange', { from: formatDate(data.data_from), to: formatDate(data.data_to) })}
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

          {/* Actions & Period Filter */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-xl bg-gray-100 dark:bg-[#1C222B] p-1 border border-[var(--color-line)] dark:border-[#272F3A]">
              <button
                type="button"
                onClick={() => handlePeriodChange('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  selectedPeriod === 'all'
                    ? 'bg-white dark:bg-[#151A21] text-[var(--color-text)] shadow-sm'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                {t('periods.all')}
              </button>
              <button
                type="button"
                onClick={() => handlePeriodChange('90')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  selectedPeriod === '90'
                    ? 'bg-white dark:bg-[#151A21] text-[var(--color-text)] shadow-sm'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                {t('periods.d90')}
              </button>
              <button
                type="button"
                onClick={() => handlePeriodChange('180')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  selectedPeriod === '180'
                    ? 'bg-white dark:bg-[#151A21] text-[var(--color-text)] shadow-sm'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                {t('periods.d180')}
              </button>
            </div>

            <button
              onClick={() => navigate('/upload')}
              className="flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2 text-xs font-bold text-white shadow-md shadow-[var(--color-accent)]/20 hover:brightness-110 transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              <span>{t('empty.uploadBtn')}</span>
            </button>
          </div>
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
              onClick={() => fetchData(selectedPeriod)}
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
                  <Skeleton className="h-8 w-36" />
                  <Skeleton className="h-3 w-full" />
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
        {!loading && !isLocked && !error && data && (
          <>
            {/* EMPTY STATE */}
            {(!data.has_data || data.total_sales === 0) ? (
              <div className="rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-12 text-center shadow-sm space-y-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 dark:bg-[#1C222B] text-[var(--color-muted)]">
                  <Receipt className="h-7 w-7" />
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
                {/* Risk Banner */}
                <div className="rounded-2xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-5 shadow-sm space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold ${riskMeta.badgeBg}`}>
                        {riskMeta.icon}
                        <span>{riskMeta.label}</span>
                      </span>
                      <p className="text-sm font-medium text-[var(--color-text)]">
                        {riskMeta.desc}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-[var(--color-muted)] pt-1 border-t border-[var(--color-line)] dark:border-[#272F3A]">
                    {t('risk.rule')}
                  </p>
                </div>

                {/* 4 Summary Cards */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {/* Card 1: Total Sales */}
                  <div className="rounded-2xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
                        {t('cards.totalSales')}
                      </span>
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/40 text-[#2F6FDE]">
                        <TrendingUp className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="mt-3 font-[family-name:var(--font-display)] text-2xl font-extrabold text-[var(--color-text)]">
                      {formatIndianRupees(data.total_sales)}
                    </div>
                    <p className="mt-1 text-xs text-[var(--color-muted)]">
                      {t('cards.invoicesProcessed', { count: data.invoice_count })}
                    </p>
                  </div>

                  {/* Card 2: Customer Count */}
                  <div className="rounded-2xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
                        {t('cards.customerCount')}
                      </span>
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600">
                        <Users className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="mt-3 font-[family-name:var(--font-display)] text-2xl font-extrabold text-[var(--color-text)]">
                      {data.customer_count}
                    </div>
                    <p className="mt-1 text-xs text-[var(--color-muted)]">
                      {data.customer_count === 1 ? '1 active buyer' : `${data.customer_count} active buyers`}
                    </p>
                  </div>

                  {/* Card 3: Top 1 Share */}
                  <div className="rounded-2xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
                        {t('cards.top1Share')}
                      </span>
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600">
                        <Percent className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="mt-3 font-[family-name:var(--font-display)] text-2xl font-extrabold text-[var(--color-text)]">
                      {data.top1_pct}%
                    </div>
                    <p className="mt-1 text-xs text-[var(--color-muted)]">
                      {t('cards.shareOfTotal', { pct: data.top1_pct })}
                    </p>
                  </div>

                  {/* Card 4: Top 5 Share */}
                  <div className="rounded-2xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
                        {t('cards.top5Share')}
                      </span>
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600">
                        <Percent className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="mt-3 font-[family-name:var(--font-display)] text-2xl font-extrabold text-[var(--color-text)]">
                      {data.top5_pct}%
                    </div>
                    <p className="mt-1 text-xs text-[var(--color-muted)]">
                      {t('cards.shareOfTotal', { pct: data.top5_pct })}
                    </p>
                  </div>
                </div>

                {/* Notes Line */}
                <div className="rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-blue-900 dark:text-blue-300">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>
                      {t('notes.paretoSummary', {
                        need50: data.customers_for_50pct,
                        need80: data.customers_for_80pct,
                        customerWord50: data.customers_for_50pct === 1 ? t('notes.customerSingle') : t('notes.customerPlural'),
                      })}
                    </span>
                  </div>
                  {data.unattributed_pct > 0 && (
                    <span className="text-[var(--color-muted)] sm:text-right">
                      {t('notes.unattributed', { pct: data.unattributed_pct })}
                    </span>
                  )}
                </div>

                {/* Pareto SVG Chart Card */}
                {topCustomers.length > 0 && (
                  <div className="rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-6 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h2 className="text-base font-bold text-[var(--color-text)]">
                          {t('chart.title')}
                        </h2>
                        <p className="text-xs text-[var(--color-muted)] mt-0.5">
                          {t('chart.subtitle')}
                        </p>
                      </div>

                      {/* Legend */}
                      <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-block h-3 w-3 rounded-sm bg-[#2F6FDE]" />
                          <span className="text-[var(--color-muted)]">{t('chart.salesLegend')}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="inline-block h-2 w-4 rounded-full bg-amber-500" />
                          <span className="text-[var(--color-muted)]">{t('chart.cumulativeLegend')}</span>
                        </div>
                      </div>
                    </div>

                    {/* SVG Graphic */}
                    <div className="w-full overflow-x-auto">
                      <div className="min-w-[640px] relative">
                        <svg
                          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                          className="w-full h-auto overflow-visible"
                        >
                          {/* Horizontal Grid lines */}
                          {[0, 25, 50, 75, 100].map((pct) => {
                            const y = padTop + plotHeight - (pct / 100) * plotHeight
                            return (
                              <g key={pct}>
                                <line
                                  x1={padLeft}
                                  y1={y}
                                  x2={chartWidth - padRight}
                                  y2={y}
                                  stroke="currentColor"
                                  className="text-gray-100 dark:text-[#222A35]"
                                  strokeDasharray={pct === 50 || pct === 80 ? '4 4' : undefined}
                                />
                                {/* Right axis label: % */}
                                <text
                                  x={chartWidth - padRight + 8}
                                  y={y + 3}
                                  fontSize="10"
                                  fill="currentColor"
                                  className="text-gray-400 dark:text-gray-500 font-mono"
                                >
                                  {pct}%
                                </text>
                              </g>
                            )
                          })}

                          {/* Left axis labels: rupees */}
                          {[0, 0.5, 1].map((ratio) => {
                            const val = maxSales * ratio
                            const y = padTop + plotHeight - ratio * plotHeight
                            return (
                              <text
                                key={ratio}
                                x={padLeft - 8}
                                y={y + 3}
                                textAnchor="end"
                                fontSize="10"
                                fill="currentColor"
                                className="text-gray-400 dark:text-gray-500 font-mono"
                              >
                                {ratio === 0 ? '₹0' : formatIndianRupees(val).split('.')[0]}
                              </text>
                            )
                          })}

                          {/* Bars */}
                          {topCustomers.map((c, i) => {
                            const bHeight = (c.sales / maxSales) * plotHeight
                            const bx = padLeft + (i + 0.5) * slotWidth - barWidth / 2
                            const by = padTop + plotHeight - bHeight
                            const isHovered = hoveredCustomerIndex === i

                            return (
                              <g
                                key={c.rank}
                                onMouseEnter={() => setHoveredCustomerIndex(i)}
                                onMouseLeave={() => setHoveredCustomerIndex(null)}
                                className="cursor-pointer transition-opacity"
                              >
                                <rect
                                  x={bx}
                                  y={by}
                                  width={barWidth}
                                  height={Math.max(bHeight, 2)}
                                  rx={4}
                                  fill="#2F6FDE"
                                  className={`transition-all duration-200 ${
                                    isHovered ? 'brightness-125' : 'opacity-85 hover:opacity-100'
                                  }`}
                                />
                                {/* Bottom label (Customer Name truncated) */}
                                <text
                                  x={bx + barWidth / 2}
                                  y={padTop + plotHeight + 18}
                                  textAnchor="middle"
                                  fontSize="11"
                                  fill="currentColor"
                                  className="text-gray-500 dark:text-gray-400 font-medium select-none"
                                >
                                  {c.customer.length > 9 ? `${c.customer.slice(0, 8)}…` : c.customer}
                                </text>
                              </g>
                            )
                          })}

                          {/* Cumulative Line */}
                          {linePathD && (
                            <path
                              d={linePathD}
                              fill="none"
                              stroke="#F59E0B"
                              strokeWidth={2.5}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          )}

                          {/* Cumulative Dots */}
                          {linePoints.map((pt, i) => {
                            const isHovered = hoveredCustomerIndex === i
                            return (
                              <circle
                                key={i}
                                cx={pt.cx}
                                cy={pt.cy}
                                r={isHovered ? 6 : 4}
                                fill="#F59E0B"
                                stroke="#FFFFFF"
                                strokeWidth={2}
                                className="transition-all cursor-pointer"
                                onMouseEnter={() => setHoveredCustomerIndex(i)}
                                onMouseLeave={() => setHoveredCustomerIndex(null)}
                              />
                            )
                          })}
                        </svg>

                        {/* Interactive Tooltip Card */}
                        {hoveredCustomerIndex !== null && topCustomers[hoveredCustomerIndex] && (
                          <div
                            className="absolute z-10 pointer-events-none rounded-xl bg-gray-900 text-white dark:bg-black p-3 text-xs shadow-xl transition-all border border-gray-700"
                            style={{
                              left: `${((padLeft + (hoveredCustomerIndex + 0.5) * slotWidth) / chartWidth) * 100}%`,
                              top: '15px',
                              transform: 'translateX(-50%)',
                            }}
                          >
                            <p className="font-bold text-sm text-white">
                              {topCustomers[hoveredCustomerIndex].customer}
                            </p>
                            <div className="mt-1.5 space-y-0.5 text-gray-300">
                              <p>
                                Sales: <span className="text-white font-semibold">{formatIndianRupees(topCustomers[hoveredCustomerIndex].sales)}</span>
                              </p>
                              <p>
                                Share: <span className="text-blue-400 font-semibold">{topCustomers[hoveredCustomerIndex].share_pct}%</span>
                              </p>
                              <p>
                                Cumulative: <span className="text-amber-400 font-semibold">{topCustomers[hoveredCustomerIndex].cumulative_pct}%</span>
                              </p>
                              <p>
                                Invoices: <span className="text-white font-semibold">{topCustomers[hoveredCustomerIndex].invoice_count}</span>
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Top-10 Customers Table */}
                <div className="rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-6 shadow-sm space-y-4">
                  <div>
                    <h2 className="text-base font-bold text-[var(--color-text)]">
                      {t('table.title')}
                    </h2>
                    <p className="text-xs text-[var(--color-muted)] mt-0.5">
                      {t('table.subtitle')}
                    </p>
                  </div>

                  {/* Horizontal Scroll on Mobile (375px safe) */}
                  <div className="overflow-x-auto -mx-6 px-6">
                    <table className="w-full min-w-[650px] text-left text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-[var(--color-line)] dark:border-[#272F3A] text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
                          <th className="py-3 px-3">{t('table.rank')}</th>
                          <th className="py-3 px-3">{t('table.customer')}</th>
                          <th className="py-3 px-3 text-right">{t('table.sales')}</th>
                          <th className="py-3 px-3 text-right">{t('table.share')}</th>
                          <th className="py-3 px-3">{t('table.cumulative')}</th>
                          <th className="py-3 px-3 text-center">{t('table.invoices')}</th>
                          <th className="py-3 px-3 text-right">{t('table.lastPurchase')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-line)] dark:divide-[#272F3A]">
                        {topCustomers.map((cust) => (
                          <tr
                            key={cust.rank}
                            className="hover:bg-gray-50/60 dark:hover:bg-[#1B222C] transition-colors"
                          >
                            {/* Rank */}
                            <td className="py-3.5 px-3 font-semibold text-xs text-[var(--color-muted)]">
                              #{cust.rank}
                            </td>

                            {/* Customer */}
                            <td className="py-3.5 px-3">
                              <div className="flex items-center gap-2.5">
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/40 text-xs font-bold text-[#2F6FDE]">
                                  {cust.customer.slice(0, 1).toUpperCase()}
                                </div>
                                <span className="font-semibold text-[var(--color-text)]" title={cust.customer}>
                                  {cust.customer}
                                </span>
                              </div>
                            </td>

                            {/* Sales */}
                            <td className="py-3.5 px-3 text-right font-semibold text-[var(--color-text)]">
                              {formatIndianRupees(cust.sales)}
                            </td>

                            {/* Share */}
                            <td className="py-3.5 px-3 text-right font-medium text-[var(--color-text)]">
                              {cust.share_pct}%
                            </td>

                            {/* Cumulative progress */}
                            <td className="py-3.5 px-3">
                              <div className="flex items-center gap-2 max-w-[130px]">
                                <div className="h-1.5 flex-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-amber-500"
                                    style={{ width: `${Math.min(cust.cumulative_pct, 100)}%` }}
                                  />
                                </div>
                                <span className="text-xs font-mono text-[var(--color-muted)] shrink-0">
                                  {cust.cumulative_pct}%
                                </span>
                              </div>
                            </td>

                            {/* Invoice count */}
                            <td className="py-3.5 px-3 text-center text-xs text-[var(--color-muted)] font-medium">
                              {cust.invoice_count}
                            </td>

                            {/* Last purchase */}
                            <td className="py-3.5 px-3 text-right text-xs text-[var(--color-muted)]">
                              {formatDate(cust.last_purchase)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
