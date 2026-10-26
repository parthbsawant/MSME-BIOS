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
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] transition-colors">
      <Navbar />
      <main className="mx-auto max-w-lg px-6 py-16">
        <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 sm:p-10 shadow-xl text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-accent-soft)] text-[var(--color-accent)] shadow-xs">
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
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-6 py-3 text-xs font-bold text-[var(--color-text)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-all cursor-pointer shadow-xs"
          >
            <LogOut className="h-4 w-4" strokeWidth={2} />
            <span>{t('status.logout')}</span>
          </button>
        </div>
      </main>
    </div>
  )
}
