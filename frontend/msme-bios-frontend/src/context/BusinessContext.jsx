import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { getMe } from '../lib/api'

const BusinessContext = createContext(null)

export function BusinessProvider({ children }) {
  const { user } = useAuth()
  const uid = user?.uid

  const [business, setBusiness] = useState(null)
  const [onboarded, setOnboarded] = useState(false)
  const [loading, setLoading] = useState(true)
  // Which uid the state above belongs to (null = signed out). On a page
  // refresh, Firebase restores the user in the same render where this
  // context still holds its signed-out state; the effect below only runs
  // AFTER that render. Without this, RequireOnboarded saw "not onboarded"
  // for that one render and redirected a registered user to
  // /business-setup. Reporting loading until loadedFor matches the
  // current uid closes that gap.
  const [loadedFor, setLoadedFor] = useState(undefined)

  // The database (via /api/me) is the source of truth for "has this
  // user finished onboarding" - so it works on a new browser or device.
  // localStorage is now only a fast cache: if it has this user's
  // business, we show the app immediately and confirm with the backend
  // in the background; if not, we wait for the backend's answer. If the
  // backend can't be reached, the cache is used so a brief outage
  // doesn't lock a registered user out.
  useEffect(() => {
    // No authenticated user → no business should be loaded.
    if (!uid) {
      setBusiness(null)
      setOnboarded(false)
      setLoading(false)
      setLoadedFor(null)
      return
    }

    let cancelled = false
    const businessStorageKey = `msme-business-${uid}`
    const onboardedStorageKey = `msme-onboarded-${uid}`

    const readCache = () => {
      try {
        const parsed = JSON.parse(localStorage.getItem(businessStorageKey))
        const ok = parsed?.ownerUid === uid && localStorage.getItem(onboardedStorageKey) === 'true'
        return ok ? parsed : null
      } catch {
        return null
      }
    }

    const cached = readCache()
    if (cached) {
      setBusiness(cached)
      setOnboarded(true)
      setLoading(false)
      setLoadedFor(uid)
    } else {
      setLoading(true)
    }

    getMe()
      .then((me) => {
        if (cancelled) return
        if (me.business) {
          const fromServer = {
            businessName: me.business.business_name ?? '',
            ownerName: me.business.owner_name ?? '',
            type: me.business.business_type ?? '',
            turnover: me.business.annual_turnover ?? '',
            city: me.business.city ?? '',
            gstin: me.business.gstin ?? '',
            ownerUid: uid,
          }
          localStorage.setItem(businessStorageKey, JSON.stringify(fromServer))
          localStorage.setItem(onboardedStorageKey, 'true')
          setBusiness(fromServer)
          setOnboarded(true)
        } else {
          // The backend has no business for this user, so they are not
          // onboarded, whatever an old local cache says.
          localStorage.removeItem(businessStorageKey)
          localStorage.removeItem(onboardedStorageKey)
          setBusiness(null)
          setOnboarded(false)
        }
      })
      .catch((err) => {
        // Backend unreachable: keep whatever the cache gave us.
        console.error('Could not load business from the backend:', err)
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
        loading: loading || loadedFor !== (uid ?? null),
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