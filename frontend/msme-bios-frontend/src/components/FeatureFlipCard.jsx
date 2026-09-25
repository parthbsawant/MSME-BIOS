export default function FeatureFlipCard({ name, tagline, description }) {
  return (
    <div className="card-flip h-48">
      <div className="card-flip-inner relative h-full w-full">
        <div className="card-flip-face absolute inset-0 flex flex-col justify-between border border-black/15 dark:border-white/15 p-6">
          <div>
            <p className="font-medium text-lg">{name}</p>
            <p className="mt-2 text-sm text-black/50 dark:text-white/50">{tagline}</p>
          </div>
          <p className="font-[family-name:var(--font-data)] text-[10px] text-black/30 dark:text-white/30">Hover for details</p>
        </div>
        <div className="card-flip-face card-flip-back absolute inset-0 flex items-center border border-black bg-black p-6 text-white dark:border-white dark:bg-white dark:text-black">
          <p className="text-sm leading-relaxed">{description}</p>
        </div>
      </div>
    </div>
  )
}
