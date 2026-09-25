import { createContext, useContext, useState } from 'react'

const BusinessContext = createContext(null)

export function BusinessProvider({ children }) {
  const [business, setBusiness] = useState(() => {
    const stored = localStorage.getItem('msme-business')
    return stored ? JSON.parse(stored) : null
  })
  const [onboarded, setOnboarded] = useState(() => localStorage.getItem('msme-onboarded') === 'true')

  const saveBusiness = (details) => {
    localStorage.setItem('msme-business', JSON.stringify(details))
    localStorage.setItem('msme-onboarded', 'true')
    setBusiness(details)
    setOnboarded(true)
  }

  return (
    <BusinessContext.Provider value={{ business, hasBusinessProfile: !!business, onboarded, saveBusiness }}>
      {children}
    </BusinessContext.Provider>
  )
}

export function useBusiness() {
  const context = useContext(BusinessContext)
  if (!context) throw new Error('useBusiness must be used within a BusinessProvider')
  return context
}
