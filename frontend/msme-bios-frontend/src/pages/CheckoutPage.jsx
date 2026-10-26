import { useEffect, useRef, useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Navbar from '../components/Navbar'
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
  }, [loading])

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

  const card = 'rounded-3xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] p-8 sm:p-10 shadow-xl'
  const primary = 'w-full rounded-xl bg-[#E8622C] dark:bg-[#F27A4A] px-6 py-3.5 text-xs font-bold text-white shadow-md shadow-[#E8622C]/20 hover:bg-[#D4531F] dark:hover:bg-[#E56938] transition-all transform active:scale-95 disabled:opacity-50 cursor-pointer'
  const secondary = 'w-full rounded-xl border border-[#F0E4D8] dark:border-[#3A332A] px-6 py-3 text-xs font-bold text-[#8A7F74] dark:text-[#A89E92] hover:text-[#2A2521] dark:hover:text-[#F5EFE8] hover:border-[#E8622C] transition-colors disabled:opacity-50 cursor-pointer'

  return (
    <div className="min-h-screen bg-[#FBF3EC] dark:bg-[#1A1714] text-[#2A2521] dark:text-[#F5EFE8] transition-colors">
      <Navbar />
      <main className="mx-auto max-w-lg px-6 py-12">
        {phase === 'success' ? (
          <div className={`${card} text-center`}>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#E8F5EC] dark:bg-[#132E21] text-[#1F9254] dark:text-[#34D399]">
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h1 className="mt-4 font-[family-name:var(--font-display)] text-2xl font-extrabold">{t('checkout.successTitle')}</h1>
            <p className="mt-2 text-sm text-[#8A7F74] dark:text-[#A89E92]">{t('checkout.successText', { plan: planName })}</p>
            {/* STEP 5: next comes team setup (SPEC section 5 order), skippable. */}
            <button onClick={() => navigate('/team?setup=1')} className={`${primary} mt-8`}>{t('checkout.setUpTeam')}</button>
            <button onClick={() => navigate('/dashboard')} className="mt-3 w-full text-center text-xs font-bold text-[#8A7F74] hover:text-[#E8622C] dark:hover:text-[#F27A4A] transition-colors cursor-pointer">
              {t('checkout.skipToDashboard')}
            </button>
          </div>
        ) : (
          <div className={card}>
            <span className="rounded-full bg-[#E8622C]/10 dark:bg-[#F27A4A]/20 px-3 py-1 text-xs font-bold text-[#E8622C] dark:text-[#F27A4A]">
              {t('checkout.badge')}
            </span>
            <h1 className="mt-3 font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-extrabold">{t('checkout.title')}</h1>

            {phase === 'failed' && (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/40 p-4 text-xs text-red-700 dark:text-red-300">
                <p className="font-bold">{t('checkout.failedTitle')}</p>
                <p className="mt-1">{t('checkout.failedText')}</p>
              </div>
            )}

            {/* Order summary - amounts from the backend */}
            <dl className="mt-6 space-y-3 rounded-2xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FBF3EC] dark:bg-[#1A1714] p-5 text-xs">
              <div className="flex justify-between gap-4">
                <dt className="text-[#8A7F74] dark:text-[#A89E92]">{t('checkout.plan')}</dt>
                <dd className="font-bold">{planName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#8A7F74] dark:text-[#A89E92]">{t('checkout.basePrice')}</dt>
                <dd className="font-[family-name:var(--font-data)] font-semibold">{formatPrice(amount - extraPrice)}</dd>
              </div>
              {extraSeats > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-[#8A7F74] dark:text-[#A89E92]">{t('checkout.extraSeats', { count: extraSeats, price: formatPrice(EXTRA_SEAT_PRICE) })}</dt>
                  <dd className="font-[family-name:var(--font-data)] font-semibold">{formatPrice(extraPrice)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-[#8A7F74] dark:text-[#A89E92]">{t('checkout.seats')}</dt>
                <dd className="font-semibold">{subscription?.seats_purchased ?? (plan.seatsIncluded ?? 0) + extraSeats}</dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-[#F0E4D8] dark:border-[#3A332A] pt-3">
                <dt className="font-bold">{t('checkout.total')}</dt>
                <dd className="font-[family-name:var(--font-display)] text-lg font-extrabold text-[#E8622C] dark:text-[#F27A4A]">{formatPrice(amount)}</dd>
              </div>
            </dl>

            <p className="mt-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 px-3 py-2 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
              {t('checkout.mockNotice')}
            </p>

            {error && <p className="mt-4 text-xs font-semibold text-red-600 dark:text-red-400">{t(error)}</p>}

            <div className="mt-6 space-y-3">
              <button onClick={() => pay('success')} disabled={phase === 'paying' || !subscription?.order_id} className={primary}>
                {phase === 'paying' ? t('checkout.paying') : phase === 'failed' ? t('checkout.tryAgain') : t('checkout.pay', { amount: formatPrice(amount) })}
              </button>
              <button onClick={() => pay('fail')} disabled={phase === 'paying' || !subscription?.order_id} className={secondary}>
                {t('checkout.simulateFailure')}
              </button>
              <button onClick={() => navigate('/choose-plan')} disabled={phase === 'paying'} className="w-full text-center text-xs font-bold text-[#8A7F74] hover:text-[#E8622C] dark:hover:text-[#F27A4A] transition-colors cursor-pointer disabled:opacity-50">
                {t('checkout.changePlan')}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
