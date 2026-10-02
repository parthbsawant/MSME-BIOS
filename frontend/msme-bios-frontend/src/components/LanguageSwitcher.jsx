import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES } from '../lib/i18n'

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)

  const current = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language) || SUPPORTED_LANGUAGES[0]

  const handleSelect = (code) => {
    i18n.changeLanguage(code)
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Change language"
        className="flex h-9 items-center gap-1.5 rounded-xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] px-3 text-xs font-medium text-[#2A2521] dark:text-[#F5EFE8] shadow-sm hover:border-[#E8622C]/40 dark:hover:border-[#F27A4A]/40 transition-all cursor-pointer shrink-0"
      >
        <svg className="h-3.5 w-3.5 text-[#8A7F74] dark:text-[#A89E92]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z" />
        </svg>
        <span>{current.label}</span>
      </button>

      {open && (
        <>
          {/* Click-away layer, same pattern as the existing Navbar menus */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-36 rounded-xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] p-1.5 shadow-xl z-50">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleSelect(lang.code)}
                className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors cursor-pointer ${
                  lang.code === current.code
                    ? 'bg-[#E8622C]/10 dark:bg-[#F27A4A]/15 text-[#E8622C] dark:text-[#F27A4A]'
                    : 'text-[#2A2521] dark:text-[#F5EFE8] hover:bg-[#FBF3EC] dark:hover:bg-[#2D2820]'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
