import { useState } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, AlertCircle } from 'lucide-react'
import Navbar from '../components/Navbar'
import { usePlan } from '../context/PlanContext'
import { TIERS, EXTRA_SEAT_PRICE, formatPrice } from '../lib/featuresData'
import { useCatalog } from '../lib/useCatalog'
import { createCheckoutOrder } from '../lib/api'
import SeatStepper from '../components/SeatStepper'

export default function PlanSummaryPage() {
  const { tierId } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation('onboarding')
  const { t: tb } = useTranslation('billing')
  const { refreshPlan, isPaid } = usePlan()
  const { featureName, featureTagline, tierName, tierBand } = useCatalog()
  const tier = TIERS.find((t) => t.id === tierId)
  const [extraSeats, setExtraSeats] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (!tier) return <Navigate to="/choose-plan" replace />
  // Plan changes for a paid business are a later step (backend says 409).
  if (isPaid) return <Navigate to="/billing" replace />

  const total = tier.price + extraSeats * EXTRA_SEAT_PRICE

  // STEP 3: confirming no longer activates the plan - it starts checkout.
  // The backend computes the amount; the total shown here is display only.
  const handleConfirm = async () => {
    setError('')
    setSaving(true)
    try {
      await createCheckoutOrder({ type: 'tier', tierId: tier.id, extraSeats })
      await refreshPlan()
      navigate('/checkout')
    } catch (err) {
      console.error('Failed to start checkout:', err)
      setError('orderError')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] text-[var(--color-ink)] transition-colors">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-10 md:py-14">
        <div className="rounded-3xl border border-[var(--color-line)] bg-[var(--color-surface)] p-6 sm:p-10 shadow-[var(--shadow-cool-md)]">
          <span className="inline-block rounded-full bg-[var(--color-accent-soft)] px-3 py-1 text-xs font-bold text-[var(--color-accent)]">
            {t('planSummary.badge')}
          </span>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--color-ink)]">
            {t('planSummary.title', { name: tierName(tier.id) })}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[var(--color-muted)]">{tierBand(tier.id)}</p>

          {/* Pricing highlight card */}
          <div className="mt-6 flex flex-wrap items-baseline gap-2 bg-[var(--color-surface-2)] p-4 sm:p-5 rounded-2xl border border-[var(--color-line)]">
            <span
              data-tabular="true"
              className="font-[family-name:var(--font-display)] text-3xl font-extrabold text-[var(--color-accent)] tracking-tight transition-all"
            >
              {formatPrice(total)}
            </span>
            <span className="text-xs text-[var(--color-muted)] font-medium">
              {t('planSummary.perMonth')}
            </span>
            {extraSeats > 0 && (
              <span className="ml-auto text-[11px] text-[var(--color-muted)]">
                {formatPrice(tier.price)} +{' '}
                {tb('checkout.extraSeats', {
                  count: extraSeats,
                  price: formatPrice(EXTRA_SEAT_PRICE),
                })}
              </span>
            )}
          </div>

          <div className="mt-4">
            <SeatStepper
              included={tier.seatsIncluded}
              extra={extraSeats}
              onChange={setExtraSeats}
              disabled={saving}
            />
          </div>

          <div className="mt-6 space-y-3 border-t border-[var(--color-line-subtle)] pt-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink)]">
              {t('planSummary.includedFeatures', { count: tier.featureIds.length })}
            </h3>
            <ul className="space-y-2.5">
              {tier.featureIds.map((id) => {
                return (
                  <li
                    key={id}
                    className="flex items-start gap-3 rounded-xl bg-[var(--color-surface-2)]/50 p-3 border border-[var(--color-line-subtle)]"
                  >
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-success-soft)] text-[var(--color-success)] shrink-0 mt-0.5">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[var(--color-ink)]">{featureName(id)}</p>
                      <p className="text-[11px] text-[var(--color-muted)] mt-0.5">{featureTagline(id)}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="mt-6 rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] p-4 text-xs text-[var(--color-danger)] flex items-start gap-2.5"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" strokeWidth={2} />
                <span className="font-medium">{tb(error)}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-8 flex gap-3">
            <button
              type="button"
              onClick={() => navigate('/choose-plan')}
              disabled={saving}
              className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-6 py-3 text-xs font-bold text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)] transition-colors disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
              {t('planSummary.back')}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-6 py-3 text-xs font-bold text-white dark:text-[#0E1116] shadow-xs hover:bg-[var(--color-accent-hover)] transition-all transform active:scale-[0.98] disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
              {saving ? tb('preparing') : tb('continueToPayment')}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
