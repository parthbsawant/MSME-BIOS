import { forwardRef } from 'react'

const variantStyles = {
  default:
    'bg-[var(--color-surface)] border border-[var(--color-line)] shadow-xs',
  raised:
    'bg-[var(--color-surface)] border border-[var(--color-line)] shadow-[var(--shadow-cool-md)]',
  elevated:
    'bg-[var(--color-surface)] border border-[var(--color-line)] shadow-[var(--shadow-cool-lg)]',
  subtle:
    'bg-[var(--color-surface-2)] border border-[var(--color-line-subtle)]',
  accent:
    'bg-[var(--color-surface)] border border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/20 shadow-xs',
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
      className={`rounded-2xl transition-all duration-350 ease-out ${
        variantStyles[variant] || variantStyles.default
      } ${paddingStyles[padding] || paddingStyles.md} ${
        interactive
          ? 'hover:-translate-y-1 hover:shadow-[var(--shadow-cool-md)] hover:border-[var(--color-accent)]/30 cursor-pointer'
          : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  )
})

export default Card
