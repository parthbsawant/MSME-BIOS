import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'

export default function OnboardingProgress({ currentStep = 1 }) {
  const { t: tOnboarding } = useTranslation('onboarding')
  const { t: tBilling } = useTranslation('billing')

  const steps = [
    { number: 1, label: tOnboarding('businessSetup.badge') },
    { number: 2, label: tOnboarding('choosePlan.badge') },
    { number: 3, label: tBilling('checkout.badge') },
  ]

  return (
    <nav aria-label="Onboarding Progress" className="mb-8 w-full max-w-xl mx-auto">
      <div className="flex items-center justify-between">
        {steps.map((step, idx) => {
          const isComplete = currentStep > step.number
          const isActive = currentStep === step.number

          return (
            <div key={step.number} className="flex items-center flex-1 last:flex-none">
              {/* Step indicator node */}
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                    isComplete
                      ? 'bg-[var(--color-success-soft)] text-[var(--color-success)] border border-[var(--color-success)]/30'
                      : isActive
                      ? 'bg-[var(--color-accent)] text-white dark:text-[#0E1116] shadow-xs ring-4 ring-[var(--color-accent)]/20'
                      : 'bg-[var(--color-surface-2)] text-[var(--color-muted)] border border-[var(--color-line)]'
                  }`}
                >
                  {isComplete ? <Check className="h-4 w-4" strokeWidth={3} /> : step.number}
                </div>
                <span
                  className={`mt-1.5 hidden sm:block text-[11px] text-center max-w-[110px] truncate ${
                    isActive
                      ? 'font-bold text-[var(--color-ink)]'
                      : isComplete
                      ? 'font-medium text-[var(--color-muted)]'
                      : 'text-[var(--color-muted)]/70'
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {/* Connecting line */}
              {idx < steps.length - 1 && (
                <div
                  className={`h-0.5 mx-2 sm:mx-4 flex-1 transition-colors ${
                    currentStep > idx + 1 ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-line)]'
                  }`}
                />
              )}
            </div>
          )
        })}
      </div>
    </nav>
  )
}
