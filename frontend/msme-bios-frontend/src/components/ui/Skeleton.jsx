export function Skeleton({
  className = '',
  variant = 'rectangular',
  ...props
}) {
  const shape =
    variant === 'circular'
      ? 'rounded-full'
      : variant === 'text'
      ? 'rounded h-4 w-full'
      : 'rounded-xl'

  return (
    <div
      className={`animate-pulse bg-[var(--color-surface-2)] dark:bg-[var(--color-surface)] ${shape} ${className}`}
      {...props}
    />
  )
}

export default Skeleton
