import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ThemeToggle from './ThemeToggle'

export default function Navbar({ showNavLinks = false }) {
  const { user, isLoggedIn, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => {
    try {
      await logout()
      setMenuOpen(false)
      navigate('/')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight">
          MSME-BIOS
        </Link>

        {showNavLinks && (
          <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
            <a href="#features" className="text-black/70 hover:text-black dark:text-white/70 dark:hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="text-black/70 hover:text-black dark:text-white/70 dark:hover:text-white transition-colors">Pricing</a>
          </nav>
        )}

        <div className="flex items-center gap-4">
          <ThemeToggle />

          {isLoggedIn ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 border border-black/20 dark:border-white/20 px-3 py-1.5 text-sm hover:border-black dark:hover:border-white transition-colors"
              >
                <span className="font-[family-name:var(--font-data)] text-xs">{user.name}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-40 border border-black/15 bg-white dark:border-white/15 dark:bg-black z-10">
                  <Link
                    to="/dashboard"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="block w-full px-4 py-2.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link to="/login" className="text-sm font-medium text-black/70 hover:text-black dark:text-white/70 dark:hover:text-white transition-colors">
                Log in
              </Link>
              <Link
                to="/signup"
                className="text-sm font-medium border border-black dark:border-white px-4 py-2 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
              >
                Sign up
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
