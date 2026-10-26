import { Routes, Route } from 'react-router-dom'
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
import CheckoutPage from './pages/CheckoutPage'
import BillingPage from './pages/BillingPage'
import RedirectIfAuthenticated from './components/RedirectIfAuthenticated'
import RequireOwner from './components/RequireOwner'
import AcceptInvitePage from './pages/AcceptInvitePage'
import TeamPage from './pages/TeamPage'

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
      {/* STEP 5: public invite link; owner-only screens wrapped in RequireOwner */}
      <Route path="/invite/:token" element={<AcceptInvitePage />} />
      <Route path="/business-setup" element={<RequireOwner><BusinessSetupPage /></RequireOwner>} />
      <Route path="/choose-plan" element={<RequireOwner><ChoosePlanPage /></RequireOwner>} />
      <Route path="/plan-summary/:tierId" element={<RequireOwner><PlanSummaryPage /></RequireOwner>} />
      <Route path="/custom-plan" element={<RequireOwner><CustomBuilderPage /></RequireOwner>} />
      <Route path="/dashboard" element={<RequireOnboarded><FeatureDashboardPage /></RequireOnboarded>} />
      <Route path="/upload" element={<RequireOnboarded><UploadPage /></RequireOnboarded>} />
      <Route path="/checkout" element={<RequireOwner><CheckoutPage /></RequireOwner>} />
      <Route path="/billing" element={<RequireOnboarded><RequireOwner><BillingPage /></RequireOwner></RequireOnboarded>} />
      <Route path="/team" element={<RequireOnboarded><RequireOwner><TeamPage /></RequireOwner></RequireOnboarded>} />
      <Route path="/results" element={<RequireOnboarded><ResultsPage /></RequireOnboarded>} />
      <Route path="/results/:documentId" element={<RequireOnboarded><ResultsPage /></RequireOnboarded>} />
    </Routes>
  )
}
