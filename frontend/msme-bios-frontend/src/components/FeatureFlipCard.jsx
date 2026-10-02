export default function FeatureFlipCard({ name, tagline, description, icon }) {
  return (
    <div className="card-flip h-52">
      <div className="card-flip-inner relative h-full w-full">
        {/* Front Face */}
        <div className="card-flip-face absolute inset-0 flex flex-col justify-between rounded-2xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] p-6 shadow-sm">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8622C]/10 dark:bg-[#F27A4A]/20 text-[#E8622C] dark:text-[#F27A4A]">
                {icon || (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M7 7h10M7 12h10M7 17h6" />
                  </svg>
                )}
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8A7F74] dark:text-[#A89E92] bg-[#FBF3EC] dark:bg-[#1A1714] px-2 py-0.5 rounded-full border border-[#F0E4D8] dark:border-[#3A332A]">
                Hover to flip
              </span>
            </div>
            <h4 className="mt-4 font-[family-name:var(--font-display)] text-lg font-bold text-[#2A2521] dark:text-[#F5EFE8]">{name}</h4>
            <p className="mt-1 text-xs text-[#8A7F74] dark:text-[#A89E92]">{tagline}</p>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-semibold text-[#E8622C] dark:text-[#F27A4A]">
            <span>View capabilities</span>
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </div>
        </div>

        {/* Back Face */}
        <div className="card-flip-face card-flip-back absolute inset-0 flex flex-col justify-between rounded-2xl border border-[#E8622C] dark:border-[#F27A4A] bg-[#2A2521] dark:bg-[#242019] p-6 text-white shadow-md">
          <div>
            <h4 className="font-[family-name:var(--font-display)] text-sm font-bold text-[#F27A4A]">{name}</h4>
            <p className="mt-3 text-xs leading-relaxed text-[#F5EFE8]/90">{description}</p>
          </div>
          <p className="text-[10px] font-semibold text-[#A89E92] uppercase tracking-wider">MSME-BIOS Feature</p>
        </div>
      </div>
    </div>
  )
}
