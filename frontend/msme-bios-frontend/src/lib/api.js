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

/** GET /api/me - the authenticated identity + resolved tenant context. */
export async function getMe() {
  const headers = await authHeader()
  const res = await fetch(`${API_URL}/api/me`, { headers })
  if (!res.ok) throw new Error(`Failed to load identity (${res.status})`)
  return res.json()
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
  return res.json()
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
