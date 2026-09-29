import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'

const BusinessContext = createContext(null)

export function BusinessProvider({ children }) {
  const { user } = useAuth()

  const [business, setBusiness] = useState(null)
  const [onboarded, setOnboarded] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)

    // No authenticated user → no business should be loaded.
    if (!user) {
      setBusiness(null)
      setOnboarded(false)
      setLoading(false)
      return
    }

    const businessStorageKey = `msme-business-${user.uid}`
    const onboardedStorageKey = `msme-onboarded-${user.uid}`

    const stored = localStorage.getItem(businessStorageKey)
    const storedOnboarded =
      localStorage.getItem(onboardedStorageKey) === 'true'

    if (!stored) {
      setBusiness(null)
      setOnboarded(false)
      setLoading(false)
      return
    }

    try {
      const parsed = JSON.parse(stored)

      // Only restore the business belonging to
      // the currently authenticated Firebase user.
      if (parsed?.ownerUid === user.uid && storedOnboarded) {
        setBusiness(parsed)
        setOnboarded(true)
      } else {
        setBusiness(null)
        setOnboarded(false)
      }
    } catch {
      setBusiness(null)
      setOnboarded(false)
    } finally {
      setLoading(false)
    }
  }, [user])

  const saveBusiness = (details) => {
    if (!user) {
      throw new Error('Cannot save business without an authenticated user')
    }

    const businessWithOwner = {
      ...details,
      ownerUid: user.uid,
    }

    const businessStorageKey = `msme-business-${user.uid}`
    const onboardedStorageKey = `msme-onboarded-${user.uid}`

    localStorage.setItem(
      businessStorageKey,
      JSON.stringify(businessWithOwner)
    )

    localStorage.setItem(onboardedStorageKey, 'true')

    setBusiness(businessWithOwner)
    setOnboarded(true)
  }

  return (
    <BusinessContext.Provider
      value={{
        business,
        hasBusinessProfile: !!business,
        onboarded,
        saveBusiness,
        loading,
      }}
    >
      {children}
    </BusinessContext.Provider>
  )
}

export function useBusiness() {
  const context = useContext(BusinessContext)

  if (!context) {
    throw new Error('useBusiness must be used within a BusinessProvider')
  }

  return context
}