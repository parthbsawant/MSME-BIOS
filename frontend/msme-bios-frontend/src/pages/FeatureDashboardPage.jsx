import { useEffect, useState } from 'react'
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
} from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout'
import { useAuth } from '../context/AuthContext'
import { usePlan } from '../context/PlanContext'
import { FEATURES } from '../lib/featuresData'
import { useCatalog } from '../lib/useCatalog'
import { listDocuments } from '../lib/api'
import { useBusiness } from '../context/BusinessContext'

function AnimatedNumber({ value, prefix = '', suffix = '', duration = 1200 }) {
  const [displayValue, setDisplayValue] = useState(0)
  const numericTarget = typeof value === 'number' ? value : parseInt(String(value).replace(/\D/g, ''), 10) || 0

  useEffect(() => {
    let startTimestamp = null
    let animationFrameId

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp
      const progress = Math.min((timestamp - startTimestamp) / duration, 1)
      // Ease out cubic
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
  return <span>{prefix}{formatted}{suffix}</span>
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

  // Time-of-day greeting (was hard-coded "Good morning" at every hour).
  const hour = new Date().getHours()
  const greetingKey = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'

  // STEP 5: enabled features = plan ∩ role, from /api/me. The owner's
  // equals the plan. Falls back to the plan if the role isn't known yet.
  const { role, isOwner, effectiveFeatures } = useBusiness()
  const planFeatureIds = role ? effectiveFeatures : (plan?.featureIds || ['document_parser'])
  const canUpload = planFeatureIds.includes('document_parser')

  // Real count of this business's documents saved this month
  const [docsThisMonth, setDocsThisMonth] = useState(null)
  useEffect(() => {
    let cancelled = false
    listDocuments()
      .then((docs) => {
        if (cancelled) return
        const now = new Date()
        setDocsThisMonth(
          docs.filter((d) => {
            const created = new Date(d.created_at)
            return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth()
          }).length
        )
      })
      .catch((err) => console.error('Could not load documents:', err))
    return () => {
      cancelled = true
    }
  }, [])

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

        {/* 4 STAT CARDS ROW WITH F1 TINTS & SPARKLINES */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Total Sales (Blue Tint #E4ECFF / #16213A) */}
          <div className="group rounded-2xl border border-[#C8D6F2] dark:border-[#223152] bg-[#E4ECFF] dark:bg-[#16213A] p-5 shadow-xs hover:-translate-y-1 hover:shadow-[var(--shadow-cool-md)] transition-all duration-350 ease-out flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--color-muted)]">
                  {t('page.stats.totalSales')}
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 dark:bg-[#141F38] text-[var(--color-accent)] shadow-xs">
                  <IndianRupee className="h-4 w-4" strokeWidth={2.2} />
                </div>
              </div>
              <p className="mt-3 font-[family-name:var(--font-display)] text-2xl font-extrabold text-[var(--color-text)] tabular-nums">
                <AnimatedNumber value={1245000} prefix="₹" />
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2 pt-2 border-t border-[#C8D6F2]/60 dark:border-[#223152]/60">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--color-success)]">
                <TrendingUp className="h-3.5 w-3.5" strokeWidth={2} />
                <span>{t('page.stats.salesTrend')}</span>
              </div>
              {/* Mini Sparkline Blue */}
              <svg className="w-16 h-6 overflow-visible" viewBox="0 0 64 24" fill="none">
                <motion.path
                  d="M2 18 L16 12 L28 15 L42 6 L54 10 L62 2"
                  stroke="#2F5BFF"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                />
              </svg>
            </div>
          </div>

          {/* Card 2: Total Expenses (Amber Tint #FFF1E0 / #3A2A18) */}
          <div className="group rounded-2xl border border-[#FDE1C3] dark:border-[#523A20] bg-[#FFF1E0] dark:bg-[#3A2A18] p-5 shadow-xs hover:-translate-y-1 hover:shadow-[var(--shadow-cool-md)] transition-all duration-350 ease-out flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--color-muted)]">
                  {t('page.stats.totalExpenses')}
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 dark:bg-[#4A321B] text-[#FF8A1F] shadow-xs">
                  <Receipt className="h-4 w-4" strokeWidth={2.2} />
                </div>
              </div>
              <p className="mt-3 font-[family-name:var(--font-display)] text-2xl font-extrabold text-[var(--color-text)] tabular-nums">
                <AnimatedNumber value={830000} prefix="₹" />
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2 pt-2 border-t border-[#FDE1C3]/60 dark:border-[#523A20]/60">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--color-success)]">
                <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
                <span>{t('page.stats.expensesTrend')}</span>
              </div>
              {/* Mini Sparkline Amber */}
              <svg className="w-16 h-6 overflow-visible" viewBox="0 0 64 24" fill="none">
                <motion.path
                  d="M2 14 L14 16 L28 8 L40 12 L52 4 L62 7"
                  stroke="#FF8A1F"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
                />
              </svg>
            </div>
          </div>

          {/* Card 3: Net Profit (Green Tint #E3F6EC / #12302A) */}
          <div className="group rounded-2xl border border-[#C2EDD5] dark:border-[#1E4A3F] bg-[#E3F6EC] dark:bg-[#12302A] p-5 shadow-xs hover:-translate-y-1 hover:shadow-[var(--shadow-cool-md)] transition-all duration-350 ease-out flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--color-muted)]">
                  {t('page.stats.netProfit')}
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 dark:bg-[#1A3D35] text-[#12A06B] shadow-xs">
                  <TrendingUp className="h-4 w-4" strokeWidth={2.2} />
                </div>
              </div>
              <p className="mt-3 font-[family-name:var(--font-display)] text-2xl font-extrabold text-[#12A06B] dark:text-[#34D399] tabular-nums">
                <AnimatedNumber value={415000} prefix="₹" />
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2 pt-2 border-t border-[#C2EDD5]/60 dark:border-[#1E4A3F]/60">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--color-success)]">
                <span>{t('page.stats.profitTrend')}</span>
              </div>
              {/* Mini Sparkline Green */}
              <svg className="w-16 h-6 overflow-visible" viewBox="0 0 64 24" fill="none">
                <motion.path
                  d="M2 20 L16 16 L30 10 L44 8 L52 4 L62 2"
                  stroke="#12A06B"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                />
              </svg>
            </div>
          </div>

          {/* Card 4: Documents Count (Rose Tint #FDE7EA / #3A1C24) */}
          <div className="group rounded-2xl border border-[#FBD0D6] dark:border-[#52222E] bg-[#FDE7EA] dark:bg-[#3A1C24] p-5 shadow-xs hover:-translate-y-1 hover:shadow-[var(--shadow-cool-md)] transition-all duration-350 ease-out flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--color-muted)]">
                  {t('page.stats.documents')}
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 dark:bg-[#4E222D] text-[#E0457B] shadow-xs">
                  <FileText className="h-4 w-4" strokeWidth={2.2} />
                </div>
              </div>
              <p className="mt-3 font-[family-name:var(--font-display)] text-2xl font-extrabold text-[var(--color-text)] tabular-nums">
                {docsThisMonth !== null ? <AnimatedNumber value={docsThisMonth} /> : '–'}
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2 pt-2 border-t border-[#FBD0D6]/60 dark:border-[#52222E]/60">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--color-muted)]">
                <span>{t('page.stats.documentsNote')}</span>
              </div>
              {/* Mini Sparkline Rose */}
              <svg className="w-16 h-6 overflow-visible" viewBox="0 0 64 24" fill="none">
                <motion.path
                  d="M2 16 L14 10 L26 14 L38 6 L50 9 L62 3"
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

        {/* ATTRACTIVE ANIMATED PERFORMANCE & CASH-FLOW CHART */}
        <div className="rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-6 sm:p-7 shadow-[var(--shadow-cool-md)] hover:shadow-[var(--shadow-cool-lg)] transition-all duration-350 ease-out">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[var(--color-line)] dark:border-[#272F3A]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-accent)] shadow-xs">
                <Activity className="h-5 w-5" strokeWidth={2.2} />
              </div>
              <div>
                <h3 className="font-[family-name:var(--font-display)] text-base sm:text-lg font-bold text-[var(--color-text)]">
                  {t('page.stats.salesTrend')} &middot; {t('page.stats.netProfit')}
                </h3>
                <p className="text-xs text-[var(--color-muted)] mt-0.5">
                  ₹12,45,000 &middot; ₹4,15,000
                </p>
              </div>
            </div>

            {/* Department colored indicator chips */}
            <div className="flex items-center gap-3 text-xs font-semibold">
              <div className="flex items-center gap-1.5 text-[var(--color-muted)]">
                <span className="h-2.5 w-2.5 rounded-full bg-[#FF8A1F] shadow-xs" />
                <span className="text-[11px] font-medium text-[var(--color-text)]">₹ (Sales)</span>
              </div>
              <div className="flex items-center gap-1.5 text-[var(--color-muted)]">
                <span className="h-2.5 w-2.5 rounded-full bg-[#2F5BFF] shadow-xs" />
                <span className="text-[11px] font-medium text-[var(--color-text)]">₹ (Profit)</span>
              </div>
            </div>
          </div>

          {/* High-fidelity SVG Chart */}
          <div className="relative mt-6 pt-2">
            <svg
              className="w-full h-56 sm:h-64 overflow-visible"
              viewBox="0 0 700 220"
              preserveAspectRatio="none"
            >
              <defs>
                {/* Glowing drop shadow filter for Saffron curve */}
                <filter id="saffronGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#FF8A1F" floodOpacity="0.45" />
                </filter>
                <filter id="cobaltGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#2F5BFF" floodOpacity="0.30" />
                </filter>

                {/* Saffron Gradient Fill */}
                <linearGradient id="saffronAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF8A1F" stopOpacity="0.32" />
                  <stop offset="60%" stopColor="#FF8A1F" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#FF8A1F" stopOpacity="0.0" />
                </linearGradient>

                {/* Cobalt Gradient Fill */}
                <linearGradient id="cobaltAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2F5BFF" stopOpacity="0.22" />
                  <stop offset="80%" stopColor="#2F5BFF" stopOpacity="0.02" />
                  <stop offset="100%" stopColor="#2F5BFF" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Background Grid Lines */}
              <line x1="0" y1="40" x2="700" y2="40" stroke="currentColor" className="text-[var(--color-line)] dark:text-[#272F3A]" strokeDasharray="4 4" strokeWidth="1" />
              <line x1="0" y1="95" x2="700" y2="95" stroke="currentColor" className="text-[var(--color-line)] dark:text-[#272F3A]" strokeDasharray="4 4" strokeWidth="1" />
              <line x1="0" y1="150" x2="700" y2="150" stroke="currentColor" className="text-[var(--color-line)] dark:text-[#272F3A]" strokeDasharray="4 4" strokeWidth="1" />
              <line x1="0" y1="205" x2="700" y2="205" stroke="currentColor" className="text-[var(--color-line)] dark:text-[#272F3A]" strokeWidth="1.2" />

              {/* Animated Background Bars Growing Up */}
              {[
                { x: 45, h: 90 },
                { x: 135, h: 120 },
                { x: 225, h: 80 },
                { x: 315, h: 140 },
                { x: 405, h: 110 },
                { x: 495, h: 165 },
                { x: 585, h: 130 },
                { x: 655, h: 175 },
              ].map((bar, i) => (
                <motion.rect
                  key={i}
                  x={bar.x}
                  y={205 - bar.h}
                  width="22"
                  height={bar.h}
                  rx="6"
                  className="fill-[var(--color-surface-2)]/80 dark:fill-[#1C222B]/80 hover:fill-[var(--color-accent)]/20 transition-colors"
                  initial={{ scaleY: 0, originY: 1 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 0.9, delay: 0.1 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                />
              ))}

              {/* Cobalt Area & Path (Profit) */}
              <motion.path
                d="M10 160 C 90 145, 150 170, 220 135 C 290 100, 360 140, 440 95 C 520 50, 600 80, 690 45 L690 205 L10 205 Z"
                fill="url(#cobaltAreaGradient)"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1.2, delay: 0.3 }}
              />
              <motion.path
                d="M10 160 C 90 145, 150 170, 220 135 C 290 100, 360 140, 440 95 C 520 50, 600 80, 690 45"
                fill="none"
                stroke="#2F5BFF"
                strokeWidth="2.5"
                strokeLinecap="round"
                filter="url(#cobaltGlow)"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
              />

              {/* Primary Saffron Area & Path (Sales Signature) */}
              <motion.path
                d="M10 120 C 80 80, 150 110, 230 75 C 310 40, 390 90, 470 50 C 550 10, 620 40, 690 15 L690 205 L10 205 Z"
                fill="url(#saffronAreaGradient)"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1.2, delay: 0.1 }}
              />
              <motion.path
                d="M10 120 C 80 80, 150 110, 230 75 C 310 40, 390 90, 470 50 C 550 10, 620 40, 690 15"
                fill="none"
                stroke="#FF8A1F"
                strokeWidth="3.2"
                strokeLinecap="round"
                filter="url(#saffronGlow)"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
              />

              {/* Animated Pulse Dot at Peak */}
              <g transform="translate(690, 15)">
                <motion.circle
                  r="12"
                  className="fill-[#FF8A1F]/30"
                  animate={{ r: [6, 14, 6], opacity: [0.7, 0.1, 0.7] }}
                  transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
                />
                <circle r="5" fill="#FF8A1F" stroke="#FFFFFF" strokeWidth="2.5" />
              </g>

              {/* Intermediate Saffron Landmark Dot */}
              <g transform="translate(470, 50)">
                <circle r="4.5" fill="#FF8A1F" stroke="#FFFFFF" strokeWidth="2" />
              </g>

              {/* Cobalt Highlight Dot */}
              <g transform="translate(440, 95)">
                <circle r="4" fill="#2F5BFF" stroke="#FFFFFF" strokeWidth="2" />
              </g>
            </svg>

            {/* Bottom time-axis markers */}
            <div className="flex justify-between items-center text-[10px] font-semibold text-[var(--color-muted)] pt-3 tabular-nums font-[family-name:var(--font-data)]">
              <span>W1</span>
              <span>W2</span>
              <span>W3</span>
              <span>W4</span>
              <span>W5</span>
              <span>W6</span>
              <span>W7</span>
              <span>W8</span>
            </div>
          </div>
        </div>

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
              const isParser = feature.id === 'document_parser'

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
                      isParser ? (
                        <button
                          onClick={() => navigate('/upload')}
                          className="rounded-xl bg-[var(--color-accent)] px-4 py-2 text-xs font-bold text-white shadow-xs hover:brightness-110 transition-all duration-300 ease-out cursor-pointer"
                        >
                          {t('page.tools.useNow')}
                        </button>
                      ) : (
                        <button
                          onClick={() => navigate('/upload')}
                          className="rounded-xl border border-[var(--color-accent)] px-4 py-2 text-xs font-bold text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-white transition-all duration-300 ease-out cursor-pointer"
                        >
                          {t('page.tools.openTool')}
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
