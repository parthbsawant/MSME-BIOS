import {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react'

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
  onAuthStateChanged,
} from 'firebase/auth'

import { auth } from '../lib/firebase'

const AuthContext = createContext(null)

const googleProvider = new GoogleAuthProvider()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Firebase automatically restores the user's
  // authentication session after page reload.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)
    })

    return unsubscribe
  }, [])

  // Email + Password Signup
  const signup = async ({ name, email, password }) => {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    )

    const firebaseUser = userCredential.user

    // Store user's display name in Firebase.
    if (name?.trim()) {
      await updateProfile(firebaseUser, {
        displayName: name.trim(),
      })
    }

    // Refresh local user state.
    setUser({
      ...firebaseUser,
      displayName: name?.trim() || firebaseUser.displayName,
    })

    return firebaseUser
  }

  // Email + Password Login
  const login = async (email, password) => {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    )

    setUser(userCredential.user)

    return userCredential.user
  }

  // Google Login / Signup
  const loginWithGoogle = async () => {
    const userCredential = await signInWithPopup(
      auth,
      googleProvider
    )

    setUser(userCredential.user)

    return userCredential.user
  }

  // Logout
  const logout = async () => {
    await signOut(auth)

    // Clear existing MSME-BIOS local application state.
    localStorage.removeItem('msme-user')
    localStorage.removeItem('msme-business')
    localStorage.removeItem('msme-plan')
    localStorage.removeItem('msme-onboarded')

    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        loading,
        login,
        signup,
        loginWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error(
      'useAuth must be used within an AuthProvider'
    )
  }

  return context
}