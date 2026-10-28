import { useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, AlertCircle, Check } from 'lucide-react'
import { safeNext, nextQuery } from '../lib/nextPath'
import { useAuth } from '../context/AuthContext'
import ThemeToggle from '../components/ThemeToggle'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { googleErrorKey } from '../lib/googleAuthError'
import logo from '../assets/logo.png'

export default function SignupPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [errorCode, setErrorCode] = useState('')
  const [loading, setLoading] = useState(false)

  const { signup, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation('auth')
  const next = safeNext(useSearchParams()[0])

  const handleGoogleSignup = async () => {
    setError('')
    setErrorCode('')
    try {
      setLoading(true)
      await loginWithGoogle()
      navigate(next ?? '/business-setup')
    } catch (err) {
      console.error('Google signup error:', err.code, err.message)
      const key = googleErrorKey(err.code, 'errors.googleSignupFailed')
      setError(key)
      setErrorCode(key === 'errors.googleCancelled' ? '' : err.code || '')
    } finally {
      setLoading(false)
    }
  }

  const update = (field) => (e) => {
    setForm((f) => ({
      ...f,
      [field]: e.target.value,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setErrorCode('')

    if (!form.name.trim()) {
      setError('errors.nameRequired')
      return
    }
    if (!form.email.trim()) {
      setError('errors.emailRequired')
      return
    }
    if (!form.password) {
      setError('errors.passwordRequired')
      return
    }
    if (form.password.length < 6) {
      setError('errors.passwordTooShort')
      return
    }
    if (form.password !== form.confirmPassword) {
      setError('errors.passwordsDoNotMatch')
      return
    }

    try {
      setLoading(true)
      await signup({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      })
      navigate(next ?? '/business-setup')
    } catch (err) {
      console.error('Signup error:', err)
      switch (err.code) {
        case 'auth/email-already-in-use':
          setError('errors.emailInUse')
          break
        case 'auth/invalid-email':
          setError('errors.invalidEmail')
          break
        case 'auth/weak-password':
          setError('errors.weakPassword')
          break
        case 'auth/operation-not-allowed':
          setError('errors.operationNotAllowed')
          break
        default:
          setError('errors.signupFailed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-canvas)] text-[var(--color-ink)] transition-colors">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-[var(--color-canvas)]/90 backdrop-blur-md border-b border-[var(--color-line)] px-4 sm:px-6 py-3.5">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link to="/" className="flex items-center shrink-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded-lg">
            <div className="rounded-lg bg-white px-2.5 py-1.5 shadow-xs border border-black/5 shrink-0 transition-transform group-hover:scale-102 flex items-center justify-center">
              <img src={logo} alt="MSME-BIOS" className="h-7 w-auto min-w-[96px] object-contain block shrink-0" />
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <ThemeToggle />
            <div className="hidden sm:block text-xs font-medium text-[var(--color-muted)] pl-2 border-l border-[var(--color-line)]">
              {t('signup.headerPrompt')}{' '}
              <Link
                to={`/login${nextQuery(next)}`}
                className="font-bold text-[var(--color-accent)] hover:underline"
              >
                {t('signup.headerLoginLink')}
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Two-Column Layout */}
      <main className="flex flex-1 items-center justify-center px-4 sm:px-6 py-8 md:py-12">
        <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-2 items-center">
          {/* LEFT COLUMN: AUTH FORM CARD */}
          <div className="rounded-3xl border border-[var(--color-line)] bg-[var(--color-surface)] p-6 sm:p-10 shadow-[var(--shadow-warm-md)]">
            {/* Header */}
            <div>
              <span className="inline-block rounded-full bg-[var(--color-accent-soft)] px-3 py-1 text-xs font-bold text-[var(--color-accent)]">
                {t('signup.badge')}
              </span>
              <h1 className="mt-3 font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-ink)]">
                {t('signup.title')}
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-[var(--color-muted)] leading-relaxed">
                {t('signup.subtitle')}
              </p>
            </div>

            {/* Tab Switcher with sliding indicator */}
            <div className="mt-6 flex rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] p-1">
              <button
                type="button"
                onClick={() => navigate(`/login${nextQuery(next)}`)}
                className="relative flex-1 rounded-lg py-2 text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
              >
                <span className="relative z-10">{t('tabs.login')}</span>
              </button>
              <button
                type="button"
                className="relative flex-1 rounded-lg py-2 text-xs font-bold text-[var(--color-accent)] transition-colors"
              >
                <motion.div
                  layoutId="authTab"
                  className="absolute inset-0 rounded-lg bg-[var(--color-surface)] shadow-xs border border-[var(--color-line)]"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
                <span className="relative z-10">{t('tabs.signup')}</span>
              </button>
            </div>

            {/* Error Message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                  className="mt-5 rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] p-3.5 text-xs text-[var(--color-danger)] flex items-start gap-2.5"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" strokeWidth={2} />
                  <div>
                    <span className="font-medium">{t(error)}</span>
                    {errorCode && (
                      <span className="mt-1 block font-mono text-[10px] opacity-80">
                        {t('errors.codeLabel')}: {errorCode}
                      </span>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Signup Form */}
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {/* Full Name */}
              <div>
                <label htmlFor="name" className="block text-xs font-bold text-[var(--color-ink)]">
                  {t('fields.fullName')}
                </label>
                <input
                  id="name"
                  type="text"
                  value={form.name}
                  onChange={update('name')}
                  placeholder={t('fields.fullNamePlaceholder')}
                  autoComplete="name"
                  disabled={loading}
                  className="mt-1.5 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] dark:bg-[var(--color-canvas)] px-4 py-2.5 text-xs sm:text-sm text-[var(--color-ink)] placeholder-[var(--color-muted)]/60 focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 focus:outline-none transition-all disabled:opacity-50"
                />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-xs font-bold text-[var(--color-ink)]">
                  {t('fields.email')}
                </label>
                <input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={update('email')}
                  placeholder="ramesh@example.com"
                  autoComplete="email"
                  disabled={loading}
                  className="mt-1.5 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] dark:bg-[var(--color-canvas)] px-4 py-2.5 text-xs sm:text-sm text-[var(--color-ink)] placeholder-[var(--color-muted)]/60 focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 focus:outline-none transition-all disabled:opacity-50"
                />
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-xs font-bold text-[var(--color-ink)]">
                  {t('fields.password')}
                </label>
                <div className="relative mt-1.5">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={update('password')}
                    placeholder={t('fields.passwordPlaceholderSignup')}
                    autoComplete="new-password"
                    disabled={loading}
                    className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] dark:bg-[var(--color-canvas)] px-4 py-2.5 pr-10 text-xs sm:text-sm text-[var(--color-ink)] placeholder-[var(--color-muted)]/60 focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 focus:outline-none transition-all disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? t('fields.hidePassword') : t('fields.showPassword')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)] hover:text-[var(--color-ink)] p-1 cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" strokeWidth={1.75} />
                    ) : (
                      <Eye className="h-4 w-4" strokeWidth={1.75} />
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="block text-xs font-bold text-[var(--color-ink)]">
                  {t('fields.confirmPassword')}
                </label>
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={update('confirmPassword')}
                  placeholder={t('fields.confirmPasswordPlaceholder')}
                  autoComplete="new-password"
                  disabled={loading}
                  className="mt-1.5 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] dark:bg-[var(--color-canvas)] px-4 py-2.5 text-xs sm:text-sm text-[var(--color-ink)] placeholder-[var(--color-muted)]/60 focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 focus:outline-none transition-all disabled:opacity-50"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] py-3 text-xs sm:text-sm font-bold text-white dark:text-[#0E1116] shadow-xs hover:bg-[var(--color-accent-hover)] transition-all transform active:scale-[0.98] disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              >
                {loading ? t('signup.submitting') : t('signup.submit')}
              </button>
            </form>

            {/* Divider */}
            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-[var(--color-line-subtle)]" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                {t('or')}
              </span>
              <div className="h-px flex-1 bg-[var(--color-line-subtle)]" />
            </div>

            {/* Google Sign-in */}
            <button
              type="button"
              onClick={handleGoogleSignup}
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] py-2.5 text-xs sm:text-sm font-semibold text-[var(--color-ink)] hover:bg-[var(--color-surface-2)] transition-colors disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>{t('continueWithGoogle')}</span>
            </button>

            {/* Bottom link */}
            <p className="mt-6 text-center text-xs text-[var(--color-muted)]">
              {t('signup.headerPrompt')}{' '}
              <Link
                to={`/login${nextQuery(next)}`}
                className="font-bold text-[var(--color-accent)] hover:underline"
              >
                {t('signup.bottomLoginLink')}
              </Link>
            </p>
          </div>

          {/* RIGHT COLUMN: TEXT-FREE WINDOW CARD VISUAL & HIGHLIGHTS */}
          <div className="hidden lg:flex flex-col justify-between rounded-3xl border border-[var(--color-line)] bg-[var(--color-surface)]/70 p-10 shadow-xs backdrop-blur-xs relative overflow-hidden">
            {/* Subtle background grid pattern */}
            <div
              className="pointer-events-none absolute inset-0 select-none"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(45deg, var(--color-line) 0, var(--color-line) 1px, transparent 0, transparent 20px)',
                opacity: 0.08,
                maskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 80%)',
                WebkitMaskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 80%)',
              }}
              aria-hidden="true"
            />

            {/* Window Card Visual */}
            <div
              className="relative z-10 mx-auto w-full max-w-sm rounded-2xl border border-[var(--color-line)] bg-white dark:bg-[var(--color-surface)] p-5 shadow-[var(--shadow-cool-md)]"
              aria-hidden="true"
            >
              {/* Window top dots */}
              <div className="flex items-center justify-between border-b border-[var(--color-line-subtle)] pb-2.5">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-[#FF5F57]" />
                  <div className="h-2 w-2 rounded-full bg-[#FEBC2E]" />
                  <div className="h-2 w-2 rounded-full bg-[#28C840]" />
                </div>
                <div className="h-1.5 w-16 rounded-full bg-[var(--color-line)]" />
                <div className="h-1.5 w-6 rounded-full bg-[var(--color-line-subtle)]" />
              </div>

              {/* Mini metric row */}
              <div className="mt-3.5 grid grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-tint-blue)] p-2.5">
                  <div className="h-1.5 w-12 rounded bg-[var(--color-accent)]/40" />
                  <div className="mt-2 flex items-baseline justify-between">
                    <span data-tabular="true" className="font-[family-name:var(--font-display)] text-sm font-bold text-[var(--color-ink)]">
                      ₹ 4.8L
                    </span>
                    <svg className="w-6 h-3 text-[var(--color-accent)]" viewBox="0 0 24 12" fill="none">
                      <path d="M1 10 L 8 6 L 15 8 L 23 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-tint-green)] p-2.5">
                  <div className="h-1.5 w-10 rounded bg-[var(--color-dept-finance)]/40" />
                  <div className="mt-2 flex items-baseline justify-between">
                    <span data-tabular="true" className="font-[family-name:var(--font-display)] text-sm font-bold text-[var(--color-ink)]">
                      99.4%
                    </span>
                    <svg className="w-6 h-3 text-[var(--color-dept-finance)]" viewBox="0 0 24 12" fill="none">
                      <path d="M1 9 L 7 10 L 15 4 L 23 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Sparkline area chart with saffron line */}
              <div className="mt-3 rounded-xl border border-[var(--color-line-subtle)] bg-[var(--color-surface-2)] p-2.5">
                <svg className="w-full h-16" viewBox="0 0 280 64" fill="none">
                  <path
                    d="M 5 50 Q 60 40 100 25 T 190 20 T 275 6 L 275 60 L 5 60 Z"
                    fill="var(--color-accent-soft)"
                    opacity="0.35"
                  />
                  <path
                    d="M 5 50 Q 60 40 100 25 T 190 20 T 275 6"
                    fill="none"
                    stroke="var(--color-highlight)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <circle cx="100" cy="25" r="3" fill="var(--color-surface)" stroke="var(--color-highlight)" strokeWidth="2" />
                  <circle cx="275" cy="6" r="3" fill="var(--color-highlight)" />
                </svg>
              </div>
            </div>

            {/* Headline & Bullet Points */}
            <div className="mt-8">
              <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-ink)]">
                {t('side.headline')}
              </h2>
              <p className="mt-2 text-xs text-[var(--color-muted)] leading-relaxed">
                {t('side.description')}
              </p>

              <div className="mt-6 space-y-3">
                <div className="flex items-center gap-3 text-xs font-semibold text-[var(--color-ink)]">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-success-soft)] text-[var(--color-success)]">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </div>
                  <span>{t('side.point1')}</span>
                </div>

                <div className="flex items-center gap-3 text-xs font-semibold text-[var(--color-ink)]">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-success-soft)] text-[var(--color-success)]">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </div>
                  <span>{t('side.point2')}</span>
                </div>

                <div className="flex items-center gap-3 text-xs font-semibold text-[var(--color-ink)]">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-success-soft)] text-[var(--color-success)]">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </div>
                  <span>{t('side.point3')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
