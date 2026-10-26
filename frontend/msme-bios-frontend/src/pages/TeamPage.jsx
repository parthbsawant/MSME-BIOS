import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import DashboardLayout from '../components/DashboardLayout'
import {
  getTeam, listInvites, getTeamActivity, createInvite, revokeInvite,
  changeMemberRole, deactivateMember, reactivateMember,
} from '../lib/api'

const MEMBER_ROLES = ['finance', 'sales', 'hr', 'marketing']

// STEP 5: the owner's team page (SPEC.md sections 6 and 10). Invite by
// link (copy it - real invite emails come later), revoke pending invites,
// change a member's role, deactivate or reactivate. /team?setup=1 is the
// "set up your team" step right after payment, with a skip option.
// Every action is enforced by the backend (owner only, seat limit).
export default function TeamPage() {
  const { t, i18n } = useTranslation('team')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const setupMode = searchParams.get('setup') === '1'

  const [members, setMembers] = useState([])
  const [seats, setSeats] = useState(null)
  const [invites, setInvites] = useState([])
  const [activity, setActivity] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(null)

  const [email, setEmail] = useState('')
  const [role, setRole] = useState('finance')
  const [sending, setSending] = useState(false)
  const [newLink, setNewLink] = useState(null)
  const [copied, setCopied] = useState(false)
  const [busyId, setBusyId] = useState(null)

  const reload = async () => {
    const [team, invitesList, entries] = await Promise.all([getTeam(), listInvites(), getTeamActivity()])
    setMembers(team.members)
    setSeats(team.seats)
    setInvites(invitesList)
    setActivity(entries)
    setLoaded(true)
  }

  useEffect(() => {
    reload().catch((err) => {
      console.error('Could not load team:', err)
      setError(err.code || 'generic')
      setLoaded(true)
    })
  }, [])

  // Runs a team action, then reloads; any backend refusal is shown.
  const act = async (id, fn) => {
    setError(null)
    setBusyId(id)
    try {
      await fn()
      await reload()
    } catch (err) {
      console.error('Team action failed:', err)
      setError(err.code || 'generic')
    } finally {
      setBusyId(null)
    }
  }

  const sendInvite = async (e) => {
    e.preventDefault()
    setError(null)
    setNewLink(null)
    setCopied(false)
    setSending(true)
    try {
      const invite = await createInvite(email.trim(), role)
      setNewLink({ url: `${window.location.origin}${invite.invite_path}`, email: invite.email, role: invite.role })
      setEmail('')
      await reload()
    } catch (err) {
      console.error('Invite failed:', err)
      setError(err.code || 'generic')
    } finally {
      setSending(false)
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(newLink.url)
      setCopied(true)
    } catch {
      setCopied(false) // the link stays visible to copy by hand
    }
  }

  const locale = i18n.language === 'en' ? 'en-IN' : `${i18n.language}-IN`
  const date = (iso) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
  const emailFor = (userId) => members.find((m) => m.user_id === userId)?.email ?? userId
  const seatsFull = seats && seats.in_use >= seats.purchased

  const card = 'rounded-3xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] p-6 shadow-sm'
  const input = 'w-full rounded-xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FBF3EC] dark:bg-[#1A1714] px-4 py-2.5 text-xs text-[#2A2521] dark:text-[#F5EFE8] focus:border-[#E8622C] dark:focus:border-[#F27A4A] focus:outline-none'
  const smallButton = 'rounded-lg border border-[#F0E4D8] dark:border-[#3A332A] px-3 py-1.5 text-[11px] font-bold text-[#8A7F74] dark:text-[#A89E92] hover:border-[#E8622C] hover:text-[#E8622C] dark:hover:text-[#F27A4A] transition-colors disabled:opacity-40 cursor-pointer'
  const chip = (tone) => `inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${{
    green: 'bg-[#E8F5EC] dark:bg-[#132E21] text-[#1F9254] dark:text-[#34D399] border-emerald-300 dark:border-emerald-700',
    amber: 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700',
    grey: 'bg-[#FBF3EC] dark:bg-[#1A1714] text-[#8A7F74] dark:text-[#A89E92] border-[#F0E4D8] dark:border-[#3A332A]',
  }[tone]}`
  const inviteTone = { pending: 'amber', accepted: 'green', revoked: 'grey', expired: 'grey' }

  return (
    <DashboardLayout activeItem="Team">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-extrabold text-[#2A2521] dark:text-[#F5EFE8]">
              {setupMode ? t('page.setupTitle') : t('page.title')}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[#8A7F74] dark:text-[#A89E92]">{setupMode ? t('page.setupSubtitle') : t('page.subtitle')}</p>
          </div>
          {setupMode && (
            <button onClick={() => navigate('/dashboard')} className="self-start sm:self-auto rounded-xl border border-[#F0E4D8] dark:border-[#3A332A] px-5 py-2.5 text-xs font-bold text-[#8A7F74] dark:text-[#A89E92] hover:border-[#E8622C] hover:text-[#2A2521] dark:hover:text-[#F5EFE8] transition-colors cursor-pointer">
              {members.length > 1 || invites.some((i) => i.status === 'pending') ? t('page.done') : t('page.skip')}
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/40 p-4 text-xs text-red-700 dark:text-red-300">
            {t(`errors.${error}`, { defaultValue: t('errors.generic') })}
          </div>
        )}

        {!loaded ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 rounded-full border-4 border-[#E8622C]/20 border-t-[#E8622C] dark:border-[#F27A4A]/20 dark:border-t-[#F27A4A] animate-spin" />
          </div>
        ) : (
          <>
            {/* Seats + invite form */}
            <div className={card}>
              {seats && (
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-sm font-bold text-[#2A2521] dark:text-[#F5EFE8]">{t('seats.title')}</h2>
                  <p className="text-xs text-[#8A7F74] dark:text-[#A89E92]">
                    {t('seats.used', { used: seats.in_use, total: seats.purchased, members: seats.active_members, pending: seats.pending_invites })}
                  </p>
                </div>
              )}
              {seats && (
                <div className="mt-3 h-2 rounded-full bg-[#FBF3EC] dark:bg-[#1A1714] overflow-hidden">
                  <div className="h-full rounded-full bg-[#E8622C] dark:bg-[#F27A4A]" style={{ width: `${Math.min(100, (seats.in_use / Math.max(1, seats.purchased)) * 100)}%` }} />
                </div>
              )}

              <form onSubmit={sendInvite} className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                <label className="sr-only" htmlFor="invite-email">{t('invite.emailLabel')}</label>
                <input id="invite-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                       placeholder={t('invite.emailPlaceholder')} disabled={sending || seatsFull} className={input} />
                <label className="sr-only" htmlFor="invite-role">{t('invite.roleLabel')}</label>
                <select id="invite-role" value={role} onChange={(e) => setRole(e.target.value)} disabled={sending || seatsFull} className={input}>
                  {MEMBER_ROLES.map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}
                </select>
                <button type="submit" disabled={sending || seatsFull || !email.trim()}
                        className="rounded-xl bg-[#E8622C] dark:bg-[#F27A4A] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#D4531F] dark:hover:bg-[#E56938] transition-colors disabled:opacity-50 cursor-pointer">
                  {sending ? t('invite.sending') : t('invite.send')}
                </button>
              </form>
              <p className="mt-2 text-[11px] text-[#8A7F74] dark:text-[#A89E92]">
                {seatsFull ? t('seats.full') : t(`roles.hint.${role}`)}
              </p>

              {newLink && (
                <div className="mt-5 rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-[#E8F5EC] dark:bg-[#132E21] p-4">
                  <p className="text-xs font-bold text-[#1F9254] dark:text-[#34D399]">
                    {t('invite.created', { email: newLink.email, role: t(`roles.${newLink.role}`) })}
                  </p>
                  <div className="mt-3 flex flex-col sm:flex-row gap-2">
                    <input readOnly value={newLink.url} onFocus={(e) => e.target.select()} className={`${input} font-[family-name:var(--font-data)]`} aria-label={t('invite.linkLabel')} />
                    <button type="button" onClick={copyLink} className="shrink-0 rounded-xl bg-[#1F9254] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#187a46] transition-colors cursor-pointer">
                      {copied ? t('invite.copied') : t('invite.copy')}
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-[#1F9254]/80 dark:text-[#34D399]/80">{t('invite.copyNote')}</p>
                </div>
              )}
            </div>

            {/* Members */}
            <div className={card}>
              <h2 className="text-sm font-bold text-[#2A2521] dark:text-[#F5EFE8]">{t('members.title', { count: members.length })}</h2>
              <ul className="mt-4 divide-y divide-[#F0E4D8] dark:divide-[#3A332A]">
                {members.map((m) => (
                  <li key={m.user_id} className="flex flex-col sm:flex-row sm:items-center gap-3 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-xs font-bold text-[#2A2521] dark:text-[#F5EFE8]">{m.display_name || m.email}</p>
                      <p className="truncate text-[11px] text-[#8A7F74] dark:text-[#A89E92]">{m.email} &middot; {t('members.joined', { date: date(m.joined_at) })}</p>
                    </div>
                    {m.role === 'owner' ? (
                      <span className={chip('green')}>{t('roles.owner')}</span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="sr-only" htmlFor={`role-${m.user_id}`}>{t('members.changeRole')}</label>
                        <select id={`role-${m.user_id}`} value={m.role} disabled={busyId === m.user_id}
                                onChange={(e) => act(m.user_id, () => changeMemberRole(m.user_id, e.target.value))}
                                className="rounded-lg border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FBF3EC] dark:bg-[#1A1714] px-2 py-1.5 text-[11px] text-[#2A2521] dark:text-[#F5EFE8]">
                          {MEMBER_ROLES.map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}
                        </select>
                        <span className={chip(m.status === 'active' ? 'green' : 'grey')}>{t(`members.status_${m.status}`)}</span>
                        <button disabled={busyId === m.user_id} className={smallButton}
                                onClick={() => act(m.user_id, () => (m.status === 'active' ? deactivateMember(m.user_id) : reactivateMember(m.user_id)))}>
                          {m.status === 'active' ? t('members.deactivate') : t('members.reactivate')}
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Invites */}
            <div className={card}>
              <h2 className="text-sm font-bold text-[#2A2521] dark:text-[#F5EFE8]">{t('invites.title')}</h2>
              {invites.length === 0 ? (
                <p className="mt-3 text-xs text-[#8A7F74] dark:text-[#A89E92]">{t('invites.none')}</p>
              ) : (
                <ul className="mt-4 divide-y divide-[#F0E4D8] dark:divide-[#3A332A]">
                  {invites.map((i) => (
                    <li key={i.invite_id} className="flex flex-col sm:flex-row sm:items-center gap-3 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-xs font-bold text-[#2A2521] dark:text-[#F5EFE8]">{i.email}</p>
                        <p className="text-[11px] text-[#8A7F74] dark:text-[#A89E92]">
                          {t(`roles.${i.role}`)} &middot; {i.status === 'pending' ? t('invites.expires', { date: date(i.expires_at) }) : t('invites.sent', { date: date(i.created_at) })}
                        </p>
                      </div>
                      <span className={chip(inviteTone[i.status])}>{t(`invites.status_${i.status}`)}</span>
                      {i.status === 'pending' && (
                        <button disabled={busyId === i.invite_id} className={smallButton} onClick={() => act(i.invite_id, () => revokeInvite(i.invite_id))}>
                          {t('invites.revoke')}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Recent activity (audit log) */}
            <div className={card}>
              <h2 className="text-sm font-bold text-[#2A2521] dark:text-[#F5EFE8]">{t('activity.title')}</h2>
              {activity.length === 0 ? (
                <p className="mt-3 text-xs text-[#8A7F74] dark:text-[#A89E92]">{t('activity.none')}</p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {activity.slice(0, 20).map((a, n) => (
                    <li key={`${a.at}-${n}`} className="flex flex-col sm:flex-row sm:justify-between gap-1 text-[11px]">
                      <span className="text-[#2A2521] dark:text-[#F5EFE8]">
                        {t(`activity.${a.action}`, {
                          actor: a.actor_email ?? t('activity.someone'),
                          target: a.action.startsWith('member.') && a.action !== 'member.joined' ? emailFor(a.target) : a.target,
                          role: a.details?.role ? t(`roles.${a.details.role}`) : '',
                          from: a.details?.from ? t(`roles.${a.details.from}`) : '',
                          to: a.details?.to ? t(`roles.${a.details.to}`) : '',
                          defaultValue: a.action,
                        })}
                      </span>
                      <span className="text-[#8A7F74] dark:text-[#A89E92] shrink-0">{new Date(a.at).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
