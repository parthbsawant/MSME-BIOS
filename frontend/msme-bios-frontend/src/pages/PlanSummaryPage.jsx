import { useState } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { usePlan } from '../context/PlanContext'
import { TIERS, featureById, formatPrice } from '../lib/featuresData'
import { savePlan as savePlanToBackend } from '../lib/api'

export default function PlanSummaryPage() {
  const { tierId } = useParams()
  const navigate = useNavigate()
  const { selectTier } = usePlan()
  const tier = TIERS.find((t) => t.id === tierId)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (!tier) return <Navigate to="/choose-plan" replace />

  const handleConfirm = async () => {
    setError('')
    setSaving(true)
    try {
      // MILESTONE 2: persists to the backend, scoped to the resolved
      // tenant - same pattern as business setup.
      await savePlanToBackend({ type: 'tier', tierId: tier.id, featureIds: tier.featureIds, price: tier.price })
      selectTier(tier.id)
      navigate('/dashboard')
    } catch (err) {
      console.error('Failed to save plan:', err)
      setError('Couldn\u2019t save your plan. Check that the backend is running, then try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-white text-black dark:bg-black dark:text-white transition-colors">
      <Navbar />
      <main className="mx-auto max-w-xl px-6 py-14">
        <p className="font-[family-name:var(--font-data)] text-xs text-black/40 dark:text-white/40">Plan summary</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">{tier.name}</h1>
        <p className="mt-1 text-sm text-black/50 dark:text-white/50">{tier.band}</p>

        <p className="mt-8 font-[family-name:var(--font-data)] text-3xl">
          {formatPrice(tier.price)}<span className="text-base text-black/40 dark:text-white/40">/mo</span>
        </p>

        <div className="mt-8 border-t border-black/10 dark:border-white/10 pt-6">
          <p className="text-sm font-medium">Includes</p>
          <ul className="mt-4 space-y-3">
            {tier.featureIds.map((id) => {
              const f = featureById(id)
              return (
                <li key={id} className="flex items-start justify-between gap-4 border-b border-black/10 dark:border-white/10 pb-3">
                  <div>
                    <p className="text-sm font-medium">{f.name}</p>
                    <p className="text-xs text-black/50 dark:text-white/50">{f.tagline}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>

        {error && (
          <div className="mt-6 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="mt-8 flex gap-3">
          <button
            onClick={() => navigate('/choose-plan')}
            disabled={saving}
            className="border border-black/20 dark:border-white/20 px-5 py-2.5 text-sm font-medium hover:border-black dark:hover:border-white transition-colors disabled:opacity-50"
          >
            Back
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="flex-1 bg-black px-5 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-black hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving\u2026' : 'Confirm and continue'}
          </button>
        </div>
      </main>
    </div>
  )
}
