import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useBusiness } from '../context/BusinessContext'
import { usePlan } from '../context/PlanContext'

// Guards any page that assumes onboarding is fully complete: logged in,
// business profile filled, and a plan chosen - in that order, so a user
// who skips a step gets sent back to exactly the right place, not just
// bounced to the start.
export default function RequireOnboarded({ children }) {
  const { isLoggedIn } = useAuth()
  const { onboarded } = useBusiness()
  const { hasPlan } = usePlan()

  if (!isLoggedIn) return <Navigate to="/login" replace />
  if (!onboarded) return <Navigate to="/business-setup" replace />
  if (!hasPlan) return <Navigate to="/choose-plan" replace />
  return children
}
