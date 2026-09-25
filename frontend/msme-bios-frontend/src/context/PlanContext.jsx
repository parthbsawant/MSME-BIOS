import { createContext, useContext, useState } from 'react'
import { TIERS, FEATURES } from '../lib/featuresData'

const PlanContext = createContext(null)

export function PlanProvider({ children }) {
  const [plan, setPlan] = useState(() => {
    const stored = localStorage.getItem('msme-plan')
    return stored ? JSON.parse(stored) : null
  })

  const selectTier = (tierId) => {
    const tier = TIERS.find((t) => t.id === tierId)
    const value = { type: 'tier', tierId, featureIds: tier.featureIds, price: tier.price }
    localStorage.setItem('msme-plan', JSON.stringify(value))
    setPlan(value)
  }

  const selectCustom = (featureIds) => {
    const price = featureIds.reduce((sum, id) => {
      const f = FEATURES.find((feat) => feat.id === id)
      return sum + (f ? f.price : 0)
    }, 0)
    const value = { type: 'custom', featureIds, price }
    localStorage.setItem('msme-plan', JSON.stringify(value))
    setPlan(value)
  }

  return (
    <PlanContext.Provider value={{ plan, hasPlan: !!plan, selectTier, selectCustom }}>
      {children}
    </PlanContext.Provider>
  )
}

export function usePlan() {
  const context = useContext(PlanContext)
  if (!context) throw new Error('usePlan must be used within a PlanProvider')
  return context
}
