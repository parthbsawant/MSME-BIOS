import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from 'react-i18next'
import ThemeToggle from './ThemeToggle'
import LanguageSwitcher from './LanguageSwitcher'
import logo from '../assets/logo.png'

export default function DashboardLayout({ children, activeItem = 'Dashboard' }) {
  const { user, logout } = useAuth()
  const { t } = useTranslation('dashboard')
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
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
        </svg>
      ),
    },
    {
      id: 'Upload Document',
      label: t('layout.items.upload'),
      path: '/upload',
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      ),
    },
    {
      id: 'Documents',
      label: t('layout.items.documents'),
      path: '/results',
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      ),
    },
    {
      id: 'Invoices',
      label: t('layout.items.invoices'),
      comingSoon: true,
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <line x1="6" y1="8" x2="10" y2="8" />
          <line x1="6" y1="12" x2="18" y2="12" />
          <line x1="6" y1="16" x2="14" y2="16" />
        </svg>
      ),
    },
    {
      id: 'Cash Flow',
      label: t('layout.items.cashFlow'),
      comingSoon: true,
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      ),
    },
    {
      id: 'Reports',
      label: t('layout.items.reports'),
      comingSoon: true,
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 20V10" />
          <path d="M12 20V4" />
          <path d="M6 20v-6" />
        </svg>
      ),
    },
    {
      id: 'Settings',
      label: t('layout.items.settings'),
      path: '/business-setup',
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
    },
  ]

  return (
    <div className="min-h-screen bg-[#FBF3EC] dark:bg-[#1A1714] text-[#2A2521] dark:text-[#F5EFE8] flex flex-col transition-colors">
      
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-[#FFFFFF]/90 dark:bg-[#242019]/90 backdrop-blur-md border-b border-[#F0E4D8] dark:border-[#3A332A] px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          
          {/* Left: Mobile Drawer Trigger + Brand */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen((o) => !o)}
              aria-label={t('layout.openMenu')}
              className="lg:hidden p-2 text-[#8A7F74] hover:text-[#E8622C] rounded-lg transition-colors cursor-pointer"
            >
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <Link to="/dashboard" className="flex items-center">
              {/* Same light-chip treatment as the public Navbar - the
                  logo's black text would be near-invisible directly on
                  the dark-mode sidebar background otherwise. */}
              <div className="rounded-lg bg-white px-2 py-1 dark:shadow-md">
                <img src={logo} alt="MSME-BIOS" className="h-6 w-auto" />
              </div>
            </Link>
          </div>

          {/* Center: Search Bar (Visual) */}
          <div className="hidden md:flex items-center max-w-md w-full relative">
            <svg className="h-4 w-4 absolute left-3.5 text-[#8A7F74] dark:text-[#A89E92]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder={t('layout.search')}
              className="w-full pl-10 pr-4 py-1.5 text-xs rounded-xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FBF3EC] dark:bg-[#1A1714] text-[#2A2521] dark:text-[#F5EFE8] placeholder-[#8A7F74]/60 dark:placeholder-[#A89E92]/60 focus:outline-none focus:border-[#E8622C] dark:focus:border-[#F27A4A] transition-colors"
            />
          </div>

          {/* Right: Theme Toggle, Bell, User Profile */}
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <ThemeToggle />

            {/* Notification Bell */}
            <button aria-label={t('layout.notifications')} className="relative p-2 text-[#8A7F74] dark:text-[#A89E92] hover:text-[#E8622C] dark:hover:text-[#F27A4A] rounded-xl hover:bg-[#FBF3EC] dark:hover:bg-[#1A1714] transition-colors cursor-pointer">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#E8622C] dark:bg-[#F27A4A]" />
            </button>

            {/* User Dropdown */}
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen((o) => !o)}
                className="flex items-center gap-2 p-1 rounded-xl hover:bg-[#FBF3EC] dark:hover:bg-[#1A1714] transition-colors cursor-pointer"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E8622C] dark:bg-[#F27A4A] text-white font-bold text-xs shadow-sm">
                  {displayName[0]?.toUpperCase()}
                </div>
                <span className="hidden sm:block text-xs font-semibold text-[#2A2521] dark:text-[#F5EFE8] max-w-[100px] truncate">
                  {displayName}
                </span>
                <svg className="h-3.5 w-3.5 text-[#8A7F74]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] p-1.5 shadow-xl z-50">
                  <div className="px-3 py-2 border-b border-[#F0E4D8] dark:border-[#3A332A]">
                    <p className="text-xs font-bold truncate text-[#2A2521] dark:text-[#F5EFE8]">{displayName}</p>
                    <p className="text-[10px] text-[#8A7F74] dark:text-[#A89E92] truncate">{user?.email}</p>
                  </div>
                  <Link
                    to="/business-setup"
                    onClick={() => setUserDropdownOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[#2A2521] dark:text-[#F5EFE8] hover:bg-[#FBF3EC] dark:hover:bg-[#2D2820] transition-colors"
                  >
                    {t('layout.businessProfile')}
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                  >
                    {t('layout.logOut')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Body with Sidebar */}
      <div className="flex flex-1">
        
        {/* Sidebar Overlay (Mobile) */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs lg:hidden"
          />
        )}

        {/* Left Sidebar */}
        <aside
          className={`fixed lg:sticky top-[57px] z-40 h-[calc(100vh-57px)] w-64 shrink-0 bg-[#FFFFFF] dark:bg-[#242019] border-r border-[#F0E4D8] dark:border-[#3A332A] p-4 flex flex-col justify-between transition-transform duration-300 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="space-y-1">
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-[#8A7F74] dark:text-[#A89E92]">
              {t('layout.menu')}
            </p>
            {sidebarItems.map((item) => {
              const isActive = activeItem === item.id || (item.path && location.pathname === item.path)
              return (
                <div key={item.id}>
                  {item.comingSoon ? (
                    <div className="flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium text-[#8A7F74]/60 dark:text-[#A89E92]/60 cursor-not-allowed">
                      <div className="flex items-center gap-3">
                        {item.icon}
                        <span>{item.label}</span>
                      </div>
                      <span className="rounded-md bg-[#F3ECE5] dark:bg-[#2E2822] px-1.5 py-0.5 text-[9px] font-semibold text-[#8A7F74] dark:text-[#A89E92]">
                        {t('layout.soon')}
                      </span>
                    </div>
                  ) : (
                    <Link
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-[#E8622C]/10 dark:bg-[#F27A4A]/15 text-[#E8622C] dark:text-[#F27A4A] border-l-4 border-[#E8622C] dark:border-[#F27A4A]'
                          : 'text-[#2A2521] dark:text-[#F5EFE8] hover:bg-[#FBF3EC] dark:hover:bg-[#2D2820] hover:text-[#E8622C] dark:hover:text-[#F27A4A]'
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  )}
                </div>
              )
            })}
          </div>

          {/* Footer Badge inside Sidebar */}
          <div className="rounded-xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FBF3EC] dark:bg-[#1A1714] p-3 text-center">
            <p className="text-[11px] font-bold text-[#2A2521] dark:text-[#F5EFE8]">MSME-BIOS v2.0</p>
            <p className="text-[10px] text-[#8A7F74] dark:text-[#A89E92] mt-0.5">{t('layout.footerTagline')}</p>
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
