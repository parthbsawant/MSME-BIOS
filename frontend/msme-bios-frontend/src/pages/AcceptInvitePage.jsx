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

  const card =
    'rounded-3xl border border-[var(--color-line)] bg-[var(--color-surface)] p-6 sm:p-10 shadow-[var(--shadow-warm-md)]'
  const primary =
    'inline-flex items-center justify-center w-full rounded-xl bg-[var(--color-accent)] px-6 py-3.5 text-center text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-[var(--color-accent-hover)] transition-all transform active:scale-[0.98] disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]'
  const secondary =
    'inline-flex items-center justify-center w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-6 py-3 text-center text-xs sm:text-sm font-semibold text-[var(--color-ink)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]'

  let body
  if (loadError) {
    body = <p className="text-sm text-[var(--color-muted)]">{t(`invite.errors.${loadError}`)}</p>
  } else if (!invite || authLoading) {
    body = (
      <div className="flex justify-center py-8">
        <div className="h-8 w-8 rounded-full border-2 border-[var(--color-line)] border-t-[var(--color-accent)] animate-spin" />
      </div>
    )
  } else if (invite.status !== 'pending') {
    body = <p className="text-sm text-[var(--color-muted)]">{t(`invite.status_${invite.status}`)}</p>
  } else {
    body = (
      <>
        <p className="text-sm text-[var(--color-ink)] leading-relaxed">
          {t('invite.intro', { business: invite.business_name || t('invite.aBusiness'), role: t(`roles.${invite.role}`) })}
        </p>
        <p className="mt-2 text-xs text-[var(--color-muted)]">{t('invite.sentTo', { email: invite.email })}</p>

        {!isLoggedIn ? (
          <div className="mt-8 space-y-3">
            <Link to={`/signup${nextQuery(here)}`} className={primary}>{t('invite.signUp')}</Link>
            <Link to={`/login${nextQuery(here)}`} className={secondary}>{t('invite.logIn')}</Link>
          </div>
        ) : !emailMatches ? (
          <div className="mt-6">
            <p className="rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)] p-3.5 text-xs text-[var(--color-warning)] font-medium leading-relaxed">
              {t('invite.wrongAccount', { current: user?.email ?? '', invited: invite.email })}
            </p>
            <button
              type="button"
              onClick={async () => { await logout(); navigate(`/login${nextQuery(here)}`) }}
              className={`${secondary} mt-4`}
            >
              {t('invite.switchAccount')}
            </button>
          </div>
        ) : (
          <div className="mt-8">
            {joinError && (
              <p className="mb-4 rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] p-3 text-xs text-[var(--color-danger)] font-medium">
                {t(`invite.errors.${joinError}`, { defaultValue: t('invite.errors.generic') })}
              </p>
            )}
            <button type="button" onClick={join} disabled={joining} className={primary}>
              {joining ? t('invite.joining') : t('invite.join', { business: invite.business_name || t('invite.aBusiness') })}
            </button>
          </div>
        )}
      </>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] text-[var(--color-ink)] transition-colors">
      <Navbar />
      <main className="mx-auto max-w-lg px-4 sm:px-6 py-12 md:py-16">
        <div className={card}>
          <span className="inline-block rounded-full bg-[var(--color-accent-soft)] px-3 py-1 text-xs font-bold text-[var(--color-accent)]">
            {t('invite.badge')}
          </span>
          <h1 className="mt-3 mb-4 font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--color-ink)]">
            {t('invite.title')}
          </h1>
          {body}
        </div>
      </main>
    </div>
  )
}
