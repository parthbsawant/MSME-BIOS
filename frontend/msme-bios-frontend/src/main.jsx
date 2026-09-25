import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { BusinessProvider } from './context/BusinessContext'
import { PlanProvider } from './context/PlanContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
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
  </StrictMode>,
)
