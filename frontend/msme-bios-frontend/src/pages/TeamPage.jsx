import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  UserPlus,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  Clock,
} from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout'
import {
  getTeam,
  listInvites,
  getTeamActivity,
  createInvite,
  revokeInvite,
  changeMemberRole,
  deactivateMember,
  reactivateMember,
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

  const card = 'rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-6 sm:p-7 shadow-xs hover:shadow-[var(--shadow-cool-md)] transition-all duration-350 ease-out'
  const input =
    'w-full rounded-xl border border-[var(--color-line)] dark:border-[#272F3A] bg-[var(--color-surface-2)] dark:bg-[#1C222B] px-4 py-2.5 text-xs text-[var(--color-text)] placeholder-[var(--color-muted)]/60 focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent focus:outline-none transition-all duration-300'
  const smallButton =
    'rounded-xl border border-[var(--color-line)] dark:border-[#272F3A] px-3 py-1.5 text-[11px] font-bold text-[var(--color-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors duration-300 disabled:opacity-40 cursor-pointer'

  const chip = (tone) =>
    `inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
      {
        green: 'bg-[#E3F6EC] text-[#12A06B] border-[#C2EDD5] dark:bg-[#12302A] dark:text-[#34D399] dark:border-[#1E4A3F]',
        amber: 'bg-[#FFF1E0] text-[#FF8A1F] border-[#FDE1C3] dark:bg-[#3A2A18] dark:text-[#FFA040] dark:border-[#523A20]',
        grey: 'bg-[var(--color-surface-2)] text-[var(--color-muted)] border-[var(--color-line)] dark:bg-[#1C222B] dark:border-[#272F3A]',
      }[tone] || 'bg-[var(--color-surface-2)] text-[var(--color-muted)] border-[var(--color-line)]'
    }`

  const deptChip = (roleKey) => {
    const map = {
      finance: 'bg-[#E3F6EC] text-[#12A06B] border-[#C2EDD5] dark:bg-[#12302A] dark:text-[#34D399] dark:border-[#1E4A3F]',
      sales: 'bg-[#E4ECFF] text-[#2F5BFF] border-[#C8D6F2] dark:bg-[#16213A] dark:text-[#6C8CFF] dark:border-[#223152]',
      hr: 'bg-[#F2EEFF] text-[#8A5CD6] border-[#DDD5F5] dark:bg-[#281C3F] dark:text-[#B292F0] dark:border-[#432E6B]',
      marketing: 'bg-[#FDE7EA] text-[#E0457B] border-[#FBD0D6] dark:bg-[#3A1C24] dark:text-[#F4729F] dark:border-[#52222E]',
      owner: 'bg-[#E4ECFF] text-[#2F5BFF] border-[#C8D6F2] dark:bg-[#16213A] dark:text-[#6C8CFF] dark:border-[#223152]',
    }
    return `inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${map[roleKey] || 'bg-[var(--color-surface-2)] text-[var(--color-muted)] border-[var(--color-line)]'}`
  }

  const inviteTone = { pending: 'amber', accepted: 'green', revoked: 'grey', expired: 'grey' }

  return (
    <DashboardLayout activeItem="Team">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-extrabold text-[var(--color-text)] tracking-tight">
              {setupMode ? t('page.setupTitle') : t('page.title')}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[var(--color-muted)]">
              {setupMode ? t('page.setupSubtitle') : t('page.subtitle')}
            </p>
          </div>
          {setupMode && (
            <button
              onClick={() => navigate('/dashboard')}
              className="self-start sm:self-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-5 py-2.5 text-xs font-bold text-[var(--color-text)] hover:border-[var(--color-accent)] transition-colors cursor-pointer shadow-xs"
            >
              {members.length > 1 || invites.some((i) => i.status === 'pending') ? t('page.done') : t('page.skip')}
            </button>
          )}
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] p-4 text-xs font-medium text-[var(--color-danger)] flex items-center gap-2.5"
            >
              <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={2} />
              <span>{t(`errors.${error}`, { defaultValue: t('errors.generic') })}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {!loaded ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--color-accent)]" strokeWidth={2} />
          </div>
        ) : (
          <>
            {/* Seats + invite form */}
            <div className={card}>
              {seats && (
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-sm font-bold text-[var(--color-text)] flex items-center gap-2">
                    <Users className="h-4 w-4 text-[var(--color-accent)]" strokeWidth={2} />
                    <span>{t('seats.title')}</span>
                  </h2>
                  <p className="text-xs text-[var(--color-muted)] tabular-nums">
                    {t('seats.used', {
                      used: seats.in_use,
                      total: seats.purchased,
                      members: seats.active_members,
                      pending: seats.pending_invites,
                    })}
                  </p>
                </div>
              )}
              {seats && (
                <div className="mt-3 h-2 rounded-full bg-[var(--color-bg-subtle)] border border-[var(--color-border)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-500"
                    style={{ width: `${Math.min(100, (seats.in_use / Math.max(1, seats.purchased)) * 100)}%` }}
                  />
                </div>
              )}

              <form onSubmit={sendInvite} className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                <label className="sr-only" htmlFor="invite-email">
                  {t('invite.emailLabel')}
                </label>
                <input
                  id="invite-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('invite.emailPlaceholder')}
                  disabled={sending || seatsFull}
                  className={input}
                />
                <label className="sr-only" htmlFor="invite-role">
                  {t('invite.roleLabel')}
                </label>
                <select
                  id="invite-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  disabled={sending || seatsFull}
                  className={input}
                >
                  {MEMBER_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {t(`roles.${r}`)}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={sending || seatsFull || !email.trim()}
                  className="flex items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-xs font-bold text-white hover:bg-[var(--color-accent-hover)] transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {sending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-white" strokeWidth={2} />
                      <span>{t('invite.sending')}</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" strokeWidth={2} />
                      <span>{t('invite.send')}</span>
                    </>
                  )}
                </button>
              </form>
              <p className="mt-2 text-[11px] text-[var(--color-muted)]">
                {seatsFull ? t('seats.full') : t(`roles.hint.${role}`)}
              </p>

              {newLink && (
                <div className="mt-5 rounded-2xl border border-[var(--color-success)]/30 bg-[var(--color-success-soft)] p-4">
                  <p className="text-xs font-bold text-[var(--color-success)] flex items-center gap-1.5">
                    <Check className="h-4 w-4" strokeWidth={2.5} />
                    <span>{t('invite.created', { email: newLink.email, role: t(`roles.${newLink.role}`) })}</span>
                  </p>
                  <div className="mt-3 flex flex-col sm:flex-row gap-2">
                    <input
                      readOnly
                      value={newLink.url}
                      onFocus={(e) => e.target.select()}
                      className={`${input} font-[family-name:var(--font-data)] bg-[var(--color-card)]`}
                      aria-label={t('invite.linkLabel')}
                    />
                    <button
                      type="button"
                      onClick={copyLink}
                      className="shrink-0 flex items-center justify-center gap-2 rounded-xl bg-[var(--color-success)] px-5 py-2.5 text-xs font-bold text-white hover:bg-[var(--color-success)]/90 transition-colors cursor-pointer shadow-xs"
                    >
                      {copied ? <Check className="h-4 w-4" strokeWidth={2} /> : <Copy className="h-4 w-4" strokeWidth={2} />}
                      <span>{copied ? t('invite.copied') : t('invite.copy')}</span>
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-[var(--color-success)]/80">{t('invite.copyNote')}</p>
                </div>
              )}
            </div>

            {/* Members */}
            <div className={card}>
              <h2 className="text-sm font-bold text-[var(--color-text)]">
                {t('members.title', { count: members.length })}
              </h2>
              <ul className="mt-4 divide-y divide-[var(--color-border)]">
                {members.map((m) => (
                  <li key={m.user_id} className="flex flex-col sm:flex-row sm:items-center gap-3 py-3.5">
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-xs font-bold text-[var(--color-text)]">
                        {m.display_name || m.email}
                      </p>
                      <p className="truncate text-[11px] text-[var(--color-muted)] mt-0.5">
                        {m.email} &middot; {t('members.joined', { date: date(m.joined_at) })}
                      </p>
                    </div>
                    {m.role === 'owner' ? (
                      <span className={deptChip('owner')}>{t('roles.owner')}</span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="sr-only" htmlFor={`role-${m.user_id}`}>
                          {t('members.changeRole')}
                        </label>
                        <select
                          id={`role-${m.user_id}`}
                          value={m.role}
                          disabled={busyId === m.user_id}
                          onChange={(e) => act(m.user_id, () => changeMemberRole(m.user_id, e.target.value))}
                          className="rounded-xl border border-[var(--color-line)] dark:border-[#272F3A] bg-[var(--color-surface-2)] dark:bg-[#1C222B] px-2.5 py-1.5 text-[11px] font-medium text-[var(--color-text)] focus:ring-1 focus:ring-[var(--color-accent)] focus:outline-none transition-all"
                        >
                          {MEMBER_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {t(`roles.${r}`)}
                            </option>
                          ))}
                        </select>
                        <span className={deptChip(m.role)}>
                          {t(`roles.${m.role}`)}
                        </span>
                        <span className={chip(m.status === 'active' ? 'green' : 'grey')}>
                          {t(`members.status_${m.status}`)}
                        </span>
                        <button
                          disabled={busyId === m.user_id}
                          className={smallButton}
                          onClick={() =>
                            act(m.user_id, () =>
                              m.status === 'active' ? deactivateMember(m.user_id) : reactivateMember(m.user_id)
                            )
                          }
                        >
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
              <h2 className="text-sm font-bold text-[var(--color-text)]">{t('invites.title')}</h2>
              {invites.length === 0 ? (
                <p className="mt-3 text-xs text-[var(--color-muted)]">{t('invites.none')}</p>
              ) : (
                <ul className="mt-4 divide-y divide-[var(--color-border)]">
                  {invites.map((i) => (
                    <li key={i.invite_id} className="flex flex-col sm:flex-row sm:items-center gap-3 py-3.5">
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-xs font-bold text-[var(--color-text)]">{i.email}</p>
                        <p className="text-[11px] text-[var(--color-muted)] mt-0.5">
                          {t(`roles.${i.role}`)} &middot;{' '}
                          {i.status === 'pending'
                            ? t('invites.expires', { date: date(i.expires_at) })
                            : t('invites.sent', { date: date(i.created_at) })}
                        </p>
                      </div>
                      <span className={chip(inviteTone[i.status])}>{t(`invites.status_${i.status}`)}</span>
                      {i.status === 'pending' && (
                        <button
                          disabled={busyId === i.invite_id}
                          className={smallButton}
                          onClick={() => act(i.invite_id, () => revokeInvite(i.invite_id))}
                        >
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
              <h2 className="text-sm font-bold text-[var(--color-text)] flex items-center gap-2">
                <Clock className="h-4 w-4 text-[var(--color-muted)]" strokeWidth={2} />
                <span>{t('activity.title')}</span>
              </h2>
              {activity.length === 0 ? (
                <p className="mt-3 text-xs text-[var(--color-muted)]">{t('activity.none')}</p>
              ) : (
                <ul className="mt-4 space-y-2.5">
                  {activity.slice(0, 20).map((a, n) => (
                    <li
                      key={`${a.at}-${n}`}
                      className="flex flex-col sm:flex-row sm:justify-between gap-1 text-[11px] p-2 rounded-xl hover:bg-[var(--color-bg-subtle)] transition-colors"
                    >
                      <span className="text-[var(--color-text)]">
                        {t(`activity.${a.action}`, {
                          actor: a.actor_email ?? t('activity.someone'),
                          target:
                            a.action.startsWith('member.') && a.action !== 'member.joined'
                              ? emailFor(a.target)
                              : a.target,
                          role: a.details?.role ? t(`roles.${a.details.role}`) : '',
                          from: a.details?.from ? t(`roles.${a.details.from}`) : '',
                          to: a.details?.to ? t(`roles.${a.details.to}`) : '',
                          defaultValue: a.action,
                        })}
                      </span>
                      <span className="text-[var(--color-muted)] shrink-0 tabular-nums">
                        {new Date(a.at).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
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
