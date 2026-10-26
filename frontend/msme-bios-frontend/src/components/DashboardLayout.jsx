import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Upload,
  FileText,
  Receipt,
  DollarSign,
  BarChart3,
  Users,
  CreditCard,
  Settings,
  Search,
  Bell,
  ChevronDown,
  Menu,
  X,
  LogOut,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useBusiness } from '../context/BusinessContext'
import { useTranslation } from 'react-i18next'
import ThemeToggle from './ThemeToggle'
import LanguageSwitcher from './LanguageSwitcher'
import logo from '../assets/logo.png'

export default function DashboardLayout({ children, activeItem = 'Dashboard' }) {
  const { user, logout } = useAuth()
  const { t } = useTranslation('dashboard')
  const { t: tTeam } = useTranslation('team')
  const { role, isOwner, effectiveFeatures } = useBusiness()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)

  const displayName = user?.displayName || user?.name || user?.email || t('layout.userFallback')

  const handleLogout = async () => {
    try {
      await logout()
      navigate('/')
    } catch (err) {
      console.error('Logout error:', err)
    }
  }

  const sidebarItems = [
    {
      id: 'Dashboard',
      label: t('layout.items.dashboard'),
      path: '/dashboard',
      icon: <LayoutDashboard className="h-4 w-4 shrink-0" strokeWidth={2} />,
    },
    {
      id: 'Upload Document',
      label: t('layout.items.upload'),
      path: '/upload',
      feature: 'document_parser',
      icon: <Upload className="h-4 w-4 shrink-0" strokeWidth={2} />,
    },
    {
      id: 'Documents',
      label: t('layout.items.documents'),
      path: '/results',
      icon: <FileText className="h-4 w-4 shrink-0" strokeWidth={2} />,
    },
    {
      id: 'Invoices',
      label: t('layout.items.invoices'),
      comingSoon: true,
      icon: <Receipt className="h-4 w-4 shrink-0" strokeWidth={2} />,
    },
    {
      id: 'Cash Flow',
      label: t('layout.items.cashFlow'),
      comingSoon: true,
      icon: <DollarSign className="h-4 w-4 shrink-0" strokeWidth={2} />,
    },
    {
      id: 'Reports',
      label: t('layout.items.reports'),
      comingSoon: true,
      icon: <BarChart3 className="h-4 w-4 shrink-0" strokeWidth={2} />,
    },
    {
      id: 'Team',
      label: t('layout.items.team'),
      path: '/team',
      ownerOnly: true,
      icon: <Users className="h-4 w-4 shrink-0" strokeWidth={2} />,
    },
    {
      id: 'Billing',
      label: t('layout.items.billing'),
      path: '/billing',
      ownerOnly: true,
      icon: <CreditCard className="h-4 w-4 shrink-0" strokeWidth={2} />,
    },
    {
      id: 'Settings',
      label: t('layout.items.settings'),
      path: '/business-setup',
      ownerOnly: true,
      icon: <Settings className="h-4 w-4 shrink-0" strokeWidth={2} />,
    },
  ]
    // STEP 5: menus follow the role (hiding only - the backend enforces).
    // Owner-only items for the owner; Upload only if plan ∩ role has the
    // document parser.
    .filter((item) => !item.ownerOnly || isOwner)
    .filter((item) => !item.feature || !role || effectiveFeatures.includes(item.feature))

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] flex flex-col transition-colors selection:bg-[var(--color-accent)] selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-[var(--color-card)]/90 backdrop-blur-md border-b border-[var(--color-border)] px-4 sm:px-6 py-2.5">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Mobile Drawer Trigger + Brand */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen((o) => !o)}
              aria-label={t('layout.openMenu')}
              className="lg:hidden p-2 text-[var(--color-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-bg-subtle)] rounded-xl transition-colors cursor-pointer"
            >
              {sidebarOpen ? <X className="h-5 w-5" strokeWidth={2} /> : <Menu className="h-5 w-5" strokeWidth={2} />}
            </button>

            <Link to="/dashboard" className="flex items-center shrink-0">
              {/* White chip wrapper preserves dark wordmark visibility in both light & dark themes */}
              <div className="shrink-0 flex items-center justify-center rounded-xl bg-white px-3 py-1.5 shadow-xs border border-stone-200/60 dark:border-transparent">
                <img src={logo} alt="MSME-BIOS" className="h-6 w-auto min-w-[96px] object-contain" />
              </div>
            </Link>
          </div>

          {/* Center: Search Bar (Visual) */}
          <div className="hidden md:flex items-center max-w-md w-full relative">
            <Search className="h-4 w-4 absolute left-3.5 text-[var(--color-muted)] pointer-events-none" strokeWidth={2} />
            <input
              type="text"
              placeholder={t('layout.search')}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] placeholder-[var(--color-muted)]/60 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent transition-all"
            />
          </div>

          {/* Right: Language, Theme, Bell, User Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSwitcher />
            <ThemeToggle />

            {/* Notification Bell */}
            <button
              aria-label={t('layout.notifications')}
              className="relative p-2 text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-subtle)] rounded-xl transition-colors cursor-pointer"
            >
              <Bell className="h-4.5 w-4.5" strokeWidth={2} />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[var(--color-accent)] ring-2 ring-[var(--color-card)]" />
            </button>

            {/* User Dropdown */}
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen((o) => !o)}
                className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-[var(--color-bg-subtle)] border border-transparent hover:border-[var(--color-border)] transition-all cursor-pointer"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-accent)] text-white font-bold text-xs shadow-xs">
                  {displayName[0]?.toUpperCase()}
                </div>
                <span className="hidden sm:block text-xs font-semibold text-[var(--color-text)] max-w-[110px] truncate">
                  {displayName}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-[var(--color-muted)]" strokeWidth={2} />
              </button>

              <AnimatePresence>
                {userDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute right-0 top-full mt-2 w-52 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-1.5 shadow-xl z-50"
                  >
                    <div className="px-3 py-2.5 border-b border-[var(--color-border)]">
                      <p className="text-xs font-bold truncate text-[var(--color-text)]">{displayName}</p>
                      <p className="text-[11px] text-[var(--color-muted)] truncate mt-0.5">{user?.email}</p>
                      {role && (
                        <span className="mt-1.5 inline-block rounded-md bg-[var(--color-accent-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-accent)]">
                          {tTeam(`roles.${role}`)}
                        </span>
                      )}
                    </div>
                    <div className="py-1">
                      {isOwner && (
                        <Link
                          to="/business-setup"
                          onClick={() => setUserDropdownOpen(false)}
                          className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-bg-subtle)] transition-colors"
                        >
                          <Settings className="h-3.5 w-3.5 text-[var(--color-muted)]" strokeWidth={2} />
                          <span>{t('layout.businessProfile')}</span>
                        </Link>
                      )}
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] transition-colors cursor-pointer"
                      >
                        <LogOut className="h-3.5 w-3.5" strokeWidth={2} />
                        <span>{t('layout.logOut')}</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      {/* Main Body with Sidebar */}
      <div className="flex flex-1">
        {/* Sidebar Overlay (Mobile) */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden"
            />
          )}
        </AnimatePresence>

        {/* Left Sidebar */}
        <aside
          className={`fixed lg:sticky top-[53px] z-40 h-[calc(100vh-53px)] w-64 shrink-0 bg-[var(--color-card)] border-r border-[var(--color-border)] p-4 flex flex-col justify-between transition-transform duration-300 lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="space-y-1">
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
              {t('layout.menu')}
            </p>
            {sidebarItems.map((item) => {
              const isActive = activeItem === item.id || (item.path && location.pathname === item.path)
              return (
                <div key={item.id} className="relative">
                  {item.comingSoon ? (
                    <div className="flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium text-[var(--color-muted)]/60 cursor-not-allowed">
                      <div className="flex items-center gap-3">
                        {item.icon}
                        <span>{item.label}</span>
                      </div>
                      <span className="rounded-md bg-[var(--color-bg-subtle)] border border-[var(--color-border)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--color-muted)]">
                        {t('layout.soon')}
                      </span>
                    </div>
                  ) : (
                    <Link
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors z-10 ${
                        isActive
                          ? 'text-[var(--color-accent)]'
                          : 'text-[var(--color-text)] hover:text-[var(--color-accent)] hover:bg-[var(--color-bg-subtle)]'
                      }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activeSidebarPill"
                          className="absolute inset-0 rounded-xl bg-[var(--color-accent-soft)] border-l-3 border-[var(--color-accent)] -z-10"
                          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                        />
                      )}
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  )}
                </div>
              )
            })}
          </div>

          {/* Footer Badge inside Sidebar */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3.5 text-center">
            <p className="text-[11px] font-bold text-[var(--color-text)]">MSME-BIOS v2.0</p>
            <p className="text-[10px] text-[var(--color-muted)] mt-0.5">{t('layout.footerTagline')}</p>
          </div>
        </aside>

        {/* Main Workspace Content */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
