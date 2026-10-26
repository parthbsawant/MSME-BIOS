import { useState } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
    <div className="min-h-screen bg-[#FBF3EC] dark:bg-[#1A1714] text-[#2A2521] dark:text-[#F5EFE8] transition-colors">
      <Navbar />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <div className="rounded-3xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] p-8 sm:p-10 shadow-xl">
          <span className="rounded-full bg-[#E8622C]/10 dark:bg-[#F27A4A]/20 px-3 py-1 text-xs font-bold text-[#E8622C] dark:text-[#F27A4A]">
            {t('planSummary.badge')}
          </span>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-extrabold text-[#2A2521] dark:text-[#F5EFE8]">
            {t('planSummary.title', { name: tierName(tier.id) })}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#8A7F74] dark:text-[#A89E92]">{tierBand(tier.id)}</p>

          <div className="mt-6 flex items-baseline gap-1 bg-[#FBF3EC] dark:bg-[#1A1714] p-4 rounded-2xl border border-[#F0E4D8] dark:border-[#3A332A]">
            <span className="font-[family-name:var(--font-display)] text-3xl font-extrabold text-[#E8622C] dark:text-[#F27A4A]">
              {formatPrice(total)}
            </span>
            <span className="text-xs text-[#8A7F74] dark:text-[#A89E92]">{t('planSummary.perMonth')}</span>
            {extraSeats > 0 && (
              <span className="ml-auto text-[11px] text-[#8A7F74] dark:text-[#A89E92]">
                {formatPrice(tier.price)} + {tb('checkout.extraSeats', { count: extraSeats, price: formatPrice(EXTRA_SEAT_PRICE) })}
              </span>
            )}
          </div>

          <div className="mt-4">
            <SeatStepper included={tier.seatsIncluded} extra={extraSeats} onChange={setExtraSeats} disabled={saving} />
          </div>

          <div className="mt-6 space-y-3 border-t border-[#F0E4D8] dark:border-[#3A332A] pt-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#2A2521] dark:text-[#F5EFE8]">{t('planSummary.includedFeatures', { count: tier.featureIds.length })}</h3>
            <ul className="space-y-2.5">
              {tier.featureIds.map((id) => {
                return (
                  <li key={id} className="flex items-start gap-3 rounded-xl bg-[#FBF3EC]/60 dark:bg-[#1A1714]/60 p-3 border border-[#F0E4D8]/60 dark:border-[#3A332A]/60">
                    <svg className="h-4 w-4 shrink-0 text-[#1F9254] dark:text-[#34D399] mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    <div>
                      <p className="text-xs font-bold text-[#2A2521] dark:text-[#F5EFE8]">{featureName(id)}</p>
                      <p className="text-[11px] text-[#8A7F74] dark:text-[#A89E92]">{featureTagline(id)}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          {error && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/40 p-4 text-xs text-red-700 dark:text-red-300">
              {tb(error)}
            </div>
          )}

          <div className="mt-8 flex gap-3">
            <button
              onClick={() => navigate('/choose-plan')}
              disabled={saving}
              className="rounded-xl border border-[#F0E4D8] dark:border-[#3A332A] px-6 py-3 text-xs font-bold text-[#8A7F74] hover:text-[#2A2521] dark:hover:text-[#F5EFE8] transition-colors disabled:opacity-50 cursor-pointer"
            >
              {t('planSummary.back')}
            </button>
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="flex-1 rounded-xl bg-[#E8622C] dark:bg-[#F27A4A] px-6 py-3 text-xs font-bold text-white shadow-md shadow-[#E8622C]/20 hover:bg-[#D4531F] dark:hover:bg-[#E56938] transition-all transform active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {saving ? tb('preparing') : tb('continueToPayment')}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
