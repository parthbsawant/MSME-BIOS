import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import {
  FileSpreadsheet,
  TrendingUp,
  Receipt,
  Building2,
  Check,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import Navbar from '../components/Navbar'
import FeatureFlipCard from '../components/FeatureFlipCard'
import PricingTierCard from '../components/PricingTierCard'
import { TIERS } from '../lib/featuresData'
import { transitions } from '../lib/motion'

// Unified Lucide icons for core features
const featureIcons = {
  document_parser: <FileSpreadsheet className="h-5 w-5" strokeWidth={1.75} />,
  cash_dashboard: <TrendingUp className="h-5 w-5" strokeWidth={1.75} />,
  invoice_generator: <Receipt className="h-5 w-5" strokeWidth={1.75} />,
  india_localized: <Building2 className="h-5 w-5" strokeWidth={1.75} />,
}

export default function LandingPage() {
  const navigate = useNavigate()
  const { t } = useTranslation('landing')

  const coreFeatures = [
    { id: 'document_parser', key: 'documentParser', icon: featureIcons.document_parser },
    { id: 'cash_dashboard', key: 'cashDashboard', icon: featureIcons.cash_dashboard },
    { id: 'invoice_generator', key: 'invoiceGenerator', icon: featureIcons.invoice_generator },
    { id: 'india_localized', key: 'indiaLocalized', icon: featureIcons.india_localized },
  ]

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] text-[var(--color-ink)] transition-colors">
      {/* Full Header Navbar */}
      <Navbar showNavLinks />

      <main>
        {/* HERO SECTION */}
        <section
          id="hero"
          className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-16 pb-20 md:pt-24 md:pb-28 text-center overflow-hidden"
        >
          {/* Top Badge */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={transitions.standard}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)] px-3.5 py-1 text-xs font-semibold text-[var(--color-accent)] shadow-xs mb-8"
          >
            <span className="h-2 w-2 rounded-full bg-[var(--color-accent)] animate-pulse" />
            <span>{t('hero.badge')}</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...transitions.reveal, delay: 0.08 }}
            className="font-[family-name:var(--font-display)] text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.1] tracking-tight text-[var(--color-ink)] max-w-4xl mx-auto"
          >
            {t('hero.headline1')} <br className="hidden sm:block" />
            <span className="text-[var(--color-accent)] relative inline-block">
              {t('hero.headlineHighlight')}
              <svg
                className="absolute -bottom-2 left-0 w-full text-[var(--color-accent)]/30"
                viewBox="0 0 100 20"
                preserveAspectRatio="none"
              >
                <path d="M0 15 Q 50 0 100 15" fill="none" stroke="currentColor" strokeWidth="4" />
              </svg>
            </span>
          </motion.h1>

          {/* Subheading */}
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...transitions.reveal, delay: 0.16 }}
            className="mx-auto mt-7 max-w-2xl text-base sm:text-lg text-[var(--color-muted)] leading-relaxed"
          >
            {t('hero.subheading')}
          </motion.p>

          {/* Primary CTA */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...transitions.reveal, delay: 0.22 }}
            className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3.5"
          >
            <button
              type="button"
              onClick={() => navigate('/signup')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-8 py-3.5 text-sm font-bold text-white shadow-sm hover:bg-[var(--color-accent-hover)] transition-all transform active:scale-[0.98] cursor-pointer"
            >
              <span>{t('hero.ctaPrimary')}</span>
              <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
            </button>
            <a
              href="#how-it-works"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-6 py-3.5 text-sm font-semibold text-[var(--color-ink)] hover:bg-[var(--color-surface-2)] hover:border-[var(--color-line)] transition-colors"
            >
              <span>{t('hero.ctaSecondary')}</span>
            </a>
          </motion.div>

          {/* Abstract Text-Free Geometric Hero Visual (Draws line once) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...transitions.reveal, delay: 0.3 }}
            className="mx-auto mt-12 max-w-3xl rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-6 sm:p-8 shadow-[var(--shadow-warm-md)]"
            aria-hidden="true"
          >
            <div className="relative aspect-[16/7] w-full overflow-hidden rounded-xl border border-[var(--color-line-subtle)] bg-[var(--color-surface-2)] p-4 flex flex-col justify-between">
              {/* Subtle architectural grid */}
              <div
                className="absolute inset-0 opacity-[0.35]"
                style={{
                  backgroundImage:
                    'linear-gradient(to right, var(--color-line) 1px, transparent 1px), linear-gradient(to bottom, var(--color-line) 1px, transparent 1px)',
                  backgroundSize: '32px 32px',
                }}
              />

              {/* Top status bar dots */}
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-[var(--color-accent)]" />
                  <div className="h-2.5 w-2.5 rounded-full bg-[var(--color-line)]" />
                  <div className="h-2.5 w-2.5 rounded-full bg-[var(--color-line)]" />
                </div>
                <div className="h-2 w-16 rounded-full bg-[var(--color-line)]" />
              </div>

              {/* Animated SVG line chart with self-drawing trajectory */}
              <svg className="relative z-10 w-full h-full overflow-visible" viewBox="0 0 700 180" fill="none">
                {/* Horizontal reference lines */}
                <line x1="0" y1="40" x2="700" y2="40" stroke="var(--color-line)" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="0" y1="100" x2="700" y2="100" stroke="var(--color-line)" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="0" y1="160" x2="700" y2="160" stroke="var(--color-line)" strokeWidth="1" strokeDasharray="4 4" />

                {/* Shaded area underneath */}
                <path
                  d="M 30 150 Q 150 130 250 85 T 450 65 T 670 25 L 670 170 L 30 170 Z"
                  fill="var(--color-accent-soft)"
                  opacity="0.6"
                />

                {/* Self-drawing path */}
                <motion.path
                  d="M 30 150 Q 150 130 250 85 T 450 65 T 670 25"
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
                />

                {/* Data marker circles */}
                <circle cx="250" cy="85" r="4.5" fill="var(--color-surface)" stroke="var(--color-accent)" strokeWidth="3" />
                <circle cx="450" cy="65" r="4.5" fill="var(--color-surface)" stroke="var(--color-accent)" strokeWidth="3" />
                <circle cx="670" cy="25" r="5.5" fill="var(--color-accent)" />
              </svg>

              {/* Bottom decorative indicators */}
              <div className="relative z-10 flex items-center justify-between pt-2">
                <div className="flex gap-2">
                  <div className="h-1.5 w-12 rounded bg-[var(--color-line)]" />
                  <div className="h-1.5 w-8 rounded bg-[var(--color-line)]" />
                </div>
                <div className="h-1.5 w-16 rounded bg-[var(--color-line)]" />
              </div>
            </div>
          </motion.div>

          {/* Trust Indicators Row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ ...transitions.reveal, delay: 0.38 }}
            className="mt-14 pt-8 border-t border-[var(--color-line)] flex flex-wrap items-center justify-center gap-6 sm:gap-10"
          >
            <div className="flex items-center gap-2.5 text-xs font-semibold text-[var(--color-ink)]">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-success-soft)] text-[var(--color-success)] shrink-0">
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </div>
              <span>{t('hero.trust1')}</span>
            </div>

            <div className="flex items-center gap-2.5 text-xs font-semibold text-[var(--color-ink)]">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-success-soft)] text-[var(--color-success)] shrink-0">
                <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.5} />
              </div>
              <span>{t('hero.trust2')}</span>
            </div>

            <div className="flex items-center gap-2.5 text-xs font-semibold text-[var(--color-ink)]">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-success-soft)] text-[var(--color-success)] shrink-0">
                <Zap className="h-3.5 w-3.5" strokeWidth={2.5} />
              </div>
              <span>{t('hero.trust3')}</span>
            </div>
          </motion.div>
        </section>

        {/* 4-COLUMN FEATURE GRID SECTION */}
        <section
          id="features"
          className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 border-t border-[var(--color-line)]"
        >
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-accent)]">
              {t('features.eyebrow')}
            </span>
            <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-bold tracking-tight text-[var(--color-ink)]">
              {t('features.heading')}
            </h2>
            <p className="mt-2.5 text-sm text-[var(--color-muted)] leading-relaxed">
              {t('features.subheading')}
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {coreFeatures.map((feat) => (
              <FeatureFlipCard
                key={feat.id}
                name={t(`features.${feat.key}.title`)}
                tagline={t(`features.${feat.key}.tagline`)}
                description={t(`features.${feat.key}.description`)}
                icon={feat.icon}
              />
            ))}
          </div>
        </section>

        {/* HOW IT WORKS SECTION */}
        <section
          id="how-it-works"
          className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-20 border-t border-[var(--color-line)]"
        >
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-accent)]">
              {t('howItWorks.eyebrow')}
            </span>
            <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold text-[var(--color-ink)]">
              {t('howItWorks.heading')}
            </h2>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-6 text-center shadow-xs hover:shadow-[var(--shadow-warm-md)] transition-shadow">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-accent)] text-white font-bold text-base shadow-xs">
                1
              </div>
              <h3 className="mt-4 font-[family-name:var(--font-display)] font-bold text-base text-[var(--color-ink)]">
                {t('howItWorks.step1Title')}
              </h3>
              <p className="mt-2 text-xs text-[var(--color-muted)] leading-relaxed">
                {t('howItWorks.step1Desc')}
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-6 text-center shadow-xs hover:shadow-[var(--shadow-warm-md)] transition-shadow">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-accent)] text-white font-bold text-base shadow-xs">
                2
              </div>
              <h3 className="mt-4 font-[family-name:var(--font-display)] font-bold text-base text-[var(--color-ink)]">
                {t('howItWorks.step2Title')}
              </h3>
              <p className="mt-2 text-xs text-[var(--color-muted)] leading-relaxed">
                {t('howItWorks.step2Desc')}
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-6 text-center shadow-xs hover:shadow-[var(--shadow-warm-md)] transition-shadow">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-accent)] text-white font-bold text-base shadow-xs">
                3
              </div>
              <h3 className="mt-4 font-[family-name:var(--font-display)] font-bold text-base text-[var(--color-ink)]">
                {t('howItWorks.step3Title')}
              </h3>
              <p className="mt-2 text-xs text-[var(--color-muted)] leading-relaxed">
                {t('howItWorks.step3Desc')}
              </p>
            </div>
          </div>
        </section>

        {/* PRICING SECTION */}
        <section
          id="pricing"
          className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 border-t border-[var(--color-line)]"
        >
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-accent)]">
              {t('pricing.eyebrow')}
            </span>
            <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-bold text-[var(--color-ink)]">
              {t('pricing.heading')}
            </h2>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              {t('pricing.subheading')}
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {TIERS.map((tier) => (
              <PricingTierCard key={tier.id} tier={tier} onSelect={() => navigate('/signup')} />
            ))}

            {/* Custom Plan Option Card */}
            <div className="flex flex-col justify-between rounded-2xl border-2 border-dashed border-[var(--color-accent)]/40 bg-[var(--color-surface)] p-6 shadow-xs hover:border-[var(--color-accent)] hover:shadow-[var(--shadow-warm-md)] transition-all">
              <div>
                <span className="rounded-full bg-[var(--color-accent-soft)] px-2.5 py-0.5 text-[10px] font-bold text-[var(--color-accent)]">
                  {t('pricing.customBadge')}
                </span>
                <h3 className="mt-3 font-[family-name:var(--font-display)] text-xl font-bold text-[var(--color-ink)]">
                  {t('pricing.customTitle')}
                </h3>
                <p className="mt-1 text-xs text-[var(--color-muted)]">{t('pricing.customTagline')}</p>
                <p className="mt-5 text-xs text-[var(--color-ink)]/80 leading-relaxed">
                  {t('pricing.customDescription')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/signup')}
                className="mt-8 w-full rounded-xl border border-[var(--color-accent)] py-3 text-xs font-bold text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-white transition-all cursor-pointer active:scale-[0.98]"
              >
                {t('pricing.customCta')}
              </button>
            </div>
          </div>
        </section>

        {/* MSME GUIDE BANNER */}
        <section className="mx-auto max-w-5xl px-4 sm:px-6 py-20 border-t border-[var(--color-line)]">
          <div className="rounded-3xl border border-[var(--color-line)] bg-[var(--color-surface)] p-8 sm:p-12 text-center shadow-[var(--shadow-warm-md)]">
            <span className="inline-block rounded-full bg-[var(--color-success-soft)] px-3 py-1 text-xs font-bold text-[var(--color-success)]">
              {t('msmeBanner.badge')}
            </span>
            <h2 className="mt-4 font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-bold text-[var(--color-ink)]">
              {t('msmeBanner.heading')}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-[var(--color-muted)] leading-relaxed">
              {t('msmeBanner.description')}
            </p>
            <Link
              to="/msme-guide"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[var(--color-ink)] px-6 py-3 text-xs font-bold text-[var(--color-canvas)] hover:bg-[var(--color-accent)] transition-all cursor-pointer"
            >
              <span>{t('msmeBanner.cta')}</span>
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--color-line)] bg-[var(--color-surface)] py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--color-muted)]">
          <span>{t('footer.copyright')}</span>
          <div className="flex gap-6">
            <Link to="/login" className="hover:text-[var(--color-accent)] transition-colors">
              {t('footer.logIn')}
            </Link>
            <Link to="/signup" className="hover:text-[var(--color-accent)] transition-colors">
              {t('footer.signUp')}
            </Link>
            <Link to="/msme-guide" className="hover:text-[var(--color-accent)] transition-colors">
              {t('nav.msmeGuideShort', { ns: 'common' })}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
