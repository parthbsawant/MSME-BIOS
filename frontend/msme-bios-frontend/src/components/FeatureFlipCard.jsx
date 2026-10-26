import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'

export default function FeatureFlipCard({ name, tagline, description, icon }) {
  const { t } = useTranslation()

  return (
    <div
      tabIndex={0}
      role="region"
      aria-label={name}
      className="card-flip h-56 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
    >
      <div className="card-flip-inner relative h-full w-full">
        {/* Front Face */}
        <div className="card-flip-face absolute inset-0 flex flex-col justify-between rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-6 shadow-xs hover:border-[var(--color-accent)]/40 hover:shadow-[var(--shadow-warm-md)] transition-all">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-accent)] shadow-xs">
                {icon}
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)] bg-[var(--color-surface-2)] px-2.5 py-1 rounded-full border border-[var(--color-line)]">
                {t('flipCard.hover')}
              </span>
            </div>
            <h3 className="mt-4 font-[family-name:var(--font-display)] text-lg font-bold text-[var(--color-ink)]">
              {name}
            </h3>
            <p className="mt-1 text-xs text-[var(--color-muted)] leading-relaxed">
              {tagline}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-accent)]">
            <span>{t('flipCard.view')}</span>
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
          </div>
        </div>

        {/* Back Face */}
        <div className="card-flip-face card-flip-back absolute inset-0 flex flex-col justify-between rounded-2xl border-2 border-[var(--color-accent)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-warm-lg)]">
          <div>
            <div className="flex items-center justify-between">
              <h4 className="font-[family-name:var(--font-display)] text-sm font-bold text-[var(--color-accent)]">
                {name}
              </h4>
              <span className="text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-wider bg-[var(--color-surface-2)] px-2.5 py-0.5 rounded-full border border-[var(--color-line)]">
                {t('flipCard.badge')}
              </span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-[var(--color-ink)]">
              {description}
            </p>
          </div>
          <p className="text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-wider">
            {t('flipCard.badge')}
          </p>
        </div>
      </div>
    </div>
  )
}
