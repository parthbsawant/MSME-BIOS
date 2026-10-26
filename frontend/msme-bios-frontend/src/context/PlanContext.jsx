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
import { getMe } from '../lib/api'
import { TIERS, FEATURES } from '../lib/featuresData'

const PlanContext = createContext(null)

export function PlanProvider({ children }) {
  const { user } = useAuth()
  const uid = user?.uid

  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  // Which uid `plan` belongs to (null = signed out) - same refresh race
  // as in BusinessContext; without it a refresh could redirect a user
  // who has a plan to /choose-plan.
  const [loadedFor, setLoadedFor] = useState(undefined)

  // Same approach as BusinessContext: the database (via /api/me) is the
  // source of truth for the saved plan; localStorage is a fast cache that
  // is used immediately if present, and as a fallback if the backend
  // can't be reached.
  useEffect(() => {
    // No authenticated user → no plan should be loaded.
    if (!uid) {
      setPlan(null)
      setLoading(false)
      setLoadedFor(null)
      return
    }

    let cancelled = false
    const planStorageKey = `msme-plan-${uid}`

    let cached = null
    try {
      cached = JSON.parse(localStorage.getItem(planStorageKey))
    } catch {
      cached = null
    }

    if (cached) {
      setPlan(cached)
      setLoading(false)
      setLoadedFor(uid)
    } else {
      setLoading(true)
    }

    getMe()
      .then((me) => {
        if (cancelled) return
        if (me.plan) {
          const fromServer = {
            type: me.plan.plan_type,
            featureIds: me.plan.feature_ids,
            price: me.plan.price,
            ...(me.plan.plan_type === 'tier' ? { tierId: me.plan.tier_id } : {}),
          }
          localStorage.setItem(planStorageKey, JSON.stringify(fromServer))
          setPlan(fromServer)
        } else {
          localStorage.removeItem(planStorageKey)
          setPlan(null)
        }
      })
      .catch((err) => {
        console.error('Could not load plan from the backend:', err)
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
          setLoadedFor(uid)
        }
      })

    return () => {
      cancelled = true
    }
  }, [uid])

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
        loading: loading || loadedFor !== (uid ?? null),
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