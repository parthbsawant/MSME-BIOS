import { forwardRef } from 'react'

export const Input = forwardRef(function Input(
  {
    className = '',
    error = false,
    disabled = false,
    icon,
    iconRight,
    type = 'text',
    ...props
  },
  ref,
) {
  return (
    <div className="relative w-full">
      {icon && (
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[var(--color-muted)]">
          {icon}
        </div>
      )}
      <input
        ref={ref}
        type={type}
        disabled={disabled}
        className={`w-full rounded-xl border bg-[var(--color-surface-2)] dark:bg-[var(--color-canvas)] px-3.5 py-2.5 text-xs sm:text-sm text-[var(--color-ink)] placeholder-[var(--color-muted)]/60 transition-colors duration-150 focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${
          icon ? 'pl-10' : ''
        } ${iconRight ? 'pr-10' : ''} ${
          error
            ? 'border-[var(--color-danger)] focus:border-[var(--color-danger)] focus:ring-[var(--color-danger)]/20'
            : 'border-[var(--color-line)] focus:border-[var(--color-accent)] focus:ring-[var(--color-accent)]/20 hover:border-[var(--color-line)]'
        } ${className}`}
        {...props}
      />
      {iconRight && (
        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
          {iconRight}
        </div>
      )}
    </div>
  )
})

export default Input
