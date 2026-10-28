import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'

export default function FeatureFlipCard({
  name,
  tagline,
  description,
  icon,
  variant = 'default',
  decorativeSvg = null,
  className = '',
}) {
  const { t } = useTranslation()

  const isCobalt = variant === 'cobalt'
  const isDarkBlock = variant === 'dark'
  const isAmber = variant === 'amber'
  const isBlue = variant === 'blue'

  let frontBg = 'bg-[var(--color-surface)] border-[var(--color-line)] text-[var(--color-ink)]'
  let frontTagline = 'text-[var(--color-muted)]'
  let frontBadge = 'bg-[var(--color-surface-2)] text-[var(--color-muted)] border-[var(--color-line)]'
  let frontIcon = 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
  let frontCta = 'text-[var(--color-accent)]'

  let backBg = 'bg-[var(--color-surface)] border-[var(--color-accent)] text-[var(--color-ink)]'
  let backTitle = 'text-[var(--color-accent)]'
  let backBadge = 'bg-[var(--color-surface-2)] text-[var(--color-muted)] border-[var(--color-line)]'
  let backDesc = 'text-[var(--color-ink)]'
  let backFootnote = 'text-[var(--color-muted)]'

  if (isCobalt) {
    frontBg = 'bg-[var(--color-accent)] border-transparent text-white shadow-xs'
    frontTagline = 'text-white/80'
    frontBadge = 'bg-white/20 text-white border-white/20'
    frontIcon = 'bg-white/20 text-white'
    frontCta = 'text-white'

    backBg = 'bg-[var(--color-accent)] border-white/40 text-white'
    backTitle = 'text-white font-bold'
    backBadge = 'bg-white/20 text-white border-white/20'
    backDesc = 'text-white/95'
    backFootnote = 'text-white/70'
  } else if (isDarkBlock) {
    frontBg = 'bg-[var(--color-dark-block)] border-[var(--color-dark-line)] text-[var(--color-dark-text)] shadow-xs'
    frontTagline = 'text-[var(--color-dark-muted)]'
    frontBadge = 'bg-[var(--color-dark-surface)] text-[var(--color-dark-muted)] border-[var(--color-dark-line)]'
    frontIcon = 'bg-[var(--color-dark-surface)] text-[var(--color-accent)]'
    frontCta = 'text-[var(--color-accent)]'

    backBg = 'bg-[var(--color-dark-surface)] border-[var(--color-accent)] text-[var(--color-dark-text)]'
    backTitle = 'text-[var(--color-accent)] font-bold'
    backBadge = 'bg-[var(--color-dark-block)] text-[var(--color-dark-muted)] border-[var(--color-dark-line)]'
    backDesc = 'text-[var(--color-dark-text)]/90'
    backFootnote = 'text-[var(--color-dark-muted)]'
  } else if (isBlue) {
    frontBg = 'bg-[var(--color-tint-blue)] border-[var(--color-line)] text-[var(--color-ink)]'
    frontIcon = 'bg-[var(--color-surface)] text-[var(--color-accent)]'
    frontTagline = 'text-[var(--color-muted)]'
  } else if (isAmber) {
    frontBg = 'bg-[var(--color-tint-amber)] border-[var(--color-line)] text-[var(--color-ink)]'
    frontIcon = 'bg-[var(--color-surface)] text-[var(--color-highlight)]'
    frontCta = 'text-[var(--color-highlight-text)] dark:text-[var(--color-highlight)]'
  }

  return (
    <div
      tabIndex={0}
      role="region"
      aria-label={name}
      className={`bento-card bento-card-${variant} group relative rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] cursor-pointer ${className}`}
    >
      <div className="bento-card-inner relative h-full w-full min-h-[240px] rounded-2xl overflow-hidden">
        {/* Front Face */}
        <div
          className={`bento-card-face bento-card-front absolute inset-0 flex flex-col justify-between rounded-2xl border p-6 overflow-hidden ${frontBg}`}
        >
          {/* Subtle Decorative SVG element with slow smooth scale on hover */}
          {decorativeSvg && (
            <div className="pointer-events-none absolute right-4 bottom-4 opacity-35 transition-all duration-700 ease-out group-hover:opacity-75 group-hover:scale-110">
              {decorativeSvg}
            </div>
          )}

          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl shadow-xs transition-transform duration-500 ease-out group-hover:scale-105 ${frontIcon}`}>
                {icon}
              </div>
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border transition-all duration-500 ease-out group-hover:scale-105 ${frontBadge}`}
              >
                {t('flipCard.hover')}
              </span>
            </div>
            <h3 className="mt-4 font-[family-name:var(--font-display)] text-lg font-bold leading-snug">
              {name}
            </h3>
            <p className={`mt-1 text-xs leading-relaxed ${frontTagline}`}>
              {tagline}
            </p>
          </div>

          <div className={`relative z-10 flex items-center gap-1.5 text-xs font-semibold ${frontCta}`}>
            <span>{t('flipCard.view')}</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-400 ease-out group-hover:translate-x-1.5" strokeWidth={2} />
          </div>
        </div>

        {/* Back Face */}
        <div
          className={`bento-card-face bento-card-back absolute inset-0 flex flex-col justify-between rounded-2xl border-2 p-6 shadow-[var(--shadow-cool-lg)] overflow-hidden ${backBg}`}
        >
          <div>
            <div className="flex items-center justify-between">
              <h4 className={`font-[family-name:var(--font-display)] text-sm font-bold ${backTitle}`}>
                {name}
              </h4>
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${backBadge}`}
              >
                {t('flipCard.badge')}
              </span>
            </div>
            <p className={`mt-3 text-xs leading-relaxed ${backDesc}`}>
              {description}
            </p>
          </div>
          <p className={`text-[10px] font-semibold uppercase tracking-wider ${backFootnote}`}>
            {t('flipCard.badge')}
          </p>
        </div>
      </div>
    </div>
  )
}
