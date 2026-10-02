import { formatPrice, featureById } from '../lib/featuresData'

export default function PricingTierCard({ tier, onSelect, ctaLabel = 'Choose plan', isPopular = false }) {
  const popular = isPopular || tier.id === 'growth'

  return (
    <div className={`relative flex flex-col justify-between rounded-2xl border bg-[#FFFFFF] dark:bg-[#242019] p-6 shadow-sm transition-all hover:shadow-lg ${
      popular 
        ? 'border-[#E8622C] dark:border-[#F27A4A] ring-2 ring-[#E8622C]/20 dark:ring-[#F27A4A]/20' 
        : 'border-[#F0E4D8] dark:border-[#3A332A]'
    }`}>
      {popular && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-[#E8622C] dark:bg-[#F27A4A] px-3 py-0.5 text-[10px] font-bold tracking-wide uppercase text-white shadow-sm">
          Most Popular
        </div>
      )}

      <div>
        <div className="flex items-baseline justify-between">
          <h3 className="font-[family-name:var(--font-display)] text-xl font-bold text-[#2A2521] dark:text-[#F5EFE8]">{tier.name}</h3>
        </div>
        <p className="mt-1 text-xs text-[#8A7F74] dark:text-[#A89E92]">{tier.band}</p>

        <div className="mt-6 flex items-baseline gap-1">
          <span className="font-[family-name:var(--font-display)] text-3xl font-extrabold text-[#2A2521] dark:text-[#F5EFE8]">
            {formatPrice(tier.price)}
          </span>
          <span className="text-xs text-[#8A7F74] dark:text-[#A89E92]">/month</span>
        </div>

        <div className="mt-6 space-y-2.5 border-t border-[#F0E4D8] dark:border-[#3A332A] pt-6">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#8A7F74] dark:text-[#A89E92]">Features Included</p>
          {tier.featureIds.map((id) => {
            const feat = featureById(id)
            return (
              <div key={id} className="flex items-start gap-2 text-xs text-[#2A2521] dark:text-[#F5EFE8]">
                <svg className="h-4 w-4 shrink-0 text-[#1F9254] dark:text-[#34D399] mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{feat?.name}</span>
              </div>
            )
          })}
        </div>
      </div>

      {onSelect && (
        <button
          onClick={onSelect}
          className={`mt-8 w-full rounded-xl py-3 text-xs font-bold transition-all shadow-sm transform active:scale-95 cursor-pointer ${
            popular
              ? 'bg-[#E8622C] dark:bg-[#F27A4A] text-white hover:bg-[#D4531F] dark:hover:bg-[#E56938] shadow-[#E8622C]/20'
              : 'border border-[#E8622C] dark:border-[#F27A4A] text-[#E8622C] dark:text-[#F27A4A] hover:bg-[#E8622C] hover:text-white dark:hover:bg-[#F27A4A] dark:hover:text-[#1A1714]'
          }`}
        >
          {ctaLabel}
        </button>
      )}
    </div>
  )
}
