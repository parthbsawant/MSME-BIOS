import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { formatPrice } from '../lib/featuresData'
import { useCatalog } from '../lib/useCatalog'

export default function PricingTierCard({ tier, onSelect, ctaLabel, isPopular = false }) {
  const { t } = useTranslation()
  const { t: tb } = useTranslation('billing')
  const { featureName, tierName, tierBand } = useCatalog()
  const popular = isPopular || tier.id === 'growth'

  return (
    <div
      className={`relative flex flex-col justify-between rounded-2xl border p-6 transition-all duration-200 hover:-translate-y-1 ${
        popular
          ? 'bg-[var(--color-dark-block)] text-[var(--color-dark-text)] border-[var(--color-dark-line)] shadow-[var(--shadow-cool-lg)] ring-1 ring-[var(--color-dark-line)]'
          : 'bg-white dark:bg-[var(--color-surface)] text-[var(--color-ink)] border-[var(--color-line)] shadow-xs hover:border-[var(--color-line)] hover:shadow-[var(--shadow-cool-md)]'
      }`}
    >
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--color-highlight)] px-3 py-0.5 text-[10px] font-extrabold tracking-wide uppercase text-[var(--color-highlight-text)] shadow-xs">
          {t('plan.mostPopular')}
        </div>
      )}

      <div>
        <div className="flex items-baseline justify-between">
          <h3 className={`font-[family-name:var(--font-display)] text-xl font-bold ${
            popular ? 'text-[var(--color-dark-text)]' : 'text-[var(--color-ink)]'
          }`}>
            {tierName(tier.id)}
          </h3>
        </div>
        <p className={`mt-1 text-xs leading-relaxed ${
          popular ? 'text-[var(--color-dark-muted)]' : 'text-[var(--color-muted)]'
        }`}>{tierBand(tier.id)}</p>

        <div className="mt-6 flex items-baseline gap-1.5">
          <span
            data-tabular="true"
            className={`font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-tight ${
              popular ? 'text-[var(--color-dark-text)]' : 'text-[var(--color-ink)]'
            }`}
          >
            {formatPrice(tier.price)}
          </span>
          <span className={`text-xs font-medium ${
            popular ? 'text-[var(--color-dark-muted)]' : 'text-[var(--color-muted)]'
          }`}>{t('plan.perMonth')}</span>
        </div>
        {tier.seatsIncluded && (
          <p className="mt-1.5 text-xs font-semibold text-[var(--color-accent)]">
            {tb('seats.included', { count: tier.seatsIncluded })}
          </p>
        )}

        <div className={`mt-6 space-y-2.5 border-t pt-5 ${
          popular ? 'border-[var(--color-dark-line)]' : 'border-[var(--color-line-subtle)]'
        }`}>
          <p className={`text-[10px] font-bold uppercase tracking-wider ${
            popular ? 'text-[var(--color-dark-muted)]' : 'text-[var(--color-muted)]'
          }`}>
            {t('plan.featuresIncluded')}
          </p>
          {tier.featureIds.map((id) => {
            return (
              <div key={id} className={`flex items-start gap-2.5 text-xs ${
                popular ? 'text-[var(--color-dark-text)]' : 'text-[var(--color-ink)]'
              }`}>
                <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-success-soft)] text-[var(--color-success)] shrink-0 mt-0.5">
                  <Check className="h-2.5 w-2.5" strokeWidth={3} />
                </div>
                <span className="leading-tight">{featureName(id)}</span>
              </div>
            )
          })}
        </div>
      </div>

      {onSelect && (
        <button
          type="button"
          onClick={onSelect}
          className={`mt-8 w-full rounded-xl py-3 text-xs font-bold transition-all duration-150 active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
            popular
              ? 'bg-[var(--color-accent)] text-white dark:text-[#0E1116] hover:bg-[var(--color-accent-hover)] shadow-xs'
              : 'border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface-2)]'
          }`}
        >
          {ctaLabel ?? t('plan.choosePlan')}
        </button>
      )}
    </div>
  )
}
