import { Card } from './Card'

export function Stat({
  label,
  value,
  subtitle,
  icon,
  trend,
  trendLabel,
  className = '',
}) {
  return (
    <Card variant="default" padding="md" className={`flex flex-col justify-between ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          {label}
        </span>
        {icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-accent)] shrink-0">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-4">
        <div
          data-tabular="true"
          className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--color-ink)]"
        >
          {value}
        </div>

        {(subtitle || trend) && (
          <div className="mt-1 flex items-center gap-2 text-xs text-[var(--color-muted)]">
            {trend && (
              <span
                className={`inline-flex items-center font-semibold ${
                  trend === 'up'
                    ? 'text-[var(--color-success)]'
                    : trend === 'down'
                    ? 'text-[var(--color-danger)]'
                    : 'text-[var(--color-muted)]'
                }`}
              >
                {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '•'} {trendLabel}
              </span>
            )}
            {subtitle && <span>{subtitle}</span>}
          </div>
        )}
      </div>
    </Card>
  )
}

export default Stat
