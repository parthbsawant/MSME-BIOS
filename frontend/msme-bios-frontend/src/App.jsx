import { Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import RequireOnboarded from './components/RequireOnboarded'
import LandingPage from './pages/LandingPage'
import MSMEGuidePage from './pages/MSMEGuidePage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import BusinessSetupPage from './pages/BusinessSetupPage'
import ChoosePlanPage from './pages/ChoosePlanPage'
import PlanSummaryPage from './pages/PlanSummaryPage'
import CustomBuilderPage from './pages/CustomBuilderPage'
import FeatureDashboardPage from './pages/FeatureDashboardPage'
import UploadPage from './pages/UploadPage'
import ResultsPage from './pages/ResultsPage'
import RedirectIfAuthenticated from './components/RedirectIfAuthenticated'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/msme-guide" element={<MSMEGuidePage />} />
      <Route
        path="/login"
        element={
          <RedirectIfAuthenticated>
            <LoginPage />
          </RedirectIfAuthenticated>
        }
      />
      <Route
        path="/signup"
        element={
          <RedirectIfAuthenticated>
            <SignupPage />
          </RedirectIfAuthenticated>
        }
      />
      <Route path="/business-setup" element={<ProtectedRoute><BusinessSetupPage /></ProtectedRoute>} />
      <Route path="/choose-plan" element={<ProtectedRoute><ChoosePlanPage /></ProtectedRoute>} />
      <Route path="/plan-summary/:tierId" element={<ProtectedRoute><PlanSummaryPage /></ProtectedRoute>} />
      <Route path="/custom-plan" element={<ProtectedRoute><CustomBuilderPage /></ProtectedRoute>} />
      <Route path="/dashboard" element={<RequireOnboarded><FeatureDashboardPage /></RequireOnboarded>} />
      <Route path="/upload" element={<RequireOnboarded><UploadPage /></RequireOnboarded>} />
      <Route path="/results" element={<RequireOnboarded><ResultsPage /></RequireOnboarded>} />
    </Routes>
  )
}
