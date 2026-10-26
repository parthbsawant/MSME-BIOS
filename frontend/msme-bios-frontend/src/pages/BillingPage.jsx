import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import DashboardLayout from '../components/DashboardLayout'
import { usePlan } from '../context/PlanContext'
import { useCatalog } from '../lib/useCatalog'
import { formatPrice } from '../lib/featuresData'

// STEP 3: read-only billing summary for the owner (SPEC.md section 10).
// Everyone is the owner until roles exist (Step 4); the route then gets an
// owner-only guard. Plan changes and upgrades are a later step.
export default function BillingPage() {
  const { t, i18n } = useTranslation('billing')
  const { tierName, customPlanName, featureName } = useCatalog()
  const { plan, subscription, refreshPlan } = usePlan()

  // Show the backend's latest figures, not only the cached ones.
  useEffect(() => {
    refreshPlan().catch((err) => console.error('Could not refresh billing:', err))
  }, [])

  if (!plan) {
    return (
      <DashboardLayout activeItem="Billing">
        <p className="text-sm text-[#8A7F74]">{t('page.none')}</p>
      </DashboardLayout>
    )
  }

  const included = plan.seatsIncluded ?? 0
  const extra = plan.extraSeats ?? 0
  const status = subscription?.status
  const statusStyle = {
    active: 'bg-[#E8F5EC] dark:bg-[#132E21] text-[#1F9254] dark:text-[#34D399] border-emerald-300 dark:border-emerald-700',
    pending: 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700',
    failed: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900/50',
  }[status] || ''
  const paidOn = subscription?.paid_at
    ? new Date(subscription.paid_at).toLocaleDateString(i18n.language === 'en' ? 'en-IN' : `${i18n.language}-IN`, { day: 'numeric', month: 'long', year: 'numeric' })
    : '—'

  const row = (label, value) => (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-3 border-b border-[#F0E4D8] dark:border-[#3A332A] last:border-0">
      <dt className="text-xs text-[#8A7F74] dark:text-[#A89E92]">{label}</dt>
      <dd className="text-sm font-semibold text-[#2A2521] dark:text-[#F5EFE8]">{value}</dd>
    </div>
  )

  return (
    <DashboardLayout activeItem="Billing">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-extrabold text-[#2A2521] dark:text-[#F5EFE8]">{t('page.title')}</h1>
          <p className="mt-1 text-xs sm:text-sm text-[#8A7F74] dark:text-[#A89E92]">{t('page.subtitle')}</p>
        </div>

        <div className="rounded-3xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] p-6 shadow-sm">
          <dl>
            {row(t('page.plan'), plan.type === 'tier' ? tierName(plan.tierId) : customPlanName())}
            {row(t('page.status'), status ? (
              <span className={`inline-block rounded-full border px-3 py-0.5 text-xs font-bold ${statusStyle}`}>{t(`page.status_${status}`)}</span>
            ) : '—')}
            {row(t('page.amount'), <span className="font-[family-name:var(--font-data)]">{formatPrice(subscription?.amount ?? plan.price)}</span>)}
            {row(t('page.seats'), t('page.seatsValue', { total: subscription?.seats_purchased ?? included + extra, included, extra }))}
            {row(t('page.paymentMethod'), subscription ? t(`page.provider_${subscription.provider}`, { defaultValue: subscription.provider }) : '—')}
            {row(t('page.paidOn'), paidOn)}
          </dl>
        </div>

        <div className="rounded-3xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] p-6 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#2A2521] dark:text-[#F5EFE8]">{t('page.features', { count: plan.featureIds.length })}</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {plan.featureIds.map((id) => (
              <li key={id} className="flex items-center gap-2 text-xs text-[#2A2521] dark:text-[#F5EFE8]">
                <svg className="h-3.5 w-3.5 shrink-0 text-[#1F9254] dark:text-[#34D399]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                {featureName(id)}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[11px] text-[#8A7F74] dark:text-[#A89E92]">{t('page.readOnly')}</p>
      </div>
    </DashboardLayout>
  )
}
