import { useEffect, useState, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DollarSign,
  TrendingUp,
  Sliders,
  RotateCcw,
  Plus,
  Trash2,
  Lock,
  ArrowUpRight,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  HelpCircle,
  Calendar,
  Sparkles,
} from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout'
import { Skeleton } from '../components/ui'
import { simulateCash } from '../lib/api'
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

export default function SimulatorPage() {
  const { t } = useTranslation('simulator')
  const navigate = useNavigate()
  const { isOwner } = useBusiness()

  // Controls state
  const [months, setMonths] = useState(6)
  const [salesChangePct, setSalesChangePct] = useState(0)
  const [expenseChangePct, setExpenseChangePct] = useState(0)
  const [collectOverduePct, setCollectOverduePct] = useState(0)
  const [collectOverMonths, setCollectOverMonths] = useState(3)
  const [oneTimeItems, setOneTimeItems] = useState([])

  // One-off form inputs
  const [newItemMonth, setNewItemMonth] = useState(1)
  const [newItemAmount, setNewItemAmount] = useState('')
  const [newItemType, setNewItemType] = useState('out') // 'out' | 'in'
  const [newItemLabel, setNewItemLabel] = useState('')

  // Query & View states
  const [initialLoading, setInitialLoading] = useState(true)
  const [recalculating, setRecalculating] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [inlineError, setInlineError] = useState(null)
  const [isLocked, setIsLocked] = useState(false)

  // Hovered chart index
  const [hoveredIndex, setHoveredIndex] = useState(null)

  // Stale request tracking
  const reqIdRef = useRef(0)
  const isInitialMount = useRef(true)

  const executeSimulation = async (params) => {
    const currentReqId = ++reqIdRef.current
    setRecalculating(true)
    setError(null)
    setInlineError(null)

    try {
      const res = await simulateCash(params)
      if (reqIdRef.current === currentReqId) {
        setData(res)
        setIsLocked(false)
      }
    } catch (err) {
      if (reqIdRef.current === currentReqId) {
        if (
          err.status === 403 ||
          err.status === 402 ||
          err.code === 'feature_not_available' ||
          err.code === 'payment_required'
        ) {
          setIsLocked(true)
        } else if (err.status === 422) {
          setInlineError(err.message || t('error.invalidInput', 'Invalid simulation input'))
        } else {
          setError(err.message || t('error.title'))
        }
      }
    } finally {
      if (reqIdRef.current === currentReqId) {
        setInitialLoading(false)
        setRecalculating(false)
      }
    }
  }

  // Debounced effect whenever inputs change
  useEffect(() => {
    const cleanOneTime = oneTimeItems.map((item) => ({
      month: Math.min(item.month, months),
      amount: item.amount,
      label: item.label,
    }))

    const payload = {
      months,
      sales_change_pct: salesChangePct,
      expense_change_pct: expenseChangePct,
      collect_overdue_pct: collectOverduePct,
      collect_over_months: collectOverMonths,
      one_time: cleanOneTime,
    }

    if (isInitialMount.current) {
      isInitialMount.current = false
      executeSimulation(payload)
      return
    }

    const timer = setTimeout(() => {
      executeSimulation(payload)
    }, 400)

    return () => clearTimeout(timer)
  }, [months, salesChangePct, expenseChangePct, collectOverduePct, collectOverMonths, oneTimeItems])

  // One-time item addition
  const handleAddOneTime = (e) => {
    e.preventDefault()
    if (!newItemAmount || isNaN(Number(newItemAmount)) || Number(newItemAmount) <= 0) return
    if (oneTimeItems.length >= 10) return

    const num = Math.abs(Number(newItemAmount))
    const signedAmount = newItemType === 'out' ? -num : num

    setOneTimeItems((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        month: Math.min(Math.max(1, Number(newItemMonth)), months),
        amount: signedAmount,
        label: newItemLabel.trim() || (newItemType === 'out' ? 'Expense' : 'Income'),
      },
    ])

    setNewItemAmount('')
    setNewItemLabel('')
  }

  const handleRemoveOneTime = (id) => {
    setOneTimeItems((prev) => prev.filter((it) => it.id !== id))
  }

  // Quick scenarios
  const applySlowMonth = () => {
    setSalesChangePct(-20)
    setExpenseChangePct(0)
    setCollectOverduePct(0)
  }

  const applyCollectHalf = () => {
    setCollectOverduePct(50)
    setCollectOverMonths(Math.min(3, months))
  }

  const applyBigPurchase = () => {
    if (oneTimeItems.length < 10) {
      setOneTimeItems((prev) => [
        ...prev,
        {
          id: Date.now(),
          month: Math.min(2, months),
          amount: -50000,
          label: 'Big purchase',
        },
      ])
    }
  }

  const handleReset = () => {
    setMonths(6)
    setSalesChangePct(0)
    setExpenseChangePct(0)
    setCollectOverduePct(0)
    setCollectOverMonths(3)
    setOneTimeItems([])
    setInlineError(null)
  }

  // SVG Chart Calculations
  const chartData = useMemo(() => {
    if (!data || !data.baseline || !data.scenario) return null
    const baselineRows = data.baseline
    const scenarioRows = data.scenario

    const allClosings = [...baselineRows.map((r) => r.closing), ...scenarioRows.map((r) => r.closing), 0]
    const rawMin = Math.min(...allClosings)
    const rawMax = Math.max(...allClosings)

    const span = rawMax - rawMin || 1
    const padding = span * 0.1
    const minVal = rawMin - padding
    const maxVal = rawMax + padding
    const range = maxVal - minVal

    const width = 620
    const height = 240
    const padLeft = 60
    const padRight = 30
    const padTop = 25
    const padBottom = 35
    const plotWidth = width - padLeft - padRight
    const plotHeight = height - padTop - padBottom

    const n = scenarioRows.length
    const getX = (i) => padLeft + (n > 1 ? (i / (n - 1)) * plotWidth : plotWidth / 2)
    const getY = (val) => padTop + plotHeight - ((val - minVal) / range) * plotHeight

    const zeroY = getY(0)

    const baselinePoints = baselineRows.map((r, i) => ({
      x: getX(i),
      y: getY(r.closing),
      row: r,
    }))

    const scenarioPoints = scenarioRows.map((r, i) => ({
      x: getX(i),
      y: getY(r.closing),
      row: r,
    }))

    const makePath = (pts) =>
      pts.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`, '')

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
      minVal,
      maxVal,
      baselinePoints,
      scenarioPoints,
      baselinePath: makePath(baselinePoints),
      scenarioPath: makePath(scenarioPoints),
    }
  }, [data])

  return (
    <DashboardLayout activeItem="Cash Simulator">
      {/* Root wrapper with w-full max-w-7xl mx-auto min-w-0 */}
      <div className="w-full max-w-7xl mx-auto min-w-0 space-y-8">
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
            {recalculating && !initialLoading && (
              <span className="flex items-center gap-1.5 text-xs text-[var(--color-muted)] font-medium animate-pulse">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Recalculating...</span>
              </span>
            )}
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] px-3.5 py-2 text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-all cursor-pointer shadow-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{t('controls.reset')}</span>
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
              onClick={() => executeSimulation({ months, sales_change_pct: salesChangePct, expense_change_pct: expenseChangePct, collect_overdue_pct: collectOverduePct, collect_over_months: collectOverMonths, one_time: oneTimeItems })}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-700 transition-all cursor-pointer shrink-0"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>{t('error.retry')}</span>
            </button>
          </div>
        )}

        {/* INITIAL LOADING SKELETON */}
        {initialLoading && !isLocked && !error && (
          <div className="grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-5 rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-6 space-y-6">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
            <div className="lg:col-span-7 rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-6 space-y-6">
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-60 w-full" />
              <div className="grid grid-cols-3 gap-3">
                <Skeleton className="h-20 w-full rounded-2xl" />
                <Skeleton className="h-20 w-full rounded-2xl" />
                <Skeleton className="h-20 w-full rounded-2xl" />
              </div>
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
                  <DollarSign className="h-7 w-7" />
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
              /* TWO-PART LAYOUT: LEFT CONTROLS, RIGHT RESULTS */
              <div className="grid gap-8 lg:grid-cols-12 items-start">
                {/* LEFT: "What if..." controls (5 cols on lg) */}
                <div className="lg:col-span-5 rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-5 sm:p-6 shadow-sm space-y-6">
                  <div>
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-bold text-[var(--color-text)] flex items-center gap-2">
                        <Sliders className="h-4 w-4 text-[var(--color-accent)]" />
                        <span>{t('controls.title')}</span>
                      </h2>
                      <button
                        type="button"
                        onClick={handleReset}
                        className="text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
                      >
                        {t('controls.reset')}
                      </button>
                    </div>
                    <p className="text-xs text-[var(--color-muted)] mt-0.5">
                      {t('controls.subtitle')}
                    </p>
                  </div>

                  {/* Quick Scenario Chips */}
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                      {t('controls.quickScenarios')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={applySlowMonth}
                        className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-[var(--color-line)] dark:border-[#272F3A] bg-[var(--color-surface-2)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-all cursor-pointer"
                      >
                        {t('controls.scenarioSlowMonth')}
                      </button>
                      <button
                        type="button"
                        onClick={applyCollectHalf}
                        className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-[var(--color-line)] dark:border-[#272F3A] bg-[var(--color-surface-2)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-all cursor-pointer"
                      >
                        {t('controls.scenarioCollectHalf')}
                      </button>
                      <button
                        type="button"
                        onClick={applyBigPurchase}
                        className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-[var(--color-line)] dark:border-[#272F3A] bg-[var(--color-surface-2)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-all cursor-pointer"
                      >
                        {t('controls.scenarioBigPurchase')}
                      </button>
                    </div>
                  </div>

                  {/* Horizon Select: 3, 6, 9, 12 */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[var(--color-text)] block">
                      {t('controls.monthsHorizon')}
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[3, 6, 9, 12].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setMonths(m)}
                          className={`py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                            months === m
                              ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)] shadow-xs'
                              : 'bg-[var(--color-surface-2)] border-[var(--color-line)] dark:border-[#272F3A] text-[var(--color-text)] hover:border-[var(--color-accent)]/50'
                          }`}
                        >
                          {m} mo
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sales Change Slider (-50 to +50 %) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[var(--color-text)]">{t('controls.salesChange')}</span>
                      <span className={`font-extrabold ${salesChangePct > 0 ? 'text-emerald-600' : salesChangePct < 0 ? 'text-rose-600' : 'text-[var(--color-muted)]'}`}>
                        {salesChangePct > 0 ? `+${salesChangePct}%` : `${salesChangePct}%`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-50"
                      max="50"
                      step="5"
                      value={salesChangePct}
                      onChange={(e) => setSalesChangePct(Number(e.target.value))}
                      className="w-full accent-[var(--color-accent)] cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-[var(--color-muted)]">
                      <span>-50%</span>
                      <span>0%</span>
                      <span>+50%</span>
                    </div>
                  </div>

                  {/* Expenses Change Slider (-50 to +50 %) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[var(--color-text)]">{t('controls.expensesChange')}</span>
                      <span className={`font-extrabold ${expenseChangePct > 0 ? 'text-rose-600' : expenseChangePct < 0 ? 'text-emerald-600' : 'text-[var(--color-muted)]'}`}>
                        {expenseChangePct > 0 ? `+${expenseChangePct}%` : `${expenseChangePct}%`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-50"
                      max="50"
                      step="5"
                      value={expenseChangePct}
                      onChange={(e) => setExpenseChangePct(Number(e.target.value))}
                      className="w-full accent-[var(--color-accent)] cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-[var(--color-muted)]">
                      <span>-50%</span>
                      <span>0%</span>
                      <span>+50%</span>
                    </div>
                  </div>

                  {/* Collect Overdue Dues Slider (0 to 100 %) */}
                  <div className="space-y-2 pt-2 border-t border-[var(--color-line)] dark:border-[#272F3A]">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[var(--color-text)]">{t('controls.collectOverdue')}</span>
                      <span className="font-extrabold text-[#2F6FDE]">{collectOverduePct}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="10"
                      value={collectOverduePct}
                      onChange={(e) => setCollectOverduePct(Number(e.target.value))}
                      className="w-full accent-[var(--color-accent)] cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-[var(--color-muted)]">
                      <span>0%</span>
                      <span>50%</span>
                      <span>100%</span>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                      <span className="text-[var(--color-muted)] font-medium">{t('controls.collectOverMonths')}:</span>
                      <select
                        value={collectOverMonths}
                        onChange={(e) => setCollectOverMonths(Number(e.target.value))}
                        className="px-2 py-1 text-xs rounded-lg border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] text-[var(--color-text)]"
                      >
                        {[1, 2, 3, 4, 5, 6].map((num) => (
                          <option key={num} value={num}>
                            {num} {num === 1 ? 'month' : 'months'}
                          </option>
                        ))}
                      </select>
                    </div>

                    {data.inputs && (
                      <p className="text-[11px] text-[var(--color-muted)] bg-[var(--color-surface-2)] dark:bg-[#1C222B] p-2 rounded-lg">
                        {t('controls.overdueAvailable', { amount: formatIndianRupees(data.inputs.overdue_available) })}
                      </p>
                    )}
                  </div>

                  {/* One-time Items Section */}
                  <div className="space-y-3 pt-2 border-t border-[var(--color-line)] dark:border-[#272F3A]">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[var(--color-text)]">
                          {t('controls.oneTimeTitle')}
                        </span>
                        <span className="text-[11px] text-[var(--color-muted)]">
                          {oneTimeItems.length}/10
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--color-muted)]">
                        {t('controls.oneTimeSubtitle')}
                      </p>
                    </div>

                    {/* Add Item Form */}
                    {oneTimeItems.length < 10 && (
                      <form onSubmit={handleAddOneTime} className="space-y-2 bg-[var(--color-surface-2)] dark:bg-[#1C222B] p-3 rounded-xl border border-[var(--color-line)] dark:border-[#272F3A]">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-[var(--color-muted)] block mb-1">
                              {t('controls.month')}
                            </label>
                            <select
                              value={newItemMonth}
                              onChange={(e) => setNewItemMonth(Number(e.target.value))}
                              className="w-full px-2 py-1.5 text-xs rounded-lg border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] text-[var(--color-text)]"
                            >
                              {Array.from({ length: months }, (_, i) => i + 1).map((m) => (
                                <option key={m} value={m}>
                                  Month {m}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-[var(--color-muted)] block mb-1">
                              Flow Type
                            </label>
                            <div className="grid grid-cols-2 gap-1 bg-white dark:bg-[#151A21] p-0.5 rounded-lg border border-[var(--color-line)] dark:border-[#272F3A]">
                              <button
                                type="button"
                                onClick={() => setNewItemType('out')}
                                className={`text-[10px] font-bold py-1 rounded transition-colors ${newItemType === 'out' ? 'bg-rose-500 text-white' : 'text-[var(--color-muted)]'}`}
                              >
                                Out
                              </button>
                              <button
                                type="button"
                                onClick={() => setNewItemType('in')}
                                className={`text-[10px] font-bold py-1 rounded transition-colors ${newItemType === 'in' ? 'bg-emerald-500 text-white' : 'text-[var(--color-muted)]'}`}
                              >
                                In
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-[var(--color-muted)] block mb-1">
                              {t('controls.amount')}
                            </label>
                            <input
                              type="number"
                              placeholder="50000"
                              value={newItemAmount}
                              onChange={(e) => setNewItemAmount(e.target.value)}
                              className="w-full px-2 py-1 text-xs rounded-lg border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] text-[var(--color-text)]"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-[var(--color-muted)] block mb-1">
                              {t('controls.label')}
                            </label>
                            <input
                              type="text"
                              placeholder="Equipment"
                              value={newItemLabel}
                              onChange={(e) => setNewItemLabel(e.target.value)}
                              className="w-full px-2 py-1 text-xs rounded-lg border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] text-[var(--color-text)]"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          className="w-full mt-1 py-1.5 text-xs font-bold rounded-lg bg-[var(--color-accent)] text-white hover:brightness-110 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                        >
                          <Plus className="h-3 w-3" />
                          <span>{t('controls.addItem')}</span>
                        </button>
                      </form>
                    )}

                    {/* Existing Items List */}
                    {oneTimeItems.length > 0 && (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {oneTimeItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-2 rounded-xl border border-[var(--color-line)] dark:border-[#272F3A] bg-[var(--color-surface-2)]/50 text-xs"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-200 dark:bg-gray-700 text-[var(--color-text)]">
                                M{item.month}
                              </span>
                              <span className="font-medium text-[var(--color-text)] truncate">
                                {item.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`font-bold ${item.amount < 0 ? 'text-rose-600' : 'text-emerald-600'}`}
                              >
                                {item.amount < 0 ? '-' : '+'}
                                {formatIndianRupees(Math.abs(item.amount))}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveOneTime(item.id)}
                                className="p-1 text-[var(--color-muted)] hover:text-rose-500 rounded transition-colors cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Inline 422 Error Display */}
                  {inlineError && (
                    <div className="p-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>{inlineError}</span>
                    </div>
                  )}
                </div>

                {/* RIGHT: Simulation Results (7 cols on lg) */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Headline sentence banner */}
                  <div className="rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-6 sm:p-7 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 rounded-2xl bg-[var(--color-accent)]/10 text-[var(--color-accent)] shrink-0 mt-0.5">
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                          {t('results.title')}
                        </span>
                        <h2 className="mt-1 font-[family-name:var(--font-display)] text-lg sm:text-xl font-extrabold text-[var(--color-text)] leading-snug">
                          {data.headline}
                        </h2>
                      </div>
                    </div>
                  </div>

                  {/* Hand-built SVG Line Chart */}
                  <div className="rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-5 sm:p-6 shadow-sm space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-sm font-bold text-[var(--color-text)]">
                        {t('results.chartTitle')}
                      </h3>
                      {/* Legend */}
                      <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1.5 text-[var(--color-muted)]">
                          <span className="w-4 h-0.5 border-t-2 border-dashed border-gray-400" />
                          <span>{t('results.baselineLabel')}</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-bold text-[var(--color-accent)]">
                          <span className="w-4 h-0.5 bg-[var(--color-accent)]" />
                          <span>{t('results.scenarioLabel')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Chart Container */}
                    {chartData && (
                      <div className="relative w-full overflow-x-auto">
                        <svg
                          viewBox={`0 0 ${chartData.width} ${chartData.height}`}
                          className="w-full h-auto min-w-[320px] max-w-full overflow-visible"
                        >
                          {/* Zero Line if visible */}
                          {chartData.zeroY >= chartData.padTop &&
                            chartData.zeroY <= chartData.padTop + chartData.plotHeight && (
                              <g>
                                <line
                                  x1={chartData.padLeft}
                                  x2={chartData.padLeft + chartData.plotWidth}
                                  y1={chartData.zeroY}
                                  y2={chartData.zeroY}
                                  stroke="currentColor"
                                  strokeDasharray="3 3"
                                  className="text-gray-300 dark:text-gray-700"
                                  strokeWidth="1.5"
                                />
                                <text
                                  x={chartData.padLeft - 8}
                                  y={chartData.zeroY + 3}
                                  textAnchor="end"
                                  className="text-[10px] fill-gray-400 font-bold"
                                >
                                  ₹0
                                </text>
                              </g>
                            )}

                          {/* Baseline Line (grey, dashed) */}
                          <path
                            d={chartData.baselinePath}
                            fill="none"
                            stroke="#94A3B8"
                            strokeWidth="2"
                            strokeDasharray="4 4"
                          />

                          {/* Scenario Line (accent colour) */}
                          <path
                            d={chartData.scenarioPath}
                            fill="none"
                            stroke="var(--color-accent, #2563EB)"
                            strokeWidth="3"
                          />

                          {/* Points & Interactive Tooltips */}
                          {chartData.scenarioPoints.map((pt, i) => {
                            const bPt = chartData.baselinePoints[i]
                            const isHovered = hoveredIndex === i
                            return (
                              <g
                                key={i}
                                onMouseEnter={() => setHoveredIndex(i)}
                                onMouseLeave={() => setHoveredIndex(null)}
                                className="cursor-pointer"
                              >
                                {/* Vertical highlight line */}
                                {isHovered && (
                                  <line
                                    x1={pt.x}
                                    x2={pt.x}
                                    y1={chartData.padTop}
                                    y2={chartData.padTop + chartData.plotHeight}
                                    stroke="currentColor"
                                    strokeDasharray="2 2"
                                    className="text-gray-400 dark:text-gray-600"
                                  />
                                )}

                                {/* Baseline point */}
                                <circle
                                  cx={bPt.x}
                                  cy={bPt.y}
                                  r={isHovered ? 4 : 2.5}
                                  fill="#94A3B8"
                                />

                                {/* Scenario point */}
                                <circle
                                  cx={pt.x}
                                  cy={pt.y}
                                  r={isHovered ? 6 : 4}
                                  fill="var(--color-accent, #2563EB)"
                                  stroke="white"
                                  strokeWidth="2"
                                />

                                {/* X-axis month label */}
                                <text
                                  x={pt.x}
                                  y={chartData.padTop + chartData.plotHeight + 20}
                                  textAnchor="middle"
                                  className="text-[10px] fill-[var(--color-muted)] font-medium"
                                >
                                  {pt.row.month.slice(5)}
                                </text>
                              </g>
                            )
                          })}
                        </svg>

                        {/* Hover Tooltip Box */}
                        {hoveredIndex !== null && data.scenario[hoveredIndex] && (
                          <div className="mt-2 p-3 rounded-xl bg-gray-900 text-white text-xs shadow-lg flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <span className="font-bold text-gray-300">
                                {data.scenario[hoveredIndex].month}
                              </span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span>
                                Baseline:{' '}
                                <strong className="text-gray-300">
                                  {formatIndianRupees(data.baseline[hoveredIndex]?.closing)}
                                </strong>
                              </span>
                              <span>
                                Scenario:{' '}
                                <strong className="text-white">
                                  {formatIndianRupees(data.scenario[hoveredIndex]?.closing)}
                                </strong>
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 3 Small Stat Tiles */}
                  <div className="grid gap-4 sm:grid-cols-3">
                    {/* Tile 1: End Balance */}
                    <div className="rounded-2xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-4 sm:p-5 shadow-sm">
                      <span className="text-[11px] font-bold text-[var(--color-muted)] uppercase tracking-wider block">
                        {t('results.stats.endBalance')}
                      </span>
                      <div className="mt-1 font-[family-name:var(--font-display)] text-xl font-extrabold text-[var(--color-text)]">
                        {formatIndianRupees(data.scenario_summary?.end_balance)}
                      </div>
                      <p
                        className={`text-xs font-bold mt-1 ${
                          data.end_balance_delta > 0
                            ? 'text-emerald-600'
                            : data.end_balance_delta < 0
                            ? 'text-rose-600'
                            : 'text-[var(--color-muted)]'
                        }`}
                      >
                        {data.end_balance_delta > 0 &&
                          t('results.stats.deltaBetter', {
                            amount: formatIndianRupees(data.end_balance_delta),
                          })}
                        {data.end_balance_delta < 0 &&
                          t('results.stats.deltaWorse', {
                            amount: formatIndianRupees(Math.abs(data.end_balance_delta)),
                          })}
                        {data.end_balance_delta === 0 && t('results.stats.deltaEqual')}
                      </p>
                    </div>

                    {/* Tile 2: Lowest Balance */}
                    <div className="rounded-2xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-4 sm:p-5 shadow-sm">
                      <span className="text-[11px] font-bold text-[var(--color-muted)] uppercase tracking-wider block">
                        {t('results.stats.lowestBalance')}
                      </span>
                      <div
                        className={`mt-1 font-[family-name:var(--font-display)] text-xl font-extrabold ${
                          data.scenario_summary?.lowest_balance < 0 ? 'text-rose-600' : 'text-[var(--color-text)]'
                        }`}
                      >
                        {formatIndianRupees(data.scenario_summary?.lowest_balance)}
                      </div>
                      <p className="text-xs text-[var(--color-muted)] mt-1">
                        {t('results.stats.inMonth', {
                          month: data.scenario_summary?.lowest_month || '–',
                        })}
                      </p>
                    </div>

                    {/* Tile 3: Months Below Zero */}
                    <div className="rounded-2xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-4 sm:p-5 shadow-sm">
                      <span className="text-[11px] font-bold text-[var(--color-muted)] uppercase tracking-wider block">
                        {t('results.stats.monthsBelowZero')}
                      </span>
                      <div
                        className={`mt-1 font-[family-name:var(--font-display)] text-xl font-extrabold ${
                          data.scenario_summary?.months_negative > 0 ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                      >
                        {data.scenario_summary?.months_negative}
                      </div>
                      <p className="text-xs text-[var(--color-muted)] mt-1">
                        {t('results.stats.baselineVsScenario', {
                          base: data.baseline_summary?.months_negative ?? 0,
                          scen: data.scenario_summary?.months_negative ?? 0,
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Monthly Scenario Breakdown Table */}
                  <div className="rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-5 sm:p-6 shadow-sm space-y-4">
                    <h3 className="text-sm font-bold text-[var(--color-text)]">
                      {t('results.table.title')}
                    </h3>

                    {/* Table scrolls horizontally inside card on mobile */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="border-b border-[var(--color-line)] dark:border-[#272F3A] text-[var(--color-muted)] font-semibold">
                            <th className="py-2.5 pr-4">{t('results.table.month')}</th>
                            <th className="py-2.5 px-3 text-right">{t('results.table.moneyIn')}</th>
                            <th className="py-2.5 px-3 text-right">{t('results.table.moneyOut')}</th>
                            <th className="py-2.5 px-3 text-right">{t('results.table.net')}</th>
                            <th className="py-2.5 pl-3 text-right">{t('results.table.closing')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-line)] dark:divide-[#272F3A]">
                          {data.scenario.map((row) => (
                            <tr
                              key={row.month}
                              className="hover:bg-[var(--color-surface-2)]/50 transition-colors"
                            >
                              <td className="py-2.5 pr-4 font-bold text-[var(--color-text)]">
                                {row.month}
                              </td>
                              <td className="py-2.5 px-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
                                {formatIndianRupees(row.money_in)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-medium text-rose-600 dark:text-rose-400">
                                {formatIndianRupees(row.money_out)}
                              </td>
                              <td
                                className={`py-2.5 px-3 text-right font-semibold ${
                                  row.net >= 0
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                {row.net > 0 ? '+' : ''}
                                {formatIndianRupees(row.net)}
                              </td>
                              <td
                                className={`py-2.5 pl-3 text-right font-bold ${
                                  row.closing < 0
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : 'text-[var(--color-text)]'
                                }`}
                              >
                                {formatIndianRupees(row.closing)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* "How this is calculated" note using baseline_basis */}
                    {data.baseline_basis && (
                      <div className="pt-3 border-t border-[var(--color-line)] dark:border-[#272F3A] flex items-center gap-2 text-[11px] text-[var(--color-muted)]">
                        <HelpCircle className="h-3.5 w-3.5 shrink-0" />
                        <p>
                          {t('results.basisNote', {
                            months: data.baseline_basis.months_used,
                            in: formatIndianRupees(data.baseline_basis.avg_money_in),
                            out: formatIndianRupees(data.baseline_basis.avg_money_out),
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
