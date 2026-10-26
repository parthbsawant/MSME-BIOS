// api.js — the one place that talks to the backend with a real,
// authenticated request. Every call here attaches the current user's
// real Firebase ID token as a Bearer header - this is what lets the
// backend resolve tenant_id server-side instead of trusting anything
// the client sends. Nothing in this file ever sends a tenant_id.

import { auth } from './firebase'

const API_URL = import.meta.env.VITE_API_URL

async function authHeader() {
  const user = auth.currentUser
  if (!user) {
    throw new Error('Not signed in - cannot call an authenticated endpoint without a user.')
  }
  const token = await user.getIdToken()
  return { Authorization: `Bearer ${token}` }
}

// GET /api/me is called by both BusinessContext and PlanContext when the
// app loads. Sharing one in-flight/recent request means that's one call
// to the backend (which can be slow right after Render wakes up), not
// two. Saving a business or plan clears it so the next read is fresh.
const ME_REUSE_MS = 5000
let meCache = { uid: null, promise: null, at: 0 }

function clearMeCache() {
  meCache = { uid: null, promise: null, at: 0 }
}

/**
 * GET /api/me - the authenticated identity, the resolved tenant context,
 * and this tenant's saved `business` and `plan` (each null if not saved
 * yet). This is the source of truth for "has onboarding been finished",
 * so it works on any browser or device, not just the one that did it.
 */
export function getMe({ force = false } = {}) {
  const uid = auth.currentUser?.uid ?? null
  const fresh = Date.now() - meCache.at < ME_REUSE_MS
  if (!force && meCache.promise && meCache.uid === uid && fresh) {
    return meCache.promise
  }

  const promise = (async () => {
    const headers = await authHeader()
    const res = await fetch(`${API_URL}/api/me`, { headers })
    if (!res.ok) throw new Error(`Failed to load identity (${res.status})`)
    return res.json()
  })()

  meCache = { uid, promise, at: Date.now() }
  // A failed request must not be reused - the next caller should retry.
  promise.catch(() => {
    if (meCache.promise === promise) clearMeCache()
  })
  return promise
}

/** POST /api/business - persists the business profile server-side. */
export async function saveBusiness(details) {
  const headers = await authHeader()
  const formData = new FormData()
  formData.append('business_name', details.businessName)
  formData.append('owner_name', details.ownerName)
  if (details.type) formData.append('business_type', details.type)
  if (details.turnover) formData.append('annual_turnover', details.turnover)
  if (details.city) formData.append('city', details.city)
  if (details.gstin) formData.append('gstin', details.gstin)

  const res = await fetch(`${API_URL}/api/business`, { method: 'POST', headers, body: formData })
  if (!res.ok) throw new Error(`Failed to save business (${res.status})`)
  clearMeCache()
  return res.json()
}

/** POST /api/plan - persists the plan selection server-side. */
export async function savePlan({ type, tierId, featureIds, price }) {
  const headers = await authHeader()
  const formData = new FormData()
  formData.append('plan_type', type)
  if (tierId) formData.append('tier_id', tierId)
  formData.append('feature_ids', featureIds.join(','))
  formData.append('price', String(price))

  const res = await fetch(`${API_URL}/api/plan`, { method: 'POST', headers, body: formData })
  if (!res.ok) throw new Error(`Failed to save plan (${res.status})`)
  clearMeCache()
  return res.json()
}

/**
 * GET /api/documents - this business's saved documents, newest first
 * (summaries: type, file, department, item_count, total, created_at).
 */
export async function listDocuments() {
  const headers = await authHeader()
  const res = await fetch(`${API_URL}/api/documents`, { headers })
  if (!res.ok) throw new Error(`Failed to load documents (${res.status})`)
  const body = await res.json()
  return body.documents
}

/**
 * POST /api/parse - parses a document. Note there is no tenant_id
 * field here at all, unlike the pre-Milestone-2 version of this call -
 * the backend resolves it from the auth token instead.
 */
export async function parseDocument(file, documentType) {
  const headers = await authHeader()
  const formData = new FormData()
  formData.append('file', file)
  formData.append('document_type', documentType)

  const res = await fetch(`${API_URL}/api/parse`, { method: 'POST', headers, body: formData })
  const body = await res.json()
  if (!res.ok) {
    const error = new Error(body.message || `Parse request failed (${res.status})`)
    error.status = res.status
    error.code = body.error
    throw error
  }
  return body
}
