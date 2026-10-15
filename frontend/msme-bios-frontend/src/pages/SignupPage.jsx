import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from 'react-i18next'
import ThemeToggle from '../components/ThemeToggle'
import LanguageSwitcher from '../components/LanguageSwitcher'
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
  const [loading, setLoading] = useState(false)

  const { signup, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation('auth')

  const handleGoogleSignup = async () => {
    setError('')
    try {
      setLoading(true)
      await loginWithGoogle()
      navigate('/business-setup')
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        console.error('Google signup error:', err)
      }
      if (err.code === 'auth/popup-closed-by-user') {
        setError('errors.googleCancelled')
      } else if (err.code === 'auth/popup-blocked') {
        setError('errors.googlePopupBlocked')
      } else {
        setError('errors.googleSignupFailed')
      }
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
      navigate('/business-setup')
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
    <div className="flex min-h-screen flex-col bg-[#FBF3EC] dark:bg-[#1A1714] text-[#2A2521] dark:text-[#F5EFE8] transition-colors">
      
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-[#FBF3EC]/90 dark:bg-[#1A1714]/90 backdrop-blur-md border-b border-[#F0E4D8] dark:border-[#3A332A] px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link to="/" className="flex items-center group">
            <div className="rounded-lg bg-white px-2 py-1 transition-transform group-hover:scale-105 dark:shadow-md">
              <img src={logo} alt="MSME-BIOS" className="h-7 w-auto" />
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <ThemeToggle />
            <div className="text-xs font-medium text-[#8A7F74] dark:text-[#A89E92]">
              {t('signup.headerPrompt')}{' '}
              <Link to="/login" className="font-bold text-[#E8622C] dark:text-[#F27A4A] hover:underline">
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
          <div className="rounded-3xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] p-6 sm:p-10 shadow-xl">
            
            {/* Header */}
            <div>
              <span className="rounded-full bg-[#E8622C]/10 dark:bg-[#F27A4A]/20 px-3 py-1 text-xs font-bold text-[#E8622C] dark:text-[#F27A4A]">
                {t('signup.badge')}
              </span>
              <h1 className="mt-3 font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-bold tracking-tight text-[#2A2521] dark:text-[#F5EFE8]">
                {t('signup.title')}
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-[#8A7F74] dark:text-[#A89E92]">
                {t('signup.subtitle')}
              </p>
            </div>

            {/* Tab Switcher */}
            <div className="mt-6 flex rounded-xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FBF3EC] dark:bg-[#1A1714] p-1">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="flex-1 rounded-lg py-2 text-xs font-semibold text-[#8A7F74] dark:text-[#A89E92] hover:text-[#2A2521] dark:hover:text-[#F5EFE8] transition-colors cursor-pointer"
              >
                {t('tabs.login')}
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg bg-[#FFFFFF] dark:bg-[#242019] py-2 text-xs font-bold text-[#E8622C] dark:text-[#F27A4A] shadow-xs"
              >
                {t('tabs.signup')}
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/40 p-3.5 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                <svg className="h-4 w-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span>{t(error)}</span>
              </div>
            )}

            {/* Signup Form */}
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              
              {/* Full Name */}
              <div>
                <label htmlFor="name" className="block text-xs font-bold text-[#2A2521] dark:text-[#F5EFE8]">
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
                  className="mt-1.5 w-full rounded-xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FBF3EC] dark:bg-[#1A1714] px-4 py-3 text-xs text-[#2A2521] dark:text-[#F5EFE8] placeholder-[#8A7F74]/50 focus:border-[#E8622C] dark:focus:border-[#F27A4A] focus:outline-none transition-colors disabled:opacity-50"
                />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-xs font-bold text-[#2A2521] dark:text-[#F5EFE8]">
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
                  className="mt-1.5 w-full rounded-xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FBF3EC] dark:bg-[#1A1714] px-4 py-3 text-xs text-[#2A2521] dark:text-[#F5EFE8] placeholder-[#8A7F74]/50 focus:border-[#E8622C] dark:focus:border-[#F27A4A] focus:outline-none transition-colors disabled:opacity-50"
                />
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-xs font-bold text-[#2A2521] dark:text-[#F5EFE8]">
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
                    className="w-full rounded-xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FBF3EC] dark:bg-[#1A1714] px-4 py-3 pr-10 text-xs text-[#2A2521] dark:text-[#F5EFE8] placeholder-[#8A7F74]/50 focus:border-[#E8622C] dark:focus:border-[#F27A4A] focus:outline-none transition-colors disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? t('fields.hidePassword') : t('fields.showPassword')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A7F74] hover:text-[#E8622C] dark:hover:text-[#F27A4A] p-1 cursor-pointer"
                  >
                    {showPassword ? (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="block text-xs font-bold text-[#2A2521] dark:text-[#F5EFE8]">
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
                  className="mt-1.5 w-full rounded-xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FBF3EC] dark:bg-[#1A1714] px-4 py-3 text-xs text-[#2A2521] dark:text-[#F5EFE8] placeholder-[#8A7F74]/50 focus:border-[#E8622C] dark:focus:border-[#F27A4A] focus:outline-none transition-colors disabled:opacity-50"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full rounded-xl bg-[#E8622C] dark:bg-[#F27A4A] py-3.5 text-xs font-bold text-white shadow-md shadow-[#E8622C]/20 hover:bg-[#D4531F] dark:hover:bg-[#E56938] transition-all transform active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {loading ? t('signup.submitting') : t('signup.submit')}
              </button>
            </form>

            {/* Divider */}
            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-[#F0E4D8] dark:bg-[#3A332A]" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A7F74] dark:text-[#A89E92]">{t('or')}</span>
              <div className="h-px flex-1 bg-[#F0E4D8] dark:bg-[#3A332A]" />
            </div>

            {/* Google Sign-in */}
            <button
              type="button"
              onClick={handleGoogleSignup}
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] py-3 text-xs font-bold text-[#2A2521] dark:text-[#F5EFE8] hover:bg-[#FBF3EC] dark:hover:bg-[#2D2820] transition-colors disabled:opacity-50 cursor-pointer"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>{t('continueWithGoogle')}</span>
            </button>

            {/* Bottom link */}
            <p className="mt-6 text-center text-xs text-[#8A7F74] dark:text-[#A89E92]">
              {t('signup.headerPrompt')}{' '}
              <Link to="/login" className="font-bold text-[#E8622C] dark:text-[#F27A4A] hover:underline">
                {t('signup.bottomLoginLink')}
              </Link>
            </p>
          </div>

          {/* RIGHT COLUMN: WARM LINE ILLUSTRATION & HIGHLIGHTS */}
          <div className="hidden lg:flex flex-col justify-between rounded-3xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF]/60 dark:bg-[#242019]/60 p-10 backdrop-blur-xs">
            
            {/* SVG Line Illustration */}
            <div className="mx-auto w-full max-w-sm">
              <svg viewBox="0 0 400 280" fill="none" className="w-full h-auto text-[#E8622C] dark:text-[#F27A4A]">
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
              </svg>
            </div>

            {/* Headline & Bullet Points */}
            <div className="mt-8">
              <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[#2A2521] dark:text-[#F5EFE8]">
                {t('side.headline')}
              </h2>
              <p className="mt-2 text-xs text-[#8A7F74] dark:text-[#A89E92] leading-relaxed">
                {t('side.description')}
              </p>

              <div className="mt-6 space-y-3">
                <div className="flex items-center gap-3 text-xs font-semibold text-[#2A2521] dark:text-[#F5EFE8]">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1F9254]/10 text-[#1F9254]">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <span>{t('side.point1')}</span>
                </div>

                <div className="flex items-center gap-3 text-xs font-semibold text-[#2A2521] dark:text-[#F5EFE8]">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1F9254]/10 text-[#1F9254]">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <span>{t('side.point2')}</span>
                </div>

                <div className="flex items-center gap-3 text-xs font-semibold text-[#2A2521] dark:text-[#F5EFE8]">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1F9254]/10 text-[#1F9254]">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
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
