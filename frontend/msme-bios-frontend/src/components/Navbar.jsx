import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown,
  LayoutDashboard,
  Upload,
  LogOut,
  Menu,
  X,
  FileText,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import ThemeToggle from './ThemeToggle'
import LanguageSwitcher from './LanguageSwitcher'
import { scaleIn } from '../lib/motion'
import logo from '../assets/logo.png'

export default function Navbar({ showNavLinks = false }) {
  const { t } = useTranslation()
  const { user, isLoggedIn, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [resourcesOpen, setResourcesOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 12)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleLogout = async () => {
    try {
      await logout()
      setMenuOpen(false)
      navigate('/')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const isLanding = location.pathname === '/'

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-200 ${
        isLanding
          ? isScrolled
            ? 'bg-[var(--color-surface)]/95 backdrop-blur-md border-b border-[var(--color-line)] shadow-xs'
            : 'bg-transparent border-b border-transparent'
          : 'bg-[var(--color-surface)]/95 backdrop-blur-md border-b border-[var(--color-line)] shadow-xs'
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 py-3">
        {/* Brand Logo - Fixed white chip bug with shrink-0 and min-w constraints */}
        <Link to="/" className="flex items-center shrink-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded-lg">
          <div className="rounded-xl bg-white px-2.5 py-1.5 shadow-xs border border-[var(--color-hero-line)] shrink-0 transition-transform group-hover:scale-102 flex items-center justify-center">
            <img
              src={logo}
              alt="MSME-BIOS"
              className="h-7 w-auto min-w-[96px] object-contain block shrink-0"
            />
          </div>
        </Link>

        {/* Center Nav Links (Desktop) */}
        {showNavLinks && (
          <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
            <a
              href={isLanding ? '#hero' : '/'}
              className="text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors py-1"
            >
              {t('nav.home')}
            </a>
            <a
              href={isLanding ? '#features' : '/#features'}
              className="text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors py-1"
            >
              {t('nav.features')}
            </a>
            <a
              href={isLanding ? '#how-it-works' : '/#how-it-works'}
              className="text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors py-1"
            >
              {t('nav.howItWorks')}
            </a>
            <a
              href={isLanding ? '#pricing' : '/choose-plan'}
              className="text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors py-1"
            >
              {t('nav.pricing')}
            </a>

            {/* Resources Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setResourcesOpen((o) => !o)}
                className="flex items-center gap-1 text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors py-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded-md"
              >
                <span>{t('nav.resources')}</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-200 ${
                    resourcesOpen ? 'rotate-180 text-[var(--color-accent)]' : ''
                  }`}
                  strokeWidth={2}
                />
              </button>

              <AnimatePresence>
                {resourcesOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setResourcesOpen(false)}
                    />
                    <motion.div
                      variants={scaleIn}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="absolute left-0 top-full mt-2 w-56 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-2 shadow-[var(--shadow-warm-lg)] z-50 overflow-hidden"
                    >
                      <Link
                        to="/msme-guide"
                        onClick={() => setResourcesOpen(false)}
                        className="flex items-start gap-2.5 rounded-lg p-2.5 text-xs hover:bg-[var(--color-surface-2)] transition-colors group"
                      >
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-accent-soft)] text-[var(--color-accent)] shrink-0">
                          <FileText className="h-4 w-4" strokeWidth={2} />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-[var(--color-ink)] group-hover:text-[var(--color-accent)] transition-colors">
                            {t('nav.msmeGuideTitle')}
                          </span>
                          <span className="text-[11px] text-[var(--color-muted)] mt-0.5">
                            {t('nav.msmeGuideSubtitle')}
                          </span>
                        </div>
                      </Link>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </nav>
        )}

        {/* Right Nav Action Area */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <LanguageSwitcher />
          <ThemeToggle />

          {isLoggedIn ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] shadow-xs hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-surface-2)] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-accent)] text-white font-bold text-[11px] shrink-0">
                  {(user.displayName || user.email || 'U')[0].toUpperCase()}
                </div>
                <span className="max-w-[110px] truncate font-[family-name:var(--font-body)]">
                  {user.displayName || user.email}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-[var(--color-muted)]" strokeWidth={2} />
              </button>

              <AnimatePresence>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                    <motion.div
                      variants={scaleIn}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-1.5 shadow-[var(--shadow-warm-lg)] z-50 overflow-hidden"
                    >
                      <Link
                        to="/dashboard"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-2)] transition-colors"
                      >
                        <LayoutDashboard className="h-4 w-4 text-[var(--color-accent)]" strokeWidth={1.75} />
                        {t('nav.dashboard')}
                      </Link>
                      <Link
                        to="/upload"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-2)] transition-colors"
                      >
                        <Upload className="h-4 w-4 text-[var(--color-accent)]" strokeWidth={1.75} />
                        {t('nav.uploadDocument')}
                      </Link>
                      <div className="my-1 border-t border-[var(--color-line-subtle)]" />
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] transition-colors cursor-pointer"
                      >
                        <LogOut className="h-4 w-4" strokeWidth={1.75} />
                        {t('nav.logOut')}
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2 sm:gap-2.5">
              <Link
                to="/login"
                className="px-3 py-1.5 text-xs sm:text-sm font-semibold text-[var(--color-ink)] hover:text-[var(--color-accent)] transition-colors rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              >
                {t('nav.login')}
              </Link>
              <Link
                to="/signup"
                className="inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-3.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white dark:text-[#0E1116] shadow-xs hover:bg-[var(--color-accent-hover)] transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] shrink-0"
              >
                {t('nav.getStarted')}
              </Link>
            </div>
          )}

          {/* Mobile menu hamburger button */}
          {showNavLinks && (
            <button
              type="button"
              onClick={() => setMobileNavOpen((o) => !o)}
              aria-label="Toggle navigation"
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--color-line)] text-[var(--color-ink)] hover:bg-[var(--color-surface-2)] md:hidden cursor-pointer shrink-0 transition-colors"
            >
              {mobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Mobile Nav Drawer */}
      <AnimatePresence>
        {showNavLinks && mobileNavOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-[var(--color-line)] bg-[var(--color-surface)] px-6 py-4 md:hidden space-y-3 shadow-md"
          >
            <a
              href={isLanding ? '#hero' : '/'}
              onClick={() => setMobileNavOpen(false)}
              className="block text-sm font-medium text-[var(--color-ink)] hover:text-[var(--color-accent)] transition-colors"
            >
              {t('nav.home')}
            </a>
            <a
              href={isLanding ? '#features' : '/#features'}
              onClick={() => setMobileNavOpen(false)}
              className="block text-sm font-medium text-[var(--color-ink)] hover:text-[var(--color-accent)] transition-colors"
            >
              {t('nav.features')}
            </a>
            <a
              href={isLanding ? '#how-it-works' : '/#how-it-works'}
              onClick={() => setMobileNavOpen(false)}
              className="block text-sm font-medium text-[var(--color-ink)] hover:text-[var(--color-accent)] transition-colors"
            >
              {t('nav.howItWorks')}
            </a>
            <a
              href={isLanding ? '#pricing' : '/choose-plan'}
              onClick={() => setMobileNavOpen(false)}
              className="block text-sm font-medium text-[var(--color-ink)] hover:text-[var(--color-accent)] transition-colors"
            >
              {t('nav.pricing')}
            </a>
            <Link
              to="/msme-guide"
              onClick={() => setMobileNavOpen(false)}
              className="block text-sm font-semibold text-[var(--color-accent)]"
            >
              {t('nav.msmeGuideShort')}
            </Link>

            {!isLoggedIn && (
              <div className="pt-3 border-t border-[var(--color-line)] flex items-center gap-3">
                <Link
                  to="/login"
                  onClick={() => setMobileNavOpen(false)}
                  className="px-3 py-2 text-xs font-semibold text-[var(--color-ink)] hover:text-[var(--color-accent)] transition-colors rounded-lg"
                >
                  {t('nav.login')}
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setMobileNavOpen(false)}
                  className="rounded-xl bg-[var(--color-accent)] px-4 py-2 text-xs font-semibold text-white dark:text-[#0E1116] shadow-xs"
                >
                  {t('nav.getStarted')}
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
