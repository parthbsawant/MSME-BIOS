import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import Navbar from '../components/Navbar'
import OnboardingProgress from '../components/OnboardingProgress'
import PricingTierCard from '../components/PricingTierCard'
import { TIERS } from '../lib/featuresData'

export default function ChoosePlanPage() {
  const navigate = useNavigate()
  const { t } = useTranslation('onboarding')

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] text-[var(--color-ink)] transition-colors">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 md:py-14">
        <OnboardingProgress currentStep={2} />
        <button
          type="button"
          onClick={() => navigate('/business-setup')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors cursor-pointer group"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" strokeWidth={2.5} />
          <span>{t('choosePlan.back')}</span>
        </button>

        <div className="mt-4 max-w-2xl">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-accent)]">
            {t('choosePlan.badge')}
          </span>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-tight text-[var(--color-ink)]">
            {t('choosePlan.title')}
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-[var(--color-muted)] leading-relaxed">
            {t('choosePlan.subtitle')}
          </p>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {TIERS.map((tier) => (
            <PricingTierCard
              key={tier.id}
              tier={tier}
              ctaLabel={t('choosePlan.reviewPlan')}
              onSelect={() => navigate(`/plan-summary/${tier.id}`)}
            />
          ))}

          {/* Custom Plan Option Card */}
          <div className="flex flex-col justify-between rounded-2xl border-2 border-dashed border-[var(--color-accent)]/40 bg-[var(--color-surface)] p-6 shadow-xs hover:border-[var(--color-accent)] hover:shadow-[var(--shadow-warm-md)] transition-all">
            <div>
              <span className="rounded-full bg-[var(--color-accent-soft)] px-2.5 py-0.5 text-[10px] font-bold text-[var(--color-accent)]">
                {t('choosePlan.customBadge')}
              </span>
              <h3 className="mt-3 font-[family-name:var(--font-display)] text-xl font-bold text-[var(--color-ink)]">
                {t('choosePlan.customTitle')}
              </h3>
              <p className="mt-1 text-xs text-[var(--color-muted)]">{t('choosePlan.customTagline')}</p>
              <p className="mt-5 text-xs text-[var(--color-ink)]/80 leading-relaxed">
                {t('choosePlan.customDescription')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/custom-plan')}
              className="mt-8 w-full rounded-xl border border-[var(--color-accent)] py-3 text-xs font-bold text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-white transition-all cursor-pointer active:scale-[0.98]"
            >
              {t('choosePlan.customCta')}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
