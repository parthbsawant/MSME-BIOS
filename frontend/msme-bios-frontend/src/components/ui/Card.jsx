import { forwardRef } from 'react'

const variantStyles = {
  default:
    'bg-[var(--color-surface)] border border-[var(--color-line)] shadow-xs',
  raised:
    'bg-[var(--color-surface)] border border-[var(--color-line)] shadow-[var(--shadow-warm-md)]',
  elevated:
    'bg-[var(--color-surface)] border border-[var(--color-line)] shadow-[var(--shadow-warm-lg)]',
  subtle:
    'bg-[var(--color-surface-2)] border border-[var(--color-line-subtle)]',
  accent:
    'bg-[var(--color-surface)] border border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/20 shadow-sm',
  dashed:
    'bg-[var(--color-surface)] border-2 border-dashed border-[var(--color-line)] hover:border-[var(--color-accent)]/50',
}

const paddingStyles = {
  none: '',
  sm: 'p-3 sm:p-4',
  md: 'p-5 sm:p-6',
  lg: 'p-6 sm:p-8',
}

export const Card = forwardRef(function Card(
  {
    children,
    variant = 'default',
    padding = 'md',
    interactive = false,
    className = '',
    ...props
  },
  ref,
) {
  return (
    <div
      ref={ref}
      className={`rounded-2xl transition-all duration-200 ${
        variantStyles[variant] || variantStyles.default
      } ${paddingStyles[padding] || paddingStyles.md} ${
        interactive
          ? 'hover:-translate-y-0.5 hover:shadow-[var(--shadow-warm-md)] hover:border-[var(--color-accent)]/30 cursor-pointer'
          : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  )
})

export default Card
