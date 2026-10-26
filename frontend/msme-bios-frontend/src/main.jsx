import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import './index.css'
import './lib/i18n'
import App from './App.jsx'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { BusinessProvider } from './context/BusinessContext'
import { PlanProvider } from './context/PlanContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <AuthProvider>
          <BusinessProvider>
            <PlanProvider>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </PlanProvider>
          </BusinessProvider>
        </AuthProvider>
      </ThemeProvider>
    </MotionConfig>
  </StrictMode>,
)
