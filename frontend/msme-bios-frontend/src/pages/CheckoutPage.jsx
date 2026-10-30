import { useEffect, useRef, useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle } from 'lucide-react'
import Navbar from '../components/Navbar'
import OnboardingProgress from '../components/OnboardingProgress'
import AuthLoadingScreen from '../components/AuthLoadingScreen'
import { usePlan } from '../context/PlanContext'
import { useCatalog } from '../lib/useCatalog'
import { EXTRA_SEAT_PRICE, formatPrice } from '../lib/featuresData'
import { createCheckoutOrder, payWithMockProvider } from '../lib/api'

// STEP 3 mock checkout (SPEC.md section 5). The amount shown comes from the
// backend (/api/me's subscription, computed by pricing.py). "Pay" and
// "Simulate failed payment" both go through the provider interface: mock-pay
// plays the payment window, then /api/checkout/verify decides - the plan
// becomes active only there. Failure and retry happen on this same page.
export default function CheckoutPage() {
  const navigate = useNavigate()
  const { t } = useTranslation('billing')
  const { tierName, customPlanName } = useCatalog()
  const { plan, hasPlan, subscription, isPaid, refreshPlan, loading } = usePlan()

  const [phase, setPhase] = useState('loading') // loading | ready | paying | success | failed
  const [error, setError] = useState('')
  const started = useRef(false)

  // Always start from the backend's current state (this page may be
  // opened by a refresh). A plan saved before checkout existed (no order
  // yet) gets an order created for the same choice.
  useEffect(() => {
    if (loading || started.current) return
    started.current = true
    ;(async () => {
      try {
        const me = await refreshPlan()
        if (me?.plan && !me.subscription?.order_id && me.subscription?.status !== 'active') {
          await createCheckoutOrder({
            type: me.plan.plan_type,
            tierId: me.plan.tier_id,
            featureIds: me.plan.feature_ids,
            extraSeats: me.plan.extra_seats,
          })
          await refreshPlan()
        }
        setPhase(me?.subscription?.status === 'failed' ? 'failed' : 'ready')
      } catch (err) {
        console.error('Could not load checkout:', err)
        setError('checkout.error')
        setPhase('ready')
      }
    })()
  }, [loading, refreshPlan])

  if (loading || phase === 'loading') return <AuthLoadingScreen />
  if (!hasPlan) return <Navigate to="/choose-plan" replace />
  if (isPaid && phase !== 'success') return <Navigate to="/dashboard" replace />

  const amount = subscription?.amount ?? plan.price
  const extraSeats = plan.extraSeats ?? 0
  const extraPrice = extraSeats * EXTRA_SEAT_PRICE
  const planName = plan.type === 'tier' ? tierName(plan.tierId) : customPlanName()

  const pay = async (outcome) => {
    if (!subscription?.order_id) return
    setError('')
    setPhase('paying')
    try {
      const result = await payWithMockProvider(subscription.order_id, outcome)
      setPhase(result.status === 'active' ? 'success' : 'failed')
      await refreshPlan()
    } catch (err) {
      console.error('Payment error:', err)
      if (err.status === 409) {
        // Already paid (e.g. in another tab) - nothing to do here.
        setPhase('success')
        await refreshPlan()
        return
      }
      setError('checkout.error')
      setPhase('ready')
    }
  }

  const card =
    'rounded-3xl border border-[var(--color-line)] bg-[var(--color-surface)] p-6 sm:p-10 shadow-[var(--shadow-cool-md)]'
  const primary =
    'w-full inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-6 py-3.5 text-xs sm:text-sm font-bold text-white dark:text-[#0E1116] shadow-xs hover:bg-[var(--color-accent-hover)] transition-all transform active:scale-[0.98] disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]'
  const secondary =
    'w-full inline-flex items-center justify-center rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-6 py-3 text-xs sm:text-sm font-semibold text-[var(--color-ink)] hover:bg-[var(--color-surface-2)] transition-colors disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]'

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] text-[var(--color-ink)] transition-colors">
      <Navbar />
      <main className="mx-auto max-w-lg px-4 sm:px-6 py-10 md:py-14">
        {phase !== 'success' && <OnboardingProgress currentStep={3} />}
        {phase === 'success' ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className={`${card} text-center`}
          >
            {/* Animated Drawn Checkmark */}
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-success-soft)] text-[var(--color-success)] shadow-xs">
              <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <motion.path
                  d="M5 13l4 4L19 7"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.45, ease: 'easeOut', delay: 0.15 }}
                />
              </svg>
            </div>
            <h1 className="mt-5 font-[family-name:var(--font-display)] text-2xl font-extrabold text-[var(--color-ink)]">
              {t('checkout.successTitle')}
            </h1>
            <p className="mt-2 text-sm text-[var(--color-muted)] leading-relaxed">
              {t('checkout.successText', { plan: planName })}
            </p>
            {/* STEP 5: next comes team setup (SPEC section 5 order), skippable. */}
            <button
              type="button"
              onClick={() => navigate('/team?setup=1')}
              className={`${primary} mt-8`}
            >
              {t('checkout.setUpTeam')}
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="mt-3.5 w-full text-center text-xs font-bold text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors cursor-pointer py-1"
            >
              {t('checkout.skipToDashboard')}
            </button>
          </motion.div>
        ) : (
          <div className={card}>
            <span className="inline-block rounded-full bg-[var(--color-accent-soft)] px-3 py-1 text-xs font-bold text-[var(--color-accent)]">
              {t('checkout.badge')}
            </span>
            <h1 className="mt-3 font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--color-ink)]">
              {t('checkout.title')}
            </h1>

            {/* Failure state with gentle shake animation */}
            <AnimatePresence>
              {phase === 'failed' && (
                <motion.div
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: [0, -6, 6, -3, 3, 0] }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.35 }}
                  className="mt-5 rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] p-4 text-xs text-[var(--color-danger)]"
                >
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" strokeWidth={2} />
                    <div>
                      <p className="font-bold">{t('checkout.failedTitle')}</p>
                      <p className="mt-1 leading-relaxed opacity-90">{t('checkout.failedText')}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Order summary - amounts from the backend */}
            <dl className="mt-6 space-y-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-2)]/60 p-5 text-xs">
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--color-muted)]">{t('checkout.plan')}</dt>
                <dd className="font-bold text-[var(--color-ink)]">{planName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--color-muted)]">{t('checkout.basePrice')}</dt>
                <dd
                  data-tabular="true"
                  className="font-[family-name:var(--font-data)] font-semibold text-[var(--color-ink)]"
                >
                  {formatPrice(amount - extraPrice)}
                </dd>
              </div>
              {extraSeats > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--color-muted)]">
                    {t('checkout.extraSeats', {
                      count: extraSeats,
                      price: formatPrice(EXTRA_SEAT_PRICE),
                    })}
                  </dt>
                  <dd
                    data-tabular="true"
                    className="font-[family-name:var(--font-data)] font-semibold text-[var(--color-ink)]"
                  >
                    {formatPrice(extraPrice)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--color-muted)]">{t('checkout.seats')}</dt>
                <dd className="font-semibold text-[var(--color-ink)]">
                  {subscription?.seats_purchased ?? (plan.seatsIncluded ?? 0) + extraSeats}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-[var(--color-line-subtle)] pt-3">
                <dt className="font-bold text-[var(--color-ink)]">{t('checkout.total')}</dt>
                <dd
                  data-tabular="true"
                  className="font-[family-name:var(--font-display)] text-xl font-extrabold text-[var(--color-accent)]"
                >
                  {formatPrice(amount)}
                </dd>
              </div>
            </dl>

            {error && (
              <p className="mt-4 text-xs font-semibold text-[var(--color-danger)]">{t(error)}</p>
            )}

            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={() => pay('success')}
                disabled={phase === 'paying' || !subscription?.order_id}
                className={primary}
              >
                {phase === 'paying' ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    <span>{t('checkout.paying')}</span>
                  </span>
                ) : phase === 'failed' ? (
                  t('checkout.tryAgain')
                ) : (
                  t('checkout.pay', { amount: formatPrice(amount) })
                )}
              </button>
              <button
                type="button"
                onClick={() => pay('fail')}
                disabled={phase === 'paying' || !subscription?.order_id}
                className={secondary}
              >
                {t('checkout.simulateFailure')}
              </button>
              <button
                type="button"
                onClick={() => navigate('/choose-plan')}
                disabled={phase === 'paying'}
                className="w-full text-center text-xs font-bold text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors cursor-pointer disabled:opacity-50 py-1"
              >
                {t('checkout.changePlan')}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
