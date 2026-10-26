import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useBusiness } from '../context/BusinessContext'
import AuthLoadingScreen from './AuthLoadingScreen'
import AccessStatusScreen from './AccessStatusScreen'

// STEP 5: wraps owner-only screens (business setup, plans, checkout,
// billing, team). A team member is sent to the dashboard; a deactivated
// user or someone with a pending invite sees the matching status screen.
// Cosmetic only - the backend refuses non-owners on every one of these
// endpoints (403 owner_only). Use inside ProtectedRoute or RequireOnboarded.
export default function RequireOwner({ children }) {
  const { isLoggedIn, loading: authLoading } = useAuth()
  const { isOwner, deactivated, invitePending, loading } = useBusiness()

  if (authLoading || (isLoggedIn && loading)) return <AuthLoadingScreen />
  if (!isLoggedIn) return <Navigate to="/login" replace />
  if (deactivated) return <AccessStatusScreen kind="deactivated" />
  if (invitePending) return <AccessStatusScreen kind="invitePending" />
  if (!isOwner) return <Navigate to="/dashboard" replace />
  return children
}
