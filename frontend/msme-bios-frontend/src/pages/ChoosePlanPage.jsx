import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import PricingTierCard from '../components/PricingTierCard'
import { TIERS } from '../lib/featuresData'

export default function ChoosePlanPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#FBF3EC] dark:bg-[#1A1714] text-[#2A2521] dark:text-[#F5EFE8] transition-colors">
      <Navbar />
      <main className="mx-auto max-w-7xl px-6 py-12">
        <button
          onClick={() => navigate('/business-setup')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#8A7F74] hover:text-[#E8622C] dark:hover:text-[#F27A4A] transition-colors cursor-pointer"
        >
          &larr; Back to Business Setup
        </button>

        <div className="mt-4 max-w-2xl">
          <span className="text-xs font-bold uppercase tracking-wider text-[#E8622C] dark:text-[#F27A4A]">Onboarding Step 2 of 2</span>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-tight text-[#2A2521] dark:text-[#F5EFE8]">
            Choose a plan for your enterprise
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-[#8A7F74] dark:text-[#A89E92]">
            Pick a pre-configured feature bundle, or build a custom plan tailored specifically to your workflow.
          </p>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {TIERS.map((tier) => (
            <PricingTierCard
              key={tier.id}
              tier={tier}
              ctaLabel="Review Plan"
              onSelect={() => navigate(`/plan-summary/${tier.id}`)}
            />
          ))}

          {/* Custom Plan Option Card */}
          <div className="flex flex-col justify-between rounded-2xl border border-dashed border-[#E8622C]/50 dark:border-[#F27A4A]/50 bg-[#FFFFFF] dark:bg-[#242019] p-6 shadow-sm">
            <div>
              <span className="rounded-full bg-[#E8622C]/10 dark:bg-[#F27A4A]/20 px-2.5 py-0.5 text-[10px] font-bold text-[#E8622C] dark:text-[#F27A4A]">
                Custom
              </span>
              <h3 className="mt-3 font-[family-name:var(--font-display)] text-xl font-bold text-[#2A2521] dark:text-[#F5EFE8]">
                Build your own
              </h3>
              <p className="mt-1 text-xs text-[#8A7F74] dark:text-[#A89E92]">Pick exactly what you need</p>
              <p className="mt-6 text-xs text-[#2A2521]/80 dark:text-[#F5EFE8]/80 leading-relaxed">
                Choose individual modules like anomaly detection or demand forecasting and see your price update automatically.
              </p>
            </div>
            <button
              onClick={() => navigate('/custom-plan')}
              className="mt-8 w-full rounded-xl border border-[#E8622C] dark:border-[#F27A4A] py-3 text-xs font-bold text-[#E8622C] dark:text-[#F27A4A] hover:bg-[#E8622C] hover:text-white dark:hover:bg-[#F27A4A] dark:hover:text-[#1A1714] transition-all cursor-pointer"
            >
              Build Your Plan
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
