import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { isLoggedIn, loading } = useAuth()

  // Wait for Firebase to restore the authentication session
  if (loading) {
    return null
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />
  }

  return children
}