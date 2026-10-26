import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import DashboardLayout from '../components/DashboardLayout'
import { useAuth } from '../context/AuthContext'
import { usePlan } from '../context/PlanContext'
import { FEATURES } from '../lib/featuresData'
import { useCatalog } from '../lib/useCatalog'
import { listDocuments } from '../lib/api'

export default function FeatureDashboardPage() {
  const { user } = useAuth()
  const { plan } = usePlan()
  const navigate = useNavigate()
  const { t } = useTranslation('dashboard')
  const { featureName, featureTagline, featureDescription, tierName, customPlanName } = useCatalog()

  const rawName = user?.displayName || user?.name || user?.email || ''
  const firstName = rawName.split(' ')[0] || t('page.partner')

  // Time-of-day greeting (was hard-coded "Good morning" at every hour).
  const hour = new Date().getHours()
  const greetingKey = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'

  // Enabled feature IDs in the current user's plan
  const planFeatureIds = plan?.featureIds || ['document_parser']

  // Real count of this business's documents saved this month (the card
  // says "Processed this month"). null = loading or backend unreachable.
  const [docsThisMonth, setDocsThisMonth] = useState(null)
  useEffect(() => {
    let cancelled = false
    listDocuments()
      .then((docs) => {
        if (cancelled) return
        const now = new Date()
        setDocsThisMonth(docs.filter((d) => {
          const created = new Date(d.created_at)
          return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth()
        }).length)
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
            <span className="text-xs font-bold uppercase tracking-wider text-[#E8622C] dark:text-[#F27A4A]">{t('page.overview')}</span>
            <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-extrabold text-[#2A2521] dark:text-[#F5EFE8]">
              {t(`page.greeting.${greetingKey}`, { name: firstName })}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[#8A7F74] dark:text-[#A89E92]">
              {t('page.subtitle')}
            </p>
          </div>

          <button
            onClick={() => navigate('/upload')}
            className="self-start sm:self-auto flex items-center gap-2 rounded-xl bg-[#E8622C] dark:bg-[#F27A4A] px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-[#E8622C]/20 hover:bg-[#D4531F] dark:hover:bg-[#E56938] transition-all cursor-pointer"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            <span>{t('page.upload')}</span>
          </button>
        </div>

        {/* 4 STAT CARDS ROW */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Total Sales */}
          <div className="rounded-2xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#8A7F74] dark:text-[#A89E92]">{t('page.stats.totalSales')}</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1F9254]/10 text-[#1F9254]">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </div>
            </div>
            <p className="mt-3 font-[family-name:var(--font-display)] text-2xl font-extrabold text-[#2A2521] dark:text-[#F5EFE8]">
              ₹12,45,000
            </p>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#1F9254]">
              <span>{t('page.stats.salesTrend')}</span>
            </div>
          </div>

          {/* Card 2: Total Expenses */}
          <div className="rounded-2xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#8A7F74] dark:text-[#A89E92]">{t('page.stats.totalExpenses')}</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#E8622C]/10 text-[#E8622C]">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h12M6 12h8"/></svg>
              </div>
            </div>
            <p className="mt-3 font-[family-name:var(--font-display)] text-2xl font-extrabold text-[#2A2521] dark:text-[#F5EFE8]">
              ₹8,30,000
            </p>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#1F9254]">
              <span>{t('page.stats.expensesTrend')}</span>
            </div>
          </div>

          {/* Card 3: Net Profit */}
          <div className="rounded-2xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#8A7F74] dark:text-[#A89E92]">{t('page.stats.netProfit')}</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1F9254]/10 text-[#1F9254]">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
              </div>
            </div>
            <p className="mt-3 font-[family-name:var(--font-display)] text-2xl font-extrabold text-[#E8622C] dark:text-[#F27A4A]">
              ₹4,15,000
            </p>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#1F9254]">
              <span>{t('page.stats.profitTrend')}</span>
            </div>
          </div>

          {/* Card 4: Documents Count */}
          <div className="rounded-2xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#8A7F74] dark:text-[#A89E92]">{t('page.stats.documents')}</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#E8622C]/10 text-[#E8622C]">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
            </div>
            <p className="mt-3 font-[family-name:var(--font-display)] text-2xl font-extrabold text-[#2A2521] dark:text-[#F5EFE8]">
              {docsThisMonth ?? '–'}
            </p>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#8A7F74] dark:text-[#A89E92]">
              <span>{t('page.stats.documentsNote')}</span>
            </div>
          </div>
        </div>

        {/* TOOLS & FEATURES SECTION */}
        <div>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-[#2A2521] dark:text-[#F5EFE8]">
                {t('page.tools.title')}
              </h2>
              <p className="mt-0.5 text-xs text-[#8A7F74] dark:text-[#A89E92]">
                {t('page.tools.subtitle', { plan: plan?.type === 'tier' ? tierName(plan.tierId) : customPlanName() })}
              </p>
            </div>
            <button
              onClick={() => navigate('/choose-plan')}
              className="text-xs font-bold text-[#E8622C] dark:text-[#F27A4A] hover:underline cursor-pointer"
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
                      ? 'border-[#E8622C]/40 dark:border-[#F27A4A]/40 bg-[#FFFFFF] dark:bg-[#242019] shadow-sm hover:shadow-md'
                      : 'border-[#F0E4D8] dark:border-[#3A332A] bg-[#FBF3EC]/50 dark:bg-[#1A1714]/50 opacity-75'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-[#2A2521] dark:text-[#F5EFE8]">
                        {featureName(feature.id)}
                      </h3>
                      {isEnabled ? (
                        <span className="rounded-full bg-[#E8F5EC] dark:bg-[#132E21] px-2.5 py-0.5 text-[10px] font-bold text-[#1F9254] dark:text-[#34D399]">
                          {t('page.tools.active')}
                        </span>
                      ) : (
                        <span className="rounded-full bg-[#F3ECE5] dark:bg-[#2E2822] px-2.5 py-0.5 text-[10px] font-bold text-[#9B9389]">
                          {t('page.tools.comingSoon')}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-[#8A7F74] dark:text-[#A89E92] leading-relaxed">
                      {featureDescription(feature.id)}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-[#F0E4D8] dark:border-[#3A332A]/60 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#8A7F74] dark:text-[#A89E92]">
                      {featureTagline(feature.id)}
                    </span>

                    {isEnabled ? (
                      isParser ? (
                        <button
                          onClick={() => navigate('/upload')}
                          className="rounded-xl bg-[#E8622C] dark:bg-[#F27A4A] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#D4531F] dark:hover:bg-[#E56938] transition-all cursor-pointer"
                        >
                          {t('page.tools.useNow')}
                        </button>
                      ) : (
                        <button
                          onClick={() => navigate('/upload')}
                          className="rounded-xl border border-[#E8622C] dark:border-[#F27A4A] px-4 py-2 text-xs font-bold text-[#E8622C] dark:text-[#F27A4A] hover:bg-[#E8622C] hover:text-white dark:hover:bg-[#F27A4A] dark:hover:text-[#1A1714] transition-all cursor-pointer"
                        >
                          {t('page.tools.openTool')}
                        </button>
                      )
                    ) : (
                      <button
                        disabled
                        className="rounded-xl border border-[#F0E4D8] dark:border-[#3A332A] px-3.5 py-1.5 text-xs font-semibold text-[#9B9389] cursor-not-allowed"
                      >
                        {t('page.tools.locked')}
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
