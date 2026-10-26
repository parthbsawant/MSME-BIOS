import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AuthLoadingScreen from './AuthLoadingScreen'
import { safeNext } from '../lib/nextPath'

export default function RedirectIfAuthenticated({ children }) {
  const { isLoggedIn, loading } = useAuth()
  const [searchParams] = useSearchParams()

  if (loading) {
    return <AuthLoadingScreen />
  }

  if (isLoggedIn) {
    // STEP 5: an invitee who signs in from an invite link goes back to it.
    return <Navigate to={safeNext(searchParams) ?? '/dashboard'} replace />
  }

  return children
}