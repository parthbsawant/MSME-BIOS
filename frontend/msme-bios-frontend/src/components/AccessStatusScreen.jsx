import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
    <div className="min-h-screen bg-[#FBF3EC] dark:bg-[#1A1714] text-[#2A2521] dark:text-[#F5EFE8] transition-colors">
      <Navbar />
      <main className="mx-auto max-w-lg px-6 py-16">
        <div className="rounded-3xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] p-8 sm:p-10 shadow-xl text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#E8622C]/10 dark:bg-[#F27A4A]/20 text-[#E8622C] dark:text-[#F27A4A]">
            {kind === 'deactivated' ? (
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            ) : (
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16v16H4z"/><polyline points="22 6 12 13 2 6"/></svg>
            )}
          </div>
          <h1 className="mt-4 font-[family-name:var(--font-display)] text-2xl font-extrabold">{t(`status.${kind}.title`)}</h1>
          <p className="mt-2 text-sm text-[#8A7F74] dark:text-[#A89E92]">{t(`status.${kind}.text`, { email: user?.email ?? '' })}</p>
          <button
            onClick={handleLogout}
            className="mt-8 w-full rounded-xl border border-[#F0E4D8] dark:border-[#3A332A] px-6 py-3 text-xs font-bold text-[#8A7F74] dark:text-[#A89E92] hover:text-[#2A2521] dark:hover:text-[#F5EFE8] hover:border-[#E8622C] transition-colors cursor-pointer"
          >
            {t('status.logout')}
          </button>
        </div>
      </main>
    </div>
  )
}
