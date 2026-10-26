import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { useBusiness } from '../context/BusinessContext'
import { usePlan } from '../context/PlanContext'
import { previewInvite, acceptInvite } from '../lib/api'
import { nextQuery } from '../lib/nextPath'

// STEP 5: /invite/:token - the link the owner copies (SPEC.md section 6).
// Public: shows which business and role the invite is for. Signed out ->
// sign up or log in, then come back here (?next=). Signed in -> Join. The
// backend checks everything again on accept (email match, expiry,
// revoked, used); this page only explains the outcome.
export default function AcceptInvitePage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation('team')
  const { user, isLoggedIn, loading: authLoading, logout } = useAuth()
  const { refreshBusiness } = useBusiness()
  const { refreshPlan } = usePlan()

  const [invite, setInvite] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState(null)

  useEffect(() => {
    previewInvite(token)
      .then(setInvite)
      .catch((err) => setLoadError(err.status === 404 ? 'invite_invalid' : 'generic'))
  }, [token])

  const here = `/invite/${token}`
  const emailMatches = invite && user?.email && user.email.toLowerCase() === invite.email.toLowerCase()

  const join = async () => {
    setJoinError(null)
    setJoining(true)
    try {
      await acceptInvite(token)
      await Promise.all([refreshBusiness(), refreshPlan()])
      navigate('/dashboard', { replace: true })
    } catch (err) {
      console.error('Could not accept invite:', err)
      if (err.code === 'already_member') {
        navigate('/dashboard', { replace: true })
        return
      }
      setJoinError(err.code || 'generic')
    } finally {
      setJoining(false)
    }
  }

  const card = 'rounded-3xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] p-8 sm:p-10 shadow-xl'
  const primary = 'block w-full rounded-xl bg-[#E8622C] dark:bg-[#F27A4A] px-6 py-3.5 text-center text-xs font-bold text-white shadow-md shadow-[#E8622C]/20 hover:bg-[#D4531F] dark:hover:bg-[#E56938] transition-all disabled:opacity-50 cursor-pointer'
  const secondary = 'block w-full rounded-xl border border-[#F0E4D8] dark:border-[#3A332A] px-6 py-3 text-center text-xs font-bold text-[#8A7F74] dark:text-[#A89E92] hover:text-[#2A2521] dark:hover:text-[#F5EFE8] hover:border-[#E8622C] transition-colors cursor-pointer'

  let body
  if (loadError) {
    body = <p className="text-sm text-[#8A7F74] dark:text-[#A89E92]">{t(`invite.errors.${loadError}`)}</p>
  } else if (!invite || authLoading) {
    body = (
      <div className="flex justify-center py-6">
        <div className="h-8 w-8 rounded-full border-4 border-[#E8622C]/20 border-t-[#E8622C] dark:border-[#F27A4A]/20 dark:border-t-[#F27A4A] animate-spin" />
      </div>
    )
  } else if (invite.status !== 'pending') {
    body = <p className="text-sm text-[#8A7F74] dark:text-[#A89E92]">{t(`invite.status_${invite.status}`)}</p>
  } else {
    body = (
      <>
        <p className="text-sm text-[#2A2521] dark:text-[#F5EFE8]">
          {t('invite.intro', { business: invite.business_name || t('invite.aBusiness'), role: t(`roles.${invite.role}`) })}
        </p>
        <p className="mt-2 text-xs text-[#8A7F74] dark:text-[#A89E92]">{t('invite.sentTo', { email: invite.email })}</p>

        {!isLoggedIn ? (
          <div className="mt-8 space-y-3">
            <Link to={`/signup${nextQuery(here)}`} className={primary}>{t('invite.signUp')}</Link>
            <Link to={`/login${nextQuery(here)}`} className={secondary}>{t('invite.logIn')}</Link>
          </div>
        ) : !emailMatches ? (
          <div className="mt-6">
            <p className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-300">
              {t('invite.wrongAccount', { current: user?.email ?? '', invited: invite.email })}
            </p>
            <button onClick={async () => { await logout(); navigate(`/login${nextQuery(here)}`) }} className={`${secondary} mt-4`}>
              {t('invite.switchAccount')}
            </button>
          </div>
        ) : (
          <div className="mt-8">
            {joinError && (
              <p className="mb-4 rounded-xl border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-300">
                {t(`invite.errors.${joinError}`, { defaultValue: t('invite.errors.generic') })}
              </p>
            )}
            <button onClick={join} disabled={joining} className={primary}>
              {joining ? t('invite.joining') : t('invite.join', { business: invite.business_name || t('invite.aBusiness') })}
            </button>
          </div>
        )}
      </>
    )
  }

  return (
    <div className="min-h-screen bg-[#FBF3EC] dark:bg-[#1A1714] text-[#2A2521] dark:text-[#F5EFE8] transition-colors">
      <Navbar />
      <main className="mx-auto max-w-lg px-6 py-12">
        <div className={card}>
          <span className="rounded-full bg-[#E8622C]/10 dark:bg-[#F27A4A]/20 px-3 py-1 text-xs font-bold text-[#E8622C] dark:text-[#F27A4A]">
            {t('invite.badge')}
          </span>
          <h1 className="mt-3 mb-4 font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-extrabold">{t('invite.title')}</h1>
          {body}
        </div>
      </main>
    </div>
  )
}
