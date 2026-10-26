import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

export default function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme()
  const { t } = useTranslation()

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? t('theme.toLight') : t('theme.toDark')}
      className="group relative flex h-8 w-14 items-center rounded-full border border-[var(--color-line)] bg-[var(--color-surface-2)] p-0.5 shadow-xs transition-colors hover:border-[var(--color-accent)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] shrink-0 cursor-pointer"
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        className={`flex h-6.5 w-6.5 items-center justify-center rounded-full bg-[var(--color-accent)] text-white shadow-xs ${
          isDark ? 'translate-x-6' : 'translate-x-0'
        }`}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isDark ? (
            <motion.div
              key="moon"
              initial={{ opacity: 0, rotate: -45, scale: 0.7 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: 45, scale: 0.7 }}
              transition={{ duration: 0.15 }}
              className="flex items-center justify-center"
            >
              <Moon className="h-3.5 w-3.5" strokeWidth={2} />
            </motion.div>
          ) : (
            <motion.div
              key="sun"
              initial={{ opacity: 0, rotate: 45, scale: 0.7 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: -45, scale: 0.7 }}
              transition={{ duration: 0.15 }}
              className="flex items-center justify-center"
            >
              <Sun className="h-3.5 w-3.5" strokeWidth={2} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.span>
    </button>
  )
}
