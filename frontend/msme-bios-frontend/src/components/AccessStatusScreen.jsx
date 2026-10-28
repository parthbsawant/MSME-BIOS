import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Lock, Mail, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Navbar from './Navbar'

// STEP 5: shown instead of the app when the signed-in user cannot use it
// yet or any more. kind = 'deactivated' (the owner turned their access
// off) or 'invitePending' (they were invited but have not opened their
// invite link yet, so they have no business of their own).
export default function AccessStatusScreen({ kind }) {
  const { t } = useTranslation('team')
  const { logout, user } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] text-[var(--color-text)] transition-colors selection:bg-[var(--color-accent)] selection:text-white">
      <Navbar />
      <main className="mx-auto max-w-lg px-6 py-16">
        <div className="rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-8 sm:p-10 shadow-[var(--shadow-cool-lg)] text-center relative overflow-hidden">
          {/* Calm geometric SVG background accent */}
          <div className="absolute top-0 right-0 -mr-6 -mt-6 w-32 h-32 opacity-10 pointer-events-none">
            <svg viewBox="0 0 100 100" fill="none" className="w-full h-full text-[var(--color-accent)]">
              <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="2" strokeDasharray="6 6" />
              <rect x="25" y="25" width="50" height="50" rx="10" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>

          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-surface-2)] dark:bg-[#1C222B] text-[var(--color-accent)] shadow-xs border border-[var(--color-line)] dark:border-[#272F3A]">
            {kind === 'deactivated' ? (
              <Lock className="h-7 w-7" strokeWidth={2} />
            ) : (
              <Mail className="h-7 w-7" strokeWidth={2} />
            )}
          </div>
          <h1 className="mt-5 font-[family-name:var(--font-display)] text-2xl font-extrabold text-[var(--color-text)] tracking-tight">
            {t(`status.${kind}.title`)}
          </h1>
          <p className="mt-2 text-sm text-[var(--color-muted)] leading-relaxed">
            {t(`status.${kind}.text`, { email: user?.email ?? '' })}
          </p>
          <button
            onClick={handleLogout}
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-line)] dark:border-[#272F3A] bg-[var(--color-surface-2)] dark:bg-[#1C222B] px-6 py-3 text-xs font-bold text-[var(--color-text)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-all duration-350 ease-out cursor-pointer shadow-xs"
          >
            <LogOut className="h-4 w-4" strokeWidth={2} />
            <span>{t('status.logout')}</span>
          </button>
        </div>
      </main>
    </div>
  )
}
