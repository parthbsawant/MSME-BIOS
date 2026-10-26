import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
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
  }, [refreshPlan])

  if (!plan) {
    return (
      <DashboardLayout activeItem="Billing">
        <p className="text-sm text-[var(--color-muted)]">{t('page.none')}</p>
      </DashboardLayout>
    )
  }

  const included = plan.seatsIncluded ?? 0
  const extra = plan.extraSeats ?? 0
  const status = subscription?.status
  const statusStyle =
    {
      active:
        'bg-[var(--color-success-soft)] text-[var(--color-success)] border border-[var(--color-success)]/20',
      pending:
        'bg-[var(--color-warning-soft)] text-[var(--color-warning)] border border-[var(--color-warning)]/20',
      failed:
        'bg-[var(--color-danger-soft)] text-[var(--color-danger)] border border-[var(--color-danger)]/20',
    }[status] || ''

  const paidOn = subscription?.paid_at
    ? new Date(subscription.paid_at).toLocaleDateString(
        i18n.language === 'en' ? 'en-IN' : `${i18n.language}-IN`,
        { day: 'numeric', month: 'long', year: 'numeric' },
      )
    : '—'

  const row = (label, value) => (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-3.5 border-b border-[var(--color-line-subtle)] last:border-0">
      <dt className="text-xs text-[var(--color-muted)] font-medium">{label}</dt>
      <dd className="text-sm font-semibold text-[var(--color-ink)]">{value}</dd>
    </div>
  )

  return (
    <DashboardLayout activeItem="Billing">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-extrabold text-[var(--color-ink)] tracking-tight">
            {t('page.title')}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[var(--color-muted)] leading-relaxed">
            {t('page.subtitle')}
          </p>
        </div>

        <div className="rounded-3xl border border-[var(--color-line)] bg-[var(--color-surface)] p-6 sm:p-8 shadow-xs">
          <dl>
            {row(t('page.plan'), plan.type === 'tier' ? tierName(plan.tierId) : customPlanName())}
            {row(
              t('page.status'),
              status ? (
                <span className={`inline-block rounded-full px-3 py-0.5 text-xs font-bold ${statusStyle}`}>
                  {t(`page.status_${status}`)}
                </span>
              ) : (
                '—'
              ),
            )}
            {row(
              t('page.amount'),
              <span data-tabular="true" className="font-[family-name:var(--font-data)]">
                {formatPrice(subscription?.amount ?? plan.price)}
              </span>,
            )}
            {row(
              t('page.seats'),
              t('page.seatsValue', {
                total: subscription?.seats_purchased ?? included + extra,
                included,
                extra,
              }),
            )}
            {row(
              t('page.paymentMethod'),
              subscription
                ? t(`page.provider_${subscription.provider}`, {
                    defaultValue: subscription.provider,
                  })
                : '—',
            )}
            {row(t('page.paidOn'), paidOn)}
          </dl>
        </div>

        <div className="rounded-3xl border border-[var(--color-line)] bg-[var(--color-surface)] p-6 sm:p-8 shadow-xs">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
            {t('page.features', { count: plan.featureIds.length })}
          </h2>
          <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {plan.featureIds.map((id) => (
              <li
                key={id}
                className="flex items-center gap-2.5 text-xs text-[var(--color-ink)] p-1.5 rounded-lg"
              >
                <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-success-soft)] text-[var(--color-success)] shrink-0">
                  <Check className="h-2.5 w-2.5" strokeWidth={3} />
                </div>
                <span>{featureName(id)}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[11px] text-[var(--color-muted)] leading-relaxed">{t('page.readOnly')}</p>
      </div>
    </DashboardLayout>
  )
}
