import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useBusiness } from '../context/BusinessContext'
import { usePlan } from '../context/PlanContext'
import AuthLoadingScreen from './AuthLoadingScreen'

export default function RequireOnboarded({ children }) {
  const { isLoggedIn, loading: authLoading } = useAuth()
  const { onboarded, loading: businessLoading } = useBusiness()
  const { hasPlan, loading: planLoading } = usePlan()

  // Wait for Firebase's session check AND both contexts' own localStorage
  // reads to finish - all three run as separate effects, so checking only
  // one (e.g. just auth) let a returning, fully-onboarded user briefly get
  // redirected to /business-setup or /choose-plan before "snapping back"
  // once the other two caught up. Waiting on all three removes that flash.
  if (authLoading || businessLoading || planLoading) {
    return <AuthLoadingScreen />
  }

  if (!isLoggedIn) return <Navigate to="/login" replace />
  if (!onboarded) return <Navigate to="/business-setup" replace />
  if (!hasPlan) return <Navigate to="/choose-plan" replace />
  return children
}