// import { createContext, useContext, useState } from 'react'

// // Fake auth - no real backend yet. localStorage persists the session the
// // same way a cookie would (survives reload, doesn't touch a server).
// const AuthContext = createContext(null)

// export function AuthProvider({ children }) {
//   const [user, setUser] = useState(() => {
//     const stored = localStorage.getItem('msme-user')
//     return stored ? JSON.parse(stored) : null
//   })

//   const signup = ({ name, email, businessName }) => {
//     const fakeUser = { name, email, businessName, joinedAt: new Date().toISOString() }
//     localStorage.setItem('msme-user', JSON.stringify(fakeUser))
//     setUser(fakeUser)
//   }

//   const login = (name) => {
//     const fakeUser = { name, loggedInAt: new Date().toISOString() }
//     localStorage.setItem('msme-user', JSON.stringify(fakeUser))
//     setUser(fakeUser)
//   }

//   const logout = () => {
//     localStorage.removeItem('msme-user')
//     localStorage.removeItem('msme-business')
//     localStorage.removeItem('msme-plan')
//     localStorage.removeItem('msme-onboarded')
//     setUser(null)
//   }

//   return (
//     <AuthContext.Provider value={{ user, isLoggedIn: !!user, login, signup, logout }}>
//       {children}
//     </AuthContext.Provider>
//   )
// }

// export function useAuth() {
//   const context = useContext(AuthContext)
//   if (!context) throw new Error('useAuth must be used within an AuthProvider')
//   return context
// }


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

  /*
   * Firebase automatically restores the user's
   * authentication session after page reload.
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)
    })

    return unsubscribe
  }, [])

  /*
   * Email + Password Signup
   */
  const signup = async ({ name, email, password }) => {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    )

    const firebaseUser = userCredential.user

    /*
     * Store the user's display name in Firebase.
     */
    if (name?.trim()) {
      await updateProfile(firebaseUser, {
        displayName: name.trim(),
      })
    }

    /*
     * Refresh local user state so displayName
     * is immediately available.
     */
    setUser({
      ...auth.currentUser,
      displayName: name?.trim() || firebaseUser.displayName,
    })

    return firebaseUser
  }

  /*
   * Email + Password Login
   */
  const login = async (email, password) => {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    )

    setUser(userCredential.user)

    return userCredential.user
  }

  /*
   * Google Login / Signup
   *
   * Firebase automatically handles whether
   * the Google account is new or already exists.
   */
  const loginWithGoogle = async () => {
    const userCredential = await signInWithPopup(
      auth,
      googleProvider
    )

    setUser(userCredential.user)

    return userCredential.user
  }

  /*
   * Logout
   */
  const logout = async () => {
    await signOut(auth)

    /*
     * Keep clearing the existing MSME-BIOS
     * local application state.
     */
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