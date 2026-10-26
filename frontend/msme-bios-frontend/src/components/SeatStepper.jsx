import { useTranslation } from 'react-i18next'
import { EXTRA_SEAT_PRICE, MAX_EXTRA_SEATS, formatPrice } from '../lib/featuresData'

// Extra-seat chooser shared by PlanSummaryPage and CustomBuilderPage
// (SPEC.md section 4: seats are chosen BEFORE checkout). Prices shown here
// are display only - the backend computes the real amount at checkout.
export default function SeatStepper({ included, extra, onChange, disabled, compact = false }) {
  const { t } = useTranslation('billing')
  const set = (n) => onChange(Math.min(MAX_EXTRA_SEATS, Math.max(0, n)))

  const button =
    'flex h-8 w-8 items-center justify-center rounded-lg border border-[#F0E4D8] dark:border-[#3A332A] text-sm font-bold text-[#2A2521] dark:text-[#F5EFE8] hover:border-[#E8622C] hover:text-[#E8622C] dark:hover:border-[#F27A4A] dark:hover:text-[#F27A4A] transition-colors disabled:opacity-40 disabled:hover:border-[#F0E4D8] disabled:hover:text-inherit cursor-pointer disabled:cursor-not-allowed'

  return (
    <div className={compact ? '' : 'rounded-2xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FBF3EC] dark:bg-[#1A1714] p-4'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-[#2A2521] dark:text-[#F5EFE8]">{t('seats.title')}</p>
          <p className="text-[11px] text-[#8A7F74] dark:text-[#A89E92]">
            {t('seats.included', { count: included })} &middot; {t('seats.totalSeats', { count: included + extra })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-[#8A7F74] dark:text-[#A89E92]">{t('seats.extra')}</span>
          <button type="button" onClick={() => set(extra - 1)} disabled={disabled || extra <= 0} aria-label={t('seats.decrease')} className={button}>
            &minus;
          </button>
          <span className="w-6 text-center font-[family-name:var(--font-data)] text-sm font-bold text-[#2A2521] dark:text-[#F5EFE8]" aria-live="polite">
            {extra}
          </span>
          <button type="button" onClick={() => set(extra + 1)} disabled={disabled || extra >= MAX_EXTRA_SEATS} aria-label={t('seats.increase')} className={button}>
            +
          </button>
        </div>
      </div>
      {!compact && (
        <p className="mt-2 text-[11px] text-[#8A7F74] dark:text-[#A89E92]">
          {t('seats.extraHint', { price: formatPrice(EXTRA_SEAT_PRICE), max: MAX_EXTRA_SEATS })}
        </p>
      )}
    </div>
  )
}
