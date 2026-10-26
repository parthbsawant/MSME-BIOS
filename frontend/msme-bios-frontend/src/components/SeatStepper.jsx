import { useTranslation } from 'react-i18next'
import { Minus, Plus } from 'lucide-react'
import { EXTRA_SEAT_PRICE, MAX_EXTRA_SEATS, formatPrice } from '../lib/featuresData'

// Extra-seat chooser shared by PlanSummaryPage and CustomBuilderPage
// (SPEC.md section 4: seats are chosen BEFORE checkout). Prices shown here
// are display only - the backend computes the real amount at checkout.
export default function SeatStepper({ included, extra, onChange, disabled, compact = false }) {
  const { t } = useTranslation('billing')
  const set = (n) => onChange(Math.min(MAX_EXTRA_SEATS, Math.max(0, n)))

  const buttonClass =
    'flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-all active:scale-[0.95] disabled:opacity-40 disabled:hover:border-[var(--color-line)] disabled:hover:text-inherit cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]'

  return (
    <div
      className={
        compact
          ? ''
          : 'rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-2)]/60 p-4 shadow-xs'
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-[var(--color-ink)]">{t('seats.title')}</p>
          <p className="text-[11px] text-[var(--color-muted)] mt-0.5">
            {t('seats.included', { count: included })} &middot; {t('seats.totalSeats', { count: included + extra })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-[var(--color-muted)]">{t('seats.extra')}</span>
          <button
            type="button"
            onClick={() => set(extra - 1)}
            disabled={disabled || extra <= 0}
            aria-label={t('seats.decrease')}
            className={buttonClass}
          >
            <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
          <span
            data-tabular="true"
            className="w-6 text-center font-[family-name:var(--font-data)] text-sm font-bold text-[var(--color-ink)]"
            aria-live="polite"
          >
            {extra}
          </span>
          <button
            type="button"
            onClick={() => set(extra + 1)}
            disabled={disabled || extra >= MAX_EXTRA_SEATS}
            aria-label={t('seats.increase')}
            className={buttonClass}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        </div>
      </div>
      {!compact && (
        <p className="mt-2 text-[11px] text-[var(--color-muted)] leading-relaxed">
          {t('seats.extraHint', { price: formatPrice(EXTRA_SEAT_PRICE), max: MAX_EXTRA_SEATS })}
        </p>
      )}
    </div>
  )
}
