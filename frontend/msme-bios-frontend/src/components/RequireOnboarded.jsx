import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useBusiness } from '../context/BusinessContext'
import { usePlan } from '../context/PlanContext'
import AuthLoadingScreen from './AuthLoadingScreen'

export default function RequireOnboarded({ children }) {
  const { isLoggedIn, loading } = useAuth()
  const { onboarded } = useBusiness()
  const { hasPlan } = usePlan()

  // Wait for Firebase to restore the authentication session
  if (loading) {
    return <AuthLoadingScreen />
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />
  }

  if (!onboarded) {
    return <Navigate to="/business-setup" replace />
  }

  if (!hasPlan) {
    return <Navigate to="/choose-plan" replace />
  }

  return children
}