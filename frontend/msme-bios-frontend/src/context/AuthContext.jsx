import { createContext, useContext, useState } from 'react'

// Fake auth - no real backend yet. localStorage persists the session the
// same way a cookie would (survives reload, doesn't touch a server).
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('msme-user')
    return stored ? JSON.parse(stored) : null
  })

  const signup = ({ name, email, businessName }) => {
    const fakeUser = { name, email, businessName, joinedAt: new Date().toISOString() }
    localStorage.setItem('msme-user', JSON.stringify(fakeUser))
    setUser(fakeUser)
  }

  const login = (name) => {
    const fakeUser = { name, loggedInAt: new Date().toISOString() }
    localStorage.setItem('msme-user', JSON.stringify(fakeUser))
    setUser(fakeUser)
  }

  const logout = () => {
    localStorage.removeItem('msme-user')
    localStorage.removeItem('msme-business')
    localStorage.removeItem('msme-plan')
    localStorage.removeItem('msme-onboarded')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isLoggedIn: !!user, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
