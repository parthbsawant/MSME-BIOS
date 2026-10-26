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
    if (!res.ok) {
      // STEP 4: a 403 carries a reason (e.g. "deactivated") the app shows.
      const body = await res.json().catch(() => ({}))
      const error = new Error(body.message || `Failed to load identity (${res.status})`)
      error.status = res.status
      error.code = body.error
      throw error
    }
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

async function postForm(path, fields) {
  const headers = await authHeader()
  const formData = new FormData()
  Object.entries(fields).forEach(([key, value]) => formData.append(key, value))
  const res = await fetch(`${API_URL}${path}`, { method: 'POST', headers, body: formData })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const error = new Error(body.message || `Request failed (${res.status})`)
    error.status = res.status
    error.code = body.error
    throw error
  }
  return body
}

/**
 * POST /api/checkout/order - starts checkout. Sends only WHAT was chosen;
 * the backend computes the amount (any price here would be ignored) and
 * saves the plan with a pending subscription.
 */
export async function createCheckoutOrder({ type, tierId, featureIds, extraSeats }) {
  const order = await postForm('/api/checkout/order', {
    plan_type: type,
    tier_id: tierId || '',
    feature_ids: (featureIds || []).join(','),
    extra_seats: String(extraSeats || 0),
  })
  clearMeCache()
  return order
}

/**
 * Pays an order with the MOCK provider: mock-pay plays the payment window
 * (returns payment_id + signature), then verify asks the backend to check
 * it - the only step that can activate the plan. outcome: 'success' | 'fail'.
 * Resolves to { status: 'active' | 'failed', paid }.
 */
export async function payWithMockProvider(orderId, outcome) {
  const payment = await postForm('/api/checkout/mock-pay', { order_id: orderId, outcome })
  const result = await postForm('/api/checkout/verify', {
    order_id: orderId,
    payment_id: payment.payment_id,
    signature: payment.signature || '',
  })
  clearMeCache()
  return result
}

async function getJson(path, { auth = true } = {}) {
  const headers = auth ? await authHeader() : {}
  const res = await fetch(`${API_URL}${path}`, { headers })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const error = new Error(body.message || `Request failed (${res.status})`)
    error.status = res.status
    error.code = body.error
    throw error
  }
  return body
}

// ---- STEP 4/5: team (owner only) ----

/** Members (owner first) and seats: { members, seats: { purchased, active_members, pending_invites, in_use } }. */
export const getTeam = () => getJson('/api/team/members')
export const listInvites = () => getJson('/api/team/invites').then((b) => b.invites)
export const getTeamActivity = () => getJson('/api/team/audit').then((b) => b.entries)

/** Returns the invite including its one-time `invite_path` (/invite/<token>). */
export const createInvite = (email, role) => postForm('/api/team/invites', { email, role })
export const revokeInvite = (inviteId) => postForm(`/api/team/invites/${inviteId}/revoke`, {})
export const changeMemberRole = (userId, role) => postForm(`/api/team/members/${userId}/role`, { role })
export const deactivateMember = (userId) => postForm(`/api/team/members/${userId}/deactivate`, {})
export const reactivateMember = (userId) => postForm(`/api/team/members/${userId}/reactivate`, {})

// ---- STEP 4/5: invites (invitee side) ----

/** Public: { business_name, role, email, status } for an invite link. */
export const previewInvite = (token) => getJson(`/api/invites/${encodeURIComponent(token)}`, { auth: false })

/** Joins the signed-in user to the inviting business. */
export async function acceptInvite(token) {
  const result = await postForm('/api/invites/accept', { token })
  clearMeCache()
  return result
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
 * GET /api/documents/{id} - one saved document, in the same shape
 * parseDocument() returns. Another business's document (or an unknown
 * id) is a 404, thrown with error.status = 404.
 */
export async function getDocument(documentId) {
  const headers = await authHeader()
  const res = await fetch(`${API_URL}/api/documents/${encodeURIComponent(documentId)}`, { headers })
  if (!res.ok) {
    const error = new Error(`Failed to load document (${res.status})`)
    error.status = res.status
    throw error
  }
  return res.json()
}

/**
 * POST /api/parse - parses a document. Note there is no tenant_id
 * field here at all, unlike the pre-Milestone-2 version of this call -
 * the backend resolves it from the auth token instead.
 */
export async function parseDocument(file, documentType, department) {
  const headers = await authHeader()
  const formData = new FormData()
  formData.append('file', file)
  formData.append('document_type', documentType)
  // Only the owner's choice counts; for members the backend always uses
  // their own department and ignores this.
  if (department) formData.append('department', department)

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
