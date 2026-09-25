import { formatPrice, featureById } from '../lib/featuresData'

export default function PricingTierCard({ tier, onSelect, ctaLabel = 'Choose plan' }) {
  return (
    <div className="flex flex-col border border-black/15 dark:border-white/15 p-6">
      <p className="font-[family-name:var(--font-display)] text-xl font-semibold">{tier.name}</p>
      <p className="mt-1 text-xs text-black/50 dark:text-white/50">{tier.band}</p>
      <p className="mt-6 font-[family-name:var(--font-data)] text-2xl">
        {formatPrice(tier.price)}<span className="text-sm text-black/40 dark:text-white/40">/mo</span>
      </p>
      <div className="mt-6 flex-1 space-y-2 border-t border-black/10 dark:border-white/10 pt-6">
        {tier.featureIds.map((id) => (
          <p key={id} className="text-sm text-black/70 dark:text-white/70">{featureById(id).name}</p>
        ))}
      </div>
      {onSelect && (
        <button
          onClick={onSelect}
          className="mt-6 w-full border border-black dark:border-white py-2.5 text-sm font-medium hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
        >
          {ctaLabel}
        </button>
      )}
    </div>
  )
}
