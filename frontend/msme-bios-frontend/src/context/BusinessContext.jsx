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
  // STEP 5: who the user is in their business, from /api/me: role,
  // department, status, effectiveFeatures (plan ∩ role), invitePending.
  // null until known. `deactivated` is set when /api/me answers 403
  // deactivated. The backend enforces all of it; this only drives menus,
  // guards and screens.
  const [access, setAccess] = useState(null)
  const [deactivated, setDeactivated] = useState(false)

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
      setAccess(null)
      setDeactivated(false)
      setLoading(false)
      setLoadedFor(null)
      return
    }

    let cancelled = false
    const businessStorageKey = `msme-business-${uid}`
    const onboardedStorageKey = `msme-onboarded-${uid}`
    const accessStorageKey = `msme-access-${uid}`

    const readCache = () => {
      try {
        const parsed = JSON.parse(localStorage.getItem(businessStorageKey))
        const cachedAccess = JSON.parse(localStorage.getItem(accessStorageKey))
        // Caches written before Step 5 have no access entry: wait for the
        // backend once, so a member never briefly sees the owner's menu.
        const ok = parsed?.ownerUid === uid && localStorage.getItem(onboardedStorageKey) === 'true' && cachedAccess
        return ok ? { business: parsed, access: cachedAccess } : null
      } catch {
        return null
      }
    }

    const cached = readCache()
    setDeactivated(false)
    if (cached) {
      setBusiness(cached.business)
      setAccess(cached.access)
      setOnboarded(true)
      setLoading(false)
      setLoadedFor(uid)
    } else {
      setLoading(true)
    }

    getMe()
      .then((me) => {
        if (cancelled) return
        applyMe(me, uid)
      })
      .catch((err) => {
        if (cancelled) return
        if (err.code === 'deactivated') {
          clearCache(uid)
          setBusiness(null)
          setOnboarded(false)
          setAccess(null)
          setDeactivated(true)
          return
        }
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

  function clearCache(forUid) {
    localStorage.removeItem(`msme-business-${forUid}`)
    localStorage.removeItem(`msme-onboarded-${forUid}`)
    localStorage.removeItem(`msme-access-${forUid}`)
  }

  // Stores /api/me's business and access info in state and in the cache.
  function applyMe(me, forUid) {
    const nextAccess = {
      role: me.role ?? null,
      department: me.department ?? null,
      status: me.status ?? null,
      effectiveFeatures: me.effective_features ?? [],
      invitePending: Boolean(me.invite_pending),
    }
    setAccess(nextAccess)
    setDeactivated(false)
    localStorage.setItem(`msme-access-${forUid}`, JSON.stringify(nextAccess))

    if (me.business) {
      const fromServer = {
        businessName: me.business.business_name ?? '',
        ownerName: me.business.owner_name ?? '',
        type: me.business.business_type ?? '',
        turnover: me.business.annual_turnover ?? '',
        city: me.business.city ?? '',
        gstin: me.business.gstin ?? '',
        ownerUid: forUid,
      }
      localStorage.setItem(`msme-business-${forUid}`, JSON.stringify(fromServer))
      localStorage.setItem(`msme-onboarded-${forUid}`, 'true')
      setBusiness(fromServer)
      setOnboarded(true)
    } else {
      // The backend has no business for this user, so they are not
      // onboarded, whatever an old local cache says.
      localStorage.removeItem(`msme-business-${forUid}`)
      localStorage.removeItem(`msme-onboarded-${forUid}`)
      setBusiness(null)
      setOnboarded(false)
    }
  }

  // Re-reads business and access from the backend, e.g. right after
  // accepting an invite (the user now belongs to another business).
  const refreshBusiness = async () => {
    if (!uid) return
    const me = await getMe({ force: true })
    applyMe(me, uid)
    return me
  }

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
        refreshBusiness,
        // STEP 5 access info (see `access` above).
        role: access?.role ?? null,
        department: access?.department ?? null,
        effectiveFeatures: access?.effectiveFeatures ?? [],
        invitePending: access?.invitePending ?? false,
        // Unknown role (backend unreachable, nothing cached) is treated as
        // owner for display only; the backend still refuses non-owners.
        isOwner: (access?.role ?? 'owner') === 'owner',
        deactivated,
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