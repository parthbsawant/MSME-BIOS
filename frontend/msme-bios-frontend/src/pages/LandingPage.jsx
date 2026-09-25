import { Link, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import FeatureFlipCard from '../components/FeatureFlipCard'
import PricingTierCard from '../components/PricingTierCard'
import { FEATURES, TIERS } from '../lib/featuresData'

const heroFeatureIds = ['document_parser', 'cash_dashboard', 'invoice_generator', 'receivables_payables', 'anomaly_detection', 'business_health_index']

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-white text-black dark:bg-black dark:text-white transition-colors">
      <Navbar showNavLinks />

      <main>
        <section className="mx-auto max-w-5xl px-6 py-24 text-center md:py-32">
          <h1 className="font-[family-name:var(--font-display)] text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
            Run your business on real numbers, not guesswork.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-black/70 dark:text-white/70">
            MSME-BIOS reads your documents, tracks your cash, and shows you exactly
            where the business stands — built for small and micro enterprises.
          </p>
          <button
            onClick={() => navigate('/signup')}
            className="mt-8 bg-black px-7 py-3.5 text-sm font-medium text-white dark:bg-white dark:text-black hover:opacity-80 transition-opacity"
          >
            Get started
          </button>
        </section>

        <section id="features" className="mx-auto max-w-5xl px-6 py-20 border-t border-black/15 dark:border-white/15">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">Everything the business needs, in one place.</h2>
          <p className="mt-2 text-black/60 dark:text-white/60">Hover a card for details.</p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 md:grid-cols-3">
            {heroFeatureIds.map((id) => {
              const f = FEATURES.find((feat) => feat.id === id)
              return <FeatureFlipCard key={id} name={f.name} tagline={f.tagline} description={f.description} />
            })}
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-6xl px-6 py-20 border-t border-black/15 dark:border-white/15">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">Pick a plan, or build your own.</h2>
          <p className="mt-2 text-black/60 dark:text-white/60">Prices shown are illustrative for this demo.</p>
          <div className="mt-10 grid gap-6 md:grid-cols-5">
            {TIERS.map((tier) => (
              <PricingTierCard key={tier.id} tier={tier} onSelect={() => navigate('/signup')} />
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
                onClick={() => navigate('/signup')}
                className="mt-6 w-full border border-black dark:border-white py-2.5 text-sm font-medium hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
              >
                Get a quote
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-black/15 dark:border-white/15 py-8">
        <div className="mx-auto max-w-6xl px-6 flex flex-wrap items-center justify-between gap-4 text-xs text-black/40 dark:text-white/40">
          <span>MSME-BIOS — a business intelligence system for small and micro enterprises.</span>
          <div className="flex gap-6">
            <Link to="/login" className="hover:text-black dark:hover:text-white transition-colors">Log in</Link>
            <Link to="/signup" className="hover:text-black dark:hover:text-white transition-colors">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
