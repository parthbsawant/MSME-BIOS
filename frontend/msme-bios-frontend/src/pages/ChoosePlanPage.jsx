import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import PricingTierCard from '../components/PricingTierCard'
import { TIERS } from '../lib/featuresData'

export default function ChoosePlanPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-white text-black dark:bg-black dark:text-white transition-colors">
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 py-14">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">Choose a plan</h1>
        <p className="mt-2 text-black/60 dark:text-white/60">Pick a bundle, or build exactly what you need. Prices shown are illustrative for this demo.</p>

        <div className="mt-10 grid gap-6 md:grid-cols-5">
          {TIERS.map((tier) => (
            <PricingTierCard
              key={tier.id}
              tier={tier}
              ctaLabel="Review plan"
              onSelect={() => navigate(`/plan-summary/${tier.id}`)}
            />
          ))}
          <div className="flex flex-col justify-between border border-dashed border-black/30 dark:border-white/30 p-6">
            <div>
              <p className="font-[family-name:var(--font-display)] text-xl font-semibold">Build your own</p>
              <p className="mt-1 text-xs text-black/50 dark:text-white/50">Pick exactly what you need</p>
              <p className="mt-6 text-sm text-black/70 dark:text-white/70">
                Choose individual features and see your price update as you go.
              </p>
            </div>
            <button
              onClick={() => navigate('/custom-plan')}
              className="mt-6 w-full border border-black dark:border-white py-2.5 text-sm font-medium hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
            >
              Build your plan
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
