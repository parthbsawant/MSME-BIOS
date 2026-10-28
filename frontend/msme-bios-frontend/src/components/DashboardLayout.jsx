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
import Logo from './Logo'

const DEPARTMENT_COLORS = {
  finance: '#1E9E6E',
  sales: '#2F6FDE',
  hr: '#8A5CD6',
  marketing: '#E0457B',
}

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
      deptColor: DEPARTMENT_COLORS.sales,
      icon: <Upload className="h-4 w-4 shrink-0" strokeWidth={2} />,
    },
    {
      id: 'Documents',
      label: t('layout.items.documents'),
      path: '/results',
      deptColor: DEPARTMENT_COLORS.finance,
      icon: <FileText className="h-4 w-4 shrink-0" strokeWidth={2} />,
    },
    {
      id: 'Invoices',
      label: t('layout.items.invoices'),
      comingSoon: true,
      deptColor: DEPARTMENT_COLORS.finance,
      icon: <Receipt className="h-4 w-4 shrink-0" strokeWidth={2} />,
    },
    {
      id: 'Cash Flow',
      label: t('layout.items.cashFlow'),
      comingSoon: true,
      deptColor: DEPARTMENT_COLORS.finance,
      icon: <DollarSign className="h-4 w-4 shrink-0" strokeWidth={2} />,
    },
    {
      id: 'Reports',
      label: t('layout.items.reports'),
      comingSoon: true,
      deptColor: DEPARTMENT_COLORS.sales,
      icon: <BarChart3 className="h-4 w-4 shrink-0" strokeWidth={2} />,
    },
    {
      id: 'Team',
      label: t('layout.items.team'),
      path: '/team',
      ownerOnly: true,
      deptColor: DEPARTMENT_COLORS.hr,
      icon: <Users className="h-4 w-4 shrink-0" strokeWidth={2} />,
    },
    {
      id: 'Billing',
      label: t('layout.items.billing'),
      path: '/billing',
      ownerOnly: true,
      deptColor: DEPARTMENT_COLORS.finance,
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
    <div className="min-h-screen bg-[var(--color-canvas)] text-[var(--color-text)] flex flex-col transition-colors selection:bg-[var(--color-accent)] selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#151A21]/95 backdrop-blur-md border-b border-[var(--color-line)] dark:border-[#272F3A] px-4 sm:px-6 py-2.5 transition-colors">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Mobile Drawer Trigger + Brand */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen((o) => !o)}
              aria-label={t('layout.openMenu')}
              className="lg:hidden p-2 text-[var(--color-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface-2)] rounded-xl transition-colors cursor-pointer"
            >
              {sidebarOpen ? <X className="h-5 w-5" strokeWidth={2} /> : <Menu className="h-5 w-5" strokeWidth={2} />}
            </button>

            <Link
              to="/dashboard"
              className="flex items-center shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded-lg text-[var(--color-text)]"
            >
              <Logo size={30} showName={true} nameClassName="hidden sm:inline-flex" />
            </Link>
          </div>

          {/* Center: Search Bar (Visual) */}
          <div className="hidden md:flex items-center max-w-md w-full relative">
            <Search className="h-4 w-4 absolute left-3.5 text-[var(--color-muted)] pointer-events-none" strokeWidth={2} />
            <input
              type="text"
              placeholder={t('layout.search')}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-[var(--color-line)] dark:border-[#272F3A] bg-[var(--color-surface-2)] dark:bg-[#1C222B] text-[var(--color-text)] placeholder-[var(--color-muted)]/60 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent transition-all"
            />
          </div>

          {/* Right: Language, Theme, Bell, User Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSwitcher />
            <ThemeToggle />

            {/* Notification Bell */}
            <button
              aria-label={t('layout.notifications')}
              className="relative p-2 text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] rounded-xl transition-colors cursor-pointer"
            >
              <Bell className="h-4.5 w-4.5" strokeWidth={2} />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[var(--color-accent)] ring-2 ring-white dark:ring-[#151A21]" />
            </button>

            {/* User Dropdown */}
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen((o) => !o)}
                className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-[var(--color-surface-2)] border border-transparent hover:border-[var(--color-line)] transition-all cursor-pointer"
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
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute right-0 top-full mt-2 w-52 rounded-2xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-1.5 shadow-[var(--shadow-cool-lg)] z-50"
                  >
                    <div className="px-3 py-2.5 border-b border-[var(--color-line)] dark:border-[#272F3A]">
                      <p className="text-xs font-bold truncate text-[var(--color-text)]">{displayName}</p>
                      <p className="text-[11px] text-[var(--color-muted)] truncate mt-0.5">{user?.email}</p>
                      {role && (
                        <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-[var(--color-surface-2)] dark:bg-[#1C222B] px-2 py-0.5 text-[10px] font-bold text-[var(--color-text)]">
                          {DEPARTMENT_COLORS[role] && (
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: DEPARTMENT_COLORS[role] }}
                            />
                          )}
                          <span>{tTeam(`roles.${role}`)}</span>
                        </div>
                      )}
                    </div>
                    <div className="py-1">
                      {isOwner && (
                        <Link
                          to="/business-setup"
                          onClick={() => setUserDropdownOpen(false)}
                          className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
                        >
                          <Settings className="h-3.5 w-3.5 text-[var(--color-muted)]" strokeWidth={2} />
                          <span>{t('layout.businessProfile')}</span>
                        </Link>
                      )}
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-[var(--color-danger)] hover:bg-[var(--color-tint-rose)] transition-colors cursor-pointer"
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
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
            />
          )}
        </AnimatePresence>

        {/* Left Sidebar - F1 Dark Block */}
        <aside
          className={`fixed lg:sticky top-[53px] z-40 h-[calc(100vh-53px)] w-64 shrink-0 bg-[#0D1526] dark:bg-[#10141B] border-r border-[#223152] dark:border-[#272F3A] p-4 flex flex-col justify-between transition-transform duration-350 ease-out lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="space-y-1">
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-[#5A667A]">
              {t('layout.menu')}
            </p>
            {sidebarItems.map((item) => {
              const isActive = activeItem === item.id || (item.path && location.pathname === item.path)
              return (
                <div key={item.id} className="relative">
                  {item.comingSoon ? (
                    <div className="flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium text-[#5A667A] cursor-not-allowed">
                      <div className="flex items-center gap-3">
                        <span className="opacity-70">{item.icon}</span>
                        <span>{item.label}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {item.deptColor && (
                          <span
                            className="h-1.5 w-1.5 rounded-full shrink-0 opacity-60"
                            style={{ backgroundColor: item.deptColor }}
                          />
                        )}
                        <span className="rounded-md bg-[#141F38] border border-[#223152] px-1.5 py-0.5 text-[9px] font-semibold text-[#A3B1C9]">
                          {t('layout.soon')}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <Link
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={`relative flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition-all duration-300 ease-out z-10 ${
                        isActive
                          ? 'text-white'
                          : 'text-[#A3B1C9] hover:text-[#F2F6FF] hover:bg-[#141F38]'
                      }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activeSidebarPill"
                          className="absolute inset-0 rounded-xl bg-[var(--color-accent)] -z-10 shadow-sm"
                          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                        />
                      )}
                      <div className="flex items-center gap-3">
                        {item.icon}
                        <span>{item.label}</span>
                      </div>
                      {item.deptColor && (
                        <span
                          className={`h-1.5 w-1.5 rounded-full shrink-0 shadow-xs ${
                            isActive ? 'ring-2 ring-white/30' : ''
                          }`}
                          style={{ backgroundColor: item.deptColor }}
                        />
                      )}
                    </Link>
                  )}
                </div>
              )
            })}
          </div>

          {/* Footer Badge inside Sidebar */}
          <div className="rounded-2xl border border-[#223152] bg-[#141F38] p-3.5 text-center">
            <p className="text-[11px] font-bold text-[#F2F6FF]">MSME-BIOS v2.0</p>
            <p className="text-[10px] text-[#A3B1C9] mt-0.5">{t('layout.footerTagline')}</p>
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
