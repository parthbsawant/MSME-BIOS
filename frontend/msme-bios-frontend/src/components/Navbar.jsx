import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ThemeToggle from './ThemeToggle'

export default function Navbar({ showNavLinks = false }) {
  const { user, isLoggedIn, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [resourcesOpen, setResourcesOpen] = useState(false)

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
    <header className="sticky top-0 z-40 bg-[#FBF3EC]/90 dark:bg-[#1A1714]/90 backdrop-blur-md border-b border-[#F0E4D8] dark:border-[#3A332A] transition-colors">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 py-3.5">
        
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E8622C] dark:bg-[#F27A4A] text-white shadow-md shadow-[#E8622C]/20 transition-transform group-hover:scale-105">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18" />
              <path d="m19 9-5 5-4-4-3 3" />
            </svg>
          </div>
          <span className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight text-[#2A2521] dark:text-[#F5EFE8]">
            MSME<span className="text-[#E8622C] dark:text-[#F27A4A]">-BIOS</span>
          </span>
        </Link>

        {/* Center Nav Links (Desktop) */}
        {showNavLinks && (
          <nav className="hidden items-center gap-7 text-sm font-medium md:flex">
            <a href={isLanding ? "#hero" : "/"} className="text-[#8A7F74] dark:text-[#A89E92] hover:text-[#E8622C] dark:hover:text-[#F27A4A] transition-colors">
              Home
            </a>
            <a href={isLanding ? "#features" : "/#features"} className="text-[#8A7F74] dark:text-[#A89E92] hover:text-[#E8622C] dark:hover:text-[#F27A4A] transition-colors">
              Features
            </a>
            <a href={isLanding ? "#how-it-works" : "/#how-it-works"} className="text-[#8A7F74] dark:text-[#A89E92] hover:text-[#E8622C] dark:hover:text-[#F27A4A] transition-colors">
              How it Works
            </a>
            <a href={isLanding ? "#pricing" : "/choose-plan"} className="text-[#8A7F74] dark:text-[#A89E92] hover:text-[#E8622C] dark:hover:text-[#F27A4A] transition-colors">
              Pricing
            </a>

            {/* Resources Dropdown */}
            <div className="relative">
              <button
                onClick={() => setResourcesOpen((o) => !o)}
                className="flex items-center gap-1 text-[#8A7F74] dark:text-[#A89E92] hover:text-[#E8622C] dark:hover:text-[#F27A4A] transition-colors py-1 cursor-pointer"
              >
                <span>Resources</span>
                <svg className={`h-4 w-4 transition-transform ${resourcesOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {resourcesOpen && (
                <div className="absolute left-0 top-full mt-2 w-52 rounded-xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] p-2 shadow-xl z-50">
                  <Link
                    to="/msme-guide"
                    onClick={() => setResourcesOpen(false)}
                    className="flex flex-col rounded-lg px-3 py-2 text-xs hover:bg-[#FBF3EC] dark:hover:bg-[#2D2820] transition-colors"
                  >
                    <span className="font-semibold text-[#2A2521] dark:text-[#F5EFE8]">MSME Registration Guide</span>
                    <span className="text-[#8A7F74] dark:text-[#A89E92]">Benefits & step-by-step process</span>
                  </Link>
                </div>
              )}
            </div>
          </nav>
        )}

        {/* Right Nav Action Area */}
        <div className="flex items-center gap-3">
          <ThemeToggle />

          {isLoggedIn ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 rounded-xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] px-3.5 py-1.5 text-xs font-medium text-[#2A2521] dark:text-[#F5EFE8] shadow-sm hover:border-[#E8622C]/40 dark:hover:border-[#F27A4A]/40 transition-all cursor-pointer"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#E8622C]/10 dark:bg-[#F27A4A]/20 text-[#E8622C] dark:text-[#F27A4A] font-bold text-xs">
                  {(user.displayName || user.email || 'U')[0].toUpperCase()}
                </div>
                <span className="max-w-[120px] truncate font-[family-name:var(--font-body)]">
                  {user.displayName || user.email}
                </span>
                <svg className="h-3.5 w-3.5 text-[#8A7F74]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] p-1.5 shadow-xl z-50">
                  <Link
                    to="/dashboard"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[#2A2521] dark:text-[#F5EFE8] hover:bg-[#FBF3EC] dark:hover:bg-[#2D2820] transition-colors"
                  >
                    <svg className="h-4 w-4 text-[#E8622C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>
                    Dashboard
                  </Link>
                  <Link
                    to="/upload"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[#2A2521] dark:text-[#F5EFE8] hover:bg-[#FBF3EC] dark:hover:bg-[#2D2820] transition-colors"
                  >
                    <svg className="h-4 w-4 text-[#E8622C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    Upload Document
                  </Link>
                  <div className="my-1 border-t border-[#F0E4D8] dark:border-[#3A332A]" />
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                to="/login"
                className="px-3 py-2 text-xs sm:text-sm font-medium text-[#2A2521] dark:text-[#F5EFE8] hover:text-[#E8622C] dark:hover:text-[#F27A4A] transition-colors"
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="rounded-xl bg-[#E8622C] dark:bg-[#F27A4A] px-4 py-2 text-xs sm:text-sm font-medium text-white shadow-sm shadow-[#E8622C]/20 hover:bg-[#D4531F] dark:hover:bg-[#E56938] transition-all transform active:scale-95"
              >
                Get Started
              </Link>
            </div>
          )}

          {/* Mobile menu hamburger button */}
          {showNavLinks && (
            <button
              onClick={() => setMobileNavOpen((o) => !o)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#F0E4D8] dark:border-[#3A332A] text-[#2A2521] dark:text-[#F5EFE8] md:hidden cursor-pointer"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {mobileNavOpen ? (
                  <path d="M18 6L6 18M6 6l12 12" />
                ) : (
                  <path d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Nav Drawer */}
      {showNavLinks && mobileNavOpen && (
        <div className="border-t border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] px-6 py-4 md:hidden space-y-3">
          <a href={isLanding ? "#hero" : "/"} onClick={() => setMobileNavOpen(false)} className="block text-sm font-medium text-[#2A2521] dark:text-[#F5EFE8]">Home</a>
          <a href={isLanding ? "#features" : "/#features"} onClick={() => setMobileNavOpen(false)} className="block text-sm font-medium text-[#2A2521] dark:text-[#F5EFE8]">Features</a>
          <a href={isLanding ? "#how-it-works" : "/#how-it-works"} onClick={() => setMobileNavOpen(false)} className="block text-sm font-medium text-[#2A2521] dark:text-[#F5EFE8]">How it Works</a>
          <a href={isLanding ? "#pricing" : "/choose-plan"} onClick={() => setMobileNavOpen(false)} className="block text-sm font-medium text-[#2A2521] dark:text-[#F5EFE8]">Pricing</a>
          <Link to="/msme-guide" onClick={() => setMobileNavOpen(false)} className="block text-sm font-medium text-[#E8622C] dark:text-[#F27A4A]">MSME Guide</Link>
        </div>
      )}
    </header>
  )
}
