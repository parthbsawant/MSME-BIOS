import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Plus,
  ArrowUpRight,
  IndianRupee,
  Receipt,
  TrendingUp,
  FileText,
  Lock,
} from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout'
import { useAuth } from '../context/AuthContext'
import { usePlan } from '../context/PlanContext'
import { FEATURES } from '../lib/featuresData'
import { useCatalog } from '../lib/useCatalog'
import { listDocuments } from '../lib/api'
import { useBusiness } from '../context/BusinessContext'

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

  // Real count of this business's documents saved this month (the card
  // says "Processed this month"). null = loading or backend unreachable.
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
            <span className="inline-block rounded-md bg-[var(--color-accent-soft)] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[var(--color-accent)]">
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
            className="self-start sm:self-auto flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-[var(--color-accent)]/20 hover:bg-[var(--color-accent-hover)] transition-all transform active:scale-95 cursor-pointer"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            <span>{t('page.upload')}</span>
          </button>
        </div>

        {/* 4 STAT CARDS ROW */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Total Sales */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--color-muted)]">
                {t('page.stats.totalSales')}
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-success-soft)] text-[var(--color-success)]">
                <IndianRupee className="h-4 w-4" strokeWidth={2.2} />
              </div>
            </div>
            <p className="mt-3 font-[family-name:var(--font-display)] text-2xl font-extrabold text-[var(--color-text)] tabular-nums">
              ₹12,45,000
            </p>
            <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--color-success)]">
              <TrendingUp className="h-3.5 w-3.5" strokeWidth={2} />
              <span>{t('page.stats.salesTrend')}</span>
            </div>
          </div>

          {/* Card 2: Total Expenses */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--color-muted)]">
                {t('page.stats.totalExpenses')}
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                <Receipt className="h-4 w-4" strokeWidth={2.2} />
              </div>
            </div>
            <p className="mt-3 font-[family-name:var(--font-display)] text-2xl font-extrabold text-[var(--color-text)] tabular-nums">
              ₹8,30,000
            </p>
            <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--color-success)]">
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
              <span>{t('page.stats.expensesTrend')}</span>
            </div>
          </div>

          {/* Card 3: Net Profit */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--color-muted)]">
                {t('page.stats.netProfit')}
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-success-soft)] text-[var(--color-success)]">
                <TrendingUp className="h-4 w-4" strokeWidth={2.2} />
              </div>
            </div>
            <p className="mt-3 font-[family-name:var(--font-display)] text-2xl font-extrabold text-[var(--color-accent)] tabular-nums">
              ₹4,15,000
            </p>
            <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--color-success)]">
              <span>{t('page.stats.profitTrend')}</span>
            </div>
          </div>

          {/* Card 4: Documents Count */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--color-muted)]">
                {t('page.stats.documents')}
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                <FileText className="h-4 w-4" strokeWidth={2.2} />
              </div>
            </div>
            <p className="mt-3 font-[family-name:var(--font-display)] text-2xl font-extrabold text-[var(--color-text)] tabular-nums">
              {docsThisMonth ?? '–'}
            </p>
            <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--color-muted)]">
              <span>{t('page.stats.documentsNote')}</span>
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
            {FEATURES.map((feature) => {
              const isEnabled = planFeatureIds.includes(feature.id)
              const isParser = feature.id === 'document_parser'

              return (
                <div
                  key={feature.id}
                  className={`flex flex-col justify-between rounded-2xl border p-6 transition-all ${
                    isEnabled
                      ? 'border-[var(--color-border)] bg-[var(--color-card)] shadow-xs hover:shadow-md hover:border-[var(--color-accent)]/50'
                      : 'border-[var(--color-border)] bg-[var(--color-bg-subtle)]/60 opacity-75'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-[var(--color-text)]">
                        {featureName(feature.id)}
                      </h3>
                      {isEnabled ? (
                        <span className="rounded-full bg-[var(--color-success-soft)] px-2.5 py-0.5 text-[10px] font-bold text-[var(--color-success)] border border-[var(--color-success)]/20">
                          {t('page.tools.active')}
                        </span>
                      ) : (
                        <span className="rounded-full bg-[var(--color-bg-subtle)] px-2.5 py-0.5 text-[10px] font-bold text-[var(--color-muted)] border border-[var(--color-border)]">
                          {t('page.tools.comingSoon')}
                        </span>
                      )}
                    </div>
                    <p className="mt-2.5 text-xs text-[var(--color-muted)] leading-relaxed">
                      {featureDescription(feature.id)}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-[var(--color-border)] flex items-center justify-between">
                    <span className="text-[11px] font-medium text-[var(--color-muted)] truncate max-w-[150px]">
                      {featureTagline(feature.id)}
                    </span>

                    {isEnabled ? (
                      isParser ? (
                        <button
                          onClick={() => navigate('/upload')}
                          className="rounded-xl bg-[var(--color-accent)] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[var(--color-accent-hover)] transition-all cursor-pointer"
                        >
                          {t('page.tools.useNow')}
                        </button>
                      ) : (
                        <button
                          onClick={() => navigate('/upload')}
                          className="rounded-xl border border-[var(--color-accent)] px-4 py-2 text-xs font-bold text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-white transition-all cursor-pointer"
                        >
                          {t('page.tools.openTool')}
                        </button>
                      )
                    ) : (
                      <button
                        disabled
                        className="flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-muted)]/60 cursor-not-allowed"
                      >
                        <Lock className="h-3 w-3" strokeWidth={2} />
                        <span>{t('page.tools.locked')}</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
