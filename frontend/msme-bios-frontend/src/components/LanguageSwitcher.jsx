import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Globe } from 'lucide-react'
import { SUPPORTED_LANGUAGES } from '../lib/i18n'
import { scaleIn } from '../lib/motion'

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)

  const current = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language) || SUPPORTED_LANGUAGES[0]

  const handleSelect = (code) => {
    i18n.changeLanguage(code)
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t('language.change')}
        className="flex h-8 items-center gap-1.5 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-2.5 text-xs font-medium text-[var(--color-ink)] shadow-xs hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
      >
        <Globe className="h-3.5 w-3.5 text-[var(--color-muted)]" strokeWidth={1.75} />
        <span className="font-medium">{current.label}</span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Click-away backdrop */}
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              variants={scaleIn}
              initial="initial"
              animate="animate"
              exit="exit"
              className="absolute right-0 top-full mt-2 w-36 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-1 shadow-[var(--shadow-warm-lg)] z-50 overflow-hidden"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => handleSelect(lang.code)}
                  className={`flex w-full items-center rounded-lg px-3 py-1.5 text-left text-xs font-medium transition-colors cursor-pointer ${
                    lang.code === current.code
                      ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)] font-semibold'
                      : 'text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
