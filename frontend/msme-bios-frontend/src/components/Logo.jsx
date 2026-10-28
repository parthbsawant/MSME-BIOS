export default function Logo({
  size = 36,
  showName = false,
  className = '',
  nameClassName = '',
}) {
  const nameSize = Math.round(size * 0.62)

  return (
    <span className={`inline-flex items-center gap-2.5 shrink-0 select-none ${className}`}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 512 512"
        width={size}
        height={size}
        role="img"
        aria-label="MSME-BIOS"
        className="shrink-0 block"
      >
        <rect x="16" y="16" width="480" height="480" rx="124" fill="var(--logo-square)" />
        <path
          d="M160 124H352M160 204H352M192 124H256A80 80 0 0 1 256 284H192L336 404"
          fill="none"
          stroke="var(--logo-glyph)"
          strokeWidth="40"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="424" cy="100" r="30" fill="var(--logo-dot)" />
      </svg>
      {showName && (
        <span
          className={`items-baseline font-[family-name:var(--font-display)] tracking-tight text-current leading-none ${nameClassName || 'inline-flex'}`}
          style={{ fontSize: `${nameSize}px` }}
        >
          <span className="font-extrabold">MSME</span>
          <span className="font-medium">-BIOS</span>
        </span>
      )}
    </span>
  )
}
