const variantStyles = {
  accent:
    'bg-[var(--color-accent-soft)] text-[var(--color-accent)] border border-[var(--color-accent)]/20',
  success:
    'bg-[var(--color-success-soft)] text-[var(--color-success)] border border-[var(--color-success)]/20',
  warning:
    'bg-[var(--color-warning-soft)] text-[var(--color-warning)] border border-[var(--color-warning)]/20',
  danger:
    'bg-[var(--color-danger-soft)] text-[var(--color-danger)] border border-[var(--color-danger)]/20',
  neutral:
    'bg-[var(--color-surface-2)] text-[var(--color-muted)] border border-[var(--color-line)]',
}

const sizeStyles = {
  sm: 'px-2 py-0.5 text-[10px] font-semibold tracking-wide',
  md: 'px-2.5 py-1 text-xs font-semibold',
}

export function Badge({
  children,
  variant = 'accent',
  size = 'md',
  dot = false,
  className = '',
  ...props
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full select-none ${
        variantStyles[variant] || variantStyles.accent
      } ${sizeStyles[size] || sizeStyles.md} ${className}`}
      {...props}
    >
      {dot && (
        <span
          className={`h-1.5 w-1.5 rounded-full shrink-0 ${
            variant === 'success'
              ? 'bg-[var(--color-success)]'
              : variant === 'warning'
              ? 'bg-[var(--color-warning)]'
              : variant === 'danger'
              ? 'bg-[var(--color-danger)]'
              : 'bg-[var(--color-accent)]'
          }`}
        />
      )}
      {children}
    </span>
  )
}

export default Badge
