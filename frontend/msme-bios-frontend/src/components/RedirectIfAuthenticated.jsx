import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AuthLoadingScreen from './AuthLoadingScreen'

export default function RedirectIfAuthenticated({ children }) {
  const { isLoggedIn, loading } = useAuth()

  if (loading) {
    return <AuthLoadingScreen />
  }

  if (isLoggedIn) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}