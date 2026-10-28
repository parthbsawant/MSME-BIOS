import { useState, useEffect } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion'
import { ArrowLeft, Check, Plus } from 'lucide-react'
import Navbar from '../components/Navbar'
import { usePlan } from '../context/PlanContext'
import { FEATURES, CUSTOM_SEATS_INCLUDED, EXTRA_SEAT_PRICE, formatPrice } from '../lib/featuresData'
import { useCatalog } from '../lib/useCatalog'
import { createCheckoutOrder } from '../lib/api'
import SeatStepper from '../components/SeatStepper'

function AnimatedPrice({ value }) {
  const motionValue = useMotionValue(value)
  const rounded = useTransform(motionValue, (v) => formatPrice(Math.round(v)))

  useEffect(() => {
    const controls = animate(motionValue, value, { duration: 0.35, ease: [0.22, 1, 0.36, 1] })
    return controls.stop
  }, [value, motionValue])

  return <motion.span data-tabular="true">{rounded}</motion.span>
}

export default function CustomBuilderPage() {
  const navigate = useNavigate()
  const { t } = useTranslation('onboarding')
  const { t: tb } = useTranslation('billing')
  const { refreshPlan, isPaid } = usePlan()
  const { featureName, featureTagline } = useCatalog()
  const [selectedIds, setSelectedIds] = useState(['document_parser'])
  const [extraSeats, setExtraSeats] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toggleFeature = (id) => {
    const feature = FEATURES.find((f) => f.id === id)
    if (feature.locked) return
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  // Display only - the backend computes the real amount at checkout.
  const total =
    selectedIds.reduce((sum, id) => sum + FEATURES.find((f) => f.id === id).price, 0) +
    extraSeats * EXTRA_SEAT_PRICE

  // STEP 3: confirming starts checkout instead of activating the plan.
  const handleConfirm = async () => {
    setError('')
    setSaving(true)
    try {
      await createCheckoutOrder({ type: 'custom', featureIds: selectedIds, extraSeats })
      await refreshPlan()
      navigate('/checkout')
    } catch (err) {
      console.error('Failed to start checkout:', err)
      setError('orderError')
    } finally {
      setSaving(false)
    }
  }

  // Plan changes for a paid business are a later step (backend says 409).
  if (isPaid) return <Navigate to="/billing" replace />

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] text-[var(--color-ink)] transition-colors">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 md:py-14 pb-48">
        <button
          type="button"
          onClick={() => navigate('/choose-plan')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors cursor-pointer group"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" strokeWidth={2.5} />
          <span>{t('customBuilder.back')}</span>
        </button>

        <div className="mt-4 max-w-2xl">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-accent)]">
            {t('customBuilder.badge')}
          </span>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-tight text-[var(--color-ink)]">
            {t('customBuilder.title')}
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-[var(--color-muted)] leading-relaxed">
            {t('customBuilder.subtitle')}
          </p>
        </div>

        {/* Features Grid */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const isSelected = selectedIds.includes(f.id)
            return (
              <div
                key={f.id}
                className={`flex flex-col justify-between rounded-2xl border p-5 transition-all duration-200 ${
                  isSelected
                    ? 'border-[var(--color-accent)] bg-[var(--color-surface)] ring-2 ring-[var(--color-accent)]/20 shadow-xs'
                    : 'border-[var(--color-line)] bg-[var(--color-surface)]/70 hover:border-[var(--color-line)] hover:shadow-[var(--shadow-warm-sm)]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-[var(--color-ink)]">
                      {featureName(f.id)}
                    </h3>
                    <span
                      data-tabular="true"
                      className="font-[family-name:var(--font-data)] text-xs font-bold text-[var(--color-accent)]"
                    >
                      {formatPrice(f.price)}
                      {t('customBuilder.perMonthShort')}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-[var(--color-muted)] leading-relaxed">
                    {f.description}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-[var(--color-line-subtle)] flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-[var(--color-muted)] truncate max-w-[170px]">
                    {featureTagline(f.id)}
                  </span>

                  {f.locked ? (
                    <span className="rounded-full bg-[var(--color-success-soft)] px-2.5 py-0.5 text-[10px] font-bold text-[var(--color-success)]">
                      {t('customBuilder.included')}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleFeature(f.id)}
                      aria-label={
                        isSelected
                          ? t('customBuilder.remove', { name: featureName(f.id) })
                          : t('customBuilder.add', { name: featureName(f.id) })
                      }
                      className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all active:scale-[0.95] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
                        isSelected
                          ? 'bg-[var(--color-accent)] text-white dark:text-[#0E1116] shadow-xs'
                          : 'border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]'
                      }`}
                    >
                      {isSelected ? (
                        <Check className="h-4 w-4" strokeWidth={2.5} />
                      ) : (
                        <Plus className="h-4 w-4" strokeWidth={2.5} />
                      )}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* Fixed Bottom Checkout Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--color-line)] bg-[var(--color-surface)]/95 backdrop-blur-md px-4 sm:px-6 py-4 shadow-[var(--shadow-cool-lg)]">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Selected Pills */}
          <div className="flex flex-1 items-center gap-2 overflow-x-auto max-w-full pb-1 sm:pb-0">
            <AnimatePresence initial={false}>
              {selectedIds.map((id) => {
                return (
                  <motion.span
                    key={id}
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.15 }}
                    className="whitespace-nowrap rounded-full bg-[var(--color-accent-soft)] border border-[var(--color-accent)]/20 px-3 py-1 text-xs font-semibold text-[var(--color-accent)]"
                  >
                    {featureName(id)}
                  </motion.span>
                )
              })}
            </AnimatePresence>
          </div>

          {/* Seats */}
          <div className="shrink-0 w-full sm:w-auto">
            <SeatStepper
              included={CUSTOM_SEATS_INCLUDED}
              extra={extraSeats}
              onChange={setExtraSeats}
              disabled={saving}
              compact
            />
          </div>

          {/* Price & Confirmation */}
          <div className="flex items-center gap-6 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                {t('customBuilder.monthlyTotal')}
              </p>
              <p className="font-[family-name:var(--font-display)] text-2xl font-extrabold text-[var(--color-ink)]">
                <AnimatedPrice value={total} />
                <span className="text-xs font-normal text-[var(--color-muted)] ml-1">
                  {t('customBuilder.perMonthShort')}
                </span>
              </p>
            </div>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={saving}
              className="inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-7 py-3 text-xs sm:text-sm font-bold text-white dark:text-[#0E1116] shadow-xs hover:bg-[var(--color-accent-hover)] transition-all transform active:scale-[0.98] disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
              {saving ? tb('preparing') : tb('continueToPayment')}
            </button>
          </div>
        </div>
        {error && (
          <p className="mx-auto max-w-6xl mt-2 text-xs font-semibold text-[var(--color-danger)] text-center">
            {tb(error)}
          </p>
        )}
      </div>
    </div>
  )
}
