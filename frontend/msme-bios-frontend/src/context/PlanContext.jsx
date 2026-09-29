// import { createContext, useContext, useState } from 'react'
// import { TIERS, FEATURES } from '../lib/featuresData'

// const PlanContext = createContext(null)

// export function PlanProvider({ children }) {
//   const [plan, setPlan] = useState(() => {
//     const stored = localStorage.getItem('msme-plan')
//     return stored ? JSON.parse(stored) : null
//   })

//   const selectTier = (tierId) => {
//     const tier = TIERS.find((t) => t.id === tierId)
//     const value = { type: 'tier', tierId, featureIds: tier.featureIds, price: tier.price }
//     localStorage.setItem('msme-plan', JSON.stringify(value))
//     setPlan(value)
//   }

//   const selectCustom = (featureIds) => {
//     const price = featureIds.reduce((sum, id) => {
//       const f = FEATURES.find((feat) => feat.id === id)
//       return sum + (f ? f.price : 0)
//     }, 0)
//     const value = { type: 'custom', featureIds, price }
//     localStorage.setItem('msme-plan', JSON.stringify(value))
//     setPlan(value)
//   }

//   return (
//     <PlanContext.Provider value={{ plan, hasPlan: !!plan, selectTier, selectCustom }}>
//       {children}
//     </PlanContext.Provider>
//   )
// }

// export function usePlan() {
//   const context = useContext(PlanContext)
//   if (!context) throw new Error('usePlan must be used within a PlanProvider')
//   return context
// }


import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { TIERS, FEATURES } from '../lib/featuresData'

const PlanContext = createContext(null)

export function PlanProvider({ children }) {
  const { user } = useAuth()

  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)

    // No authenticated user → no plan should be loaded.
    if (!user) {
      setPlan(null)
      setLoading(false)
      return
    }

    const planStorageKey = `msme-plan-${user.uid}`
    const stored = localStorage.getItem(planStorageKey)

    if (!stored) {
      setPlan(null)
      setLoading(false)
      return
    }

    try {
      const parsed = JSON.parse(stored)
      setPlan(parsed)
    } catch {
      setPlan(null)
    } finally {
      setLoading(false)
    }
  }, [user])

  const selectTier = (tierId) => {
    if (!user) {
      throw new Error('Cannot select a plan without an authenticated user')
    }

    const tier = TIERS.find((t) => t.id === tierId)

    if (!tier) {
      throw new Error(`Plan tier not found: ${tierId}`)
    }

    const value = {
      type: 'tier',
      tierId,
      featureIds: tier.featureIds,
      price: tier.price,
    }

    const planStorageKey = `msme-plan-${user.uid}`

    localStorage.setItem(
      planStorageKey,
      JSON.stringify(value)
    )

    setPlan(value)
  }

  const selectCustom = (featureIds) => {
    if (!user) {
      throw new Error('Cannot select a plan without an authenticated user')
    }

    const price = featureIds.reduce((sum, id) => {
      const f = FEATURES.find((feat) => feat.id === id)

      return sum + (f ? f.price : 0)
    }, 0)

    const value = {
      type: 'custom',
      featureIds,
      price,
    }

    const planStorageKey = `msme-plan-${user.uid}`

    localStorage.setItem(
      planStorageKey,
      JSON.stringify(value)
    )

    setPlan(value)
  }

  return (
    <PlanContext.Provider
      value={{
        plan,
        hasPlan: !!plan,
        selectTier,
        selectCustom,
        loading,
      }}
    >
      {children}
    </PlanContext.Provider>
  )
}

export function usePlan() {
  const context = useContext(PlanContext)

  if (!context) {
    throw new Error('usePlan must be used within a PlanProvider')
  }

  return context
}