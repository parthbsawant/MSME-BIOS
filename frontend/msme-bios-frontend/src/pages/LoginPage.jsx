import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, AlertCircle, Check } from 'lucide-react'
import { safeNext, nextQuery } from '../lib/nextPath'
import { useAuth } from '../context/AuthContext'
import ThemeToggle from '../components/ThemeToggle'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { googleErrorKey } from '../lib/googleAuthError'
import logo from '../assets/logo.png'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState('')
  const [errorCode, setErrorCode] = useState('')
  const [loading, setLoading] = useState(false)

  const { login, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation('auth')
  const next = safeNext(useSearchParams()[0])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setErrorCode('')

    if (!email.trim() || !password) {
      setError('errors.emailAndPasswordRequired')
      return
    }

    try {
      setLoading(true)
      await login(email.trim(), password)
      navigate(next ?? '/dashboard')
    } catch (err) {
      console.error('Login error:', err)
      switch (err.code) {
        case 'auth/invalid-credential':
          setError('errors.invalidCredential')
          break
        case 'auth/user-not-found':
          setError('errors.userNotFound')
          break
        case 'auth/wrong-password':
          setError('errors.wrongPassword')
          break
        case 'auth/invalid-email':
          setError('errors.invalidEmail')
          break
        case 'auth/too-many-requests':
          setError('errors.tooManyRequests')
          break
        default:
          setError('errors.loginFailed')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setError('')
    setErrorCode('')
    try {
      setLoading(true)
      await loginWithGoogle()
      navigate(next ?? '/dashboard')
    } catch (err) {
      console.error('Google login error:', err.code, err.message)
      const key = googleErrorKey(err.code, 'errors.googleLoginFailed')
      setError(key)
      setErrorCode(key === 'errors.googleCancelled' ? '' : err.code || '')
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
              {t('login.headerPrompt')}{' '}
              <Link
                to={`/signup${nextQuery(next)}`}
                className="font-bold text-[var(--color-accent)] hover:underline"
              >
                {t('login.createAccountLink')}
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
            {/* Header & Tab Switcher */}
            <div>
              <span className="inline-block rounded-full bg-[var(--color-accent-soft)] px-3 py-1 text-xs font-bold text-[var(--color-accent)]">
                {t('login.badge')}
              </span>
              <h1 className="mt-3 font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-ink)]">
                {t('login.title')}
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-[var(--color-muted)] leading-relaxed">
                {t('login.subtitle')}
              </p>
            </div>

            {/* Tab Switcher with sliding indicator */}
            <div className="mt-6 flex rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] p-1">
              <button
                type="button"
                className="relative flex-1 rounded-lg py-2 text-xs font-bold text-[var(--color-accent)] transition-colors"
              >
                <motion.div
                  layoutId="authTab"
                  className="absolute inset-0 rounded-lg bg-[var(--color-surface)] shadow-xs border border-[var(--color-line)]"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
                <span className="relative z-10">{t('tabs.login')}</span>
              </button>
              <button
                type="button"
                onClick={() => navigate(`/signup${nextQuery(next)}`)}
                className="relative flex-1 rounded-lg py-2 text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
              >
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

            {/* Email / Password Form */}
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-xs font-bold text-[var(--color-ink)]">
                  {t('fields.email')}
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
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
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('fields.passwordPlaceholderLogin')}
                    autoComplete="current-password"
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

              {/* Remember me & Forgot Password */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 text-[var(--color-muted)] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-[var(--color-line)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                  />
                  <span>{t('login.rememberMe')}</span>
                </label>
                <span className="font-semibold text-[var(--color-accent)] hover:underline cursor-pointer">
                  {t('login.forgotPassword')}
                </span>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] py-3 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-[var(--color-accent-hover)] transition-all transform active:scale-[0.98] disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              >
                {loading ? t('login.submitting') : t('login.submit')}
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
              onClick={handleGoogleLogin}
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
              {t('login.bottomPrompt')}{' '}
              <Link
                to={`/signup${nextQuery(next)}`}
                className="font-bold text-[var(--color-accent)] hover:underline"
              >
                {t('login.createAccountLink')}
              </Link>
            </p>
          </div>

          {/* RIGHT COLUMN: WARM LINE ILLUSTRATION & HIGHLIGHTS */}
          <div className="hidden lg:flex flex-col justify-between rounded-3xl border border-[var(--color-line)] bg-[var(--color-surface)]/70 p-10 shadow-xs backdrop-blur-xs">
            {/* SVG Line Illustration (Shop / Business style in brand palette) */}
            <div className="mx-auto w-full max-w-sm" aria-hidden="true">
              <svg viewBox="0 0 400 280" fill="none" className="w-full h-auto text-[var(--color-accent)]">
                {/* Store Roof & Awning */}
                <path d="M50 120 L200 40 L350 120" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M70 120 C90 140 110 140 130 120 C150 140 170 140 190 120 C210 140 230 140 250 120 C270 140 290 140 310 120 C330 140 350 140 370 120" stroke="currentColor" strokeWidth="3" fill="none" />

                {/* Store Building Outer */}
                <rect x="70" y="120" width="260" height="130" rx="8" stroke="currentColor" strokeWidth="4" fill="none" />

                {/* Store Door */}
                <rect x="170" y="170" width="60" height="80" rx="4" stroke="currentColor" strokeWidth="3" fill="none" />
                <circle cx="218" cy="210" r="4" fill="currentColor" />

                {/* Windows */}
                <rect x="95" y="150" width="55" height="50" rx="4" stroke="currentColor" strokeWidth="3" fill="none" />
                <line x1="95" y1="175" x2="150" y2="175" stroke="currentColor" strokeWidth="2" />

                <rect x="250" y="150" width="55" height="50" rx="4" stroke="currentColor" strokeWidth="3" fill="none" />
                <line x1="250" y1="175" x2="305" y2="175" stroke="currentColor" strokeWidth="2" />

                {/* Geometric decorative elements */}
                <path d="M300 60 L320 60 M310 50 L310 70" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                <circle cx="90" cy="70" r="6" fill="currentColor" opacity="0.3" />
                <circle cx="330" cy="100" r="8" fill="currentColor" opacity="0.2" />
              </svg>
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
