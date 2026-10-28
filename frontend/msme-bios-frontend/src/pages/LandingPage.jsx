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

// Text-free decorative SVGs for bento tiles
const bentoSvgs = {
  bars: (
    <svg width="48" height="36" viewBox="0 0 48 36" fill="currentColor">
      <rect x="2" y="24" width="8" height="12" rx="2" />
      <rect x="14" y="16" width="8" height="20" rx="2" />
      <rect x="26" y="8" width="8" height="28" rx="2" />
      <rect x="38" y="0" width="8" height="36" rx="2" />
    </svg>
  ),
  ring: (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <circle cx="22" cy="22" r="18" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <circle cx="22" cy="22" r="18" stroke="currentColor" strokeWidth="3" strokeDasharray="60 50" strokeLinecap="round" />
      <circle cx="22" cy="22" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="30 30" opacity="0.4" />
    </svg>
  ),
  line: (
    <svg width="72" height="36" viewBox="0 0 72 36" fill="none">
      <path d="M2 30 C 20 28, 30 10, 45 14 S 60 4, 70 2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M2 30 C 20 28, 30 10, 45 14 S 60 4, 70 2 L 70 36 L 2 36 Z" fill="currentColor" opacity="0.15" />
    </svg>
  ),
  dottedAnomaly: (
    <svg width="50" height="36" viewBox="0 0 50 36" fill="currentColor">
      <circle cx="6" cy="6" r="2" opacity="0.3" />
      <circle cx="18" cy="6" r="2" opacity="0.3" />
      <circle cx="30" cy="6" r="2" opacity="0.3" />
      <circle cx="42" cy="6" r="2" opacity="0.3" />
      <circle cx="6" cy="18" r="2" opacity="0.3" />
      <circle cx="18" cy="18" r="3.5" fill="var(--color-highlight)" />
      <circle cx="30" cy="18" r="2" opacity="0.3" />
      <circle cx="42" cy="18" r="2" opacity="0.3" />
      <circle cx="6" cy="30" r="2" opacity="0.3" />
      <circle cx="18" cy="30" r="2" opacity="0.3" />
      <circle cx="30" cy="30" r="2" opacity="0.3" />
      <circle cx="42" cy="30" r="2" opacity="0.3" />
    </svg>
  ),
}

export default function LandingPage() {
  const navigate = useNavigate()
  const { t } = useTranslation('landing')
  const { t: tTeam } = useTranslation('team')

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] text-[var(--color-ink)] transition-colors">
      {/* Full Header Navbar */}
      <Navbar showNavLinks />

      <main>
        {/* HERO SECTION */}
        <section
          id="hero"
          className="relative overflow-hidden bg-[var(--color-hero-wash)] border-b border-[var(--color-hero-line)] pt-12 pb-20 md:pt-16 md:pb-28"
        >
          {/* Subtle diagonal-grid pattern at 7% opacity fading out toward edges */}
          <div
            className="pointer-events-none absolute inset-0 select-none"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, var(--color-hero-line) 0, var(--color-hero-line) 1px, transparent 0, transparent 24px)',
              opacity: 0.07,
              maskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 80%)',
              WebkitMaskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 80%)',
            }}
            aria-hidden="true"
          />

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
              {/* Left Column: Headline, Subhead, CTA, Trust */}
              <div className="lg:col-span-6 xl:col-span-7 text-center lg:text-left">
                {/* Note: Hero eyebrow pill intentionally removed per Section 0 rules */}

                {/* Display Headline */}
                <motion.h1
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...transitions.reveal, delay: 0.08 }}
                  className="font-[family-name:var(--font-display)] text-4xl sm:text-5xl md:text-6xl font-extrabold leading-[1.08] tracking-tight text-[var(--color-ink)]"
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
                  className="mt-6 max-w-2xl text-base sm:text-lg text-[var(--color-hero-muted)] leading-relaxed mx-auto lg:mx-0"
                >
                  {t('hero.subheading')}
                </motion.p>

                {/* CTA Buttons */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...transitions.reveal, delay: 0.22 }}
                  className="mt-8 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5"
                >
                  <button
                    type="button"
                    onClick={() => navigate('/signup')}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-8 py-3.5 text-sm font-bold text-white dark:text-[#0E1116] shadow-xs hover:bg-[var(--color-accent-hover)] transition-all transform active:scale-[0.98] cursor-pointer"
                  >
                    <span>{t('hero.ctaPrimary')}</span>
                    <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
                  </button>
                  <a
                    href="#how-it-works"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-6 py-3.5 text-sm font-semibold text-[var(--color-ink)] hover:bg-[var(--color-surface-2)] transition-colors"
                  >
                    <span>{t('hero.ctaSecondary')}</span>
                  </a>
                </motion.div>

                {/* Trust Indicators Row */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ ...transitions.reveal, delay: 0.3 }}
                  className="mt-10 pt-6 border-t border-[var(--color-hero-line)] flex flex-wrap items-center justify-center lg:justify-start gap-6 sm:gap-8"
                >
                  <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-ink)]">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-success-soft)] text-[var(--color-success)] shrink-0">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </div>
                    <span>{t('hero.trust1')}</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-ink)]">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-success-soft)] text-[var(--color-success)] shrink-0">
                      <ShieldCheck className="h-3 w-3" strokeWidth={2.5} />
                    </div>
                    <span>{t('hero.trust2')}</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-ink)]">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-success-soft)] text-[var(--color-success)] shrink-0">
                      <Zap className="h-3 w-3" strokeWidth={2.5} />
                    </div>
                    <span>{t('hero.trust3')}</span>
                  </div>
                </motion.div>
              </div>

              {/* Right Column: Tilted Window Card Product Visual */}
              <div className="lg:col-span-6 xl:col-span-5">
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ ...transitions.reveal, delay: 0.28 }}
                  className="relative mx-auto max-w-lg lg:max-w-none"
                  aria-hidden="true"
                >
                  {/* Tilted White Window Card */}
                  <div className="rounded-2xl border border-[var(--color-line)] bg-white dark:bg-[var(--color-surface)] p-5 sm:p-6 shadow-[var(--shadow-cool-lg)] transform lg:rotate-[-1.5deg] hover:rotate-0 transition-transform duration-350 ease-out">
                    {/* Window top bar */}
                    <div className="flex items-center justify-between border-b border-[var(--color-line-subtle)] pb-3">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
                        <div className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
                        <div className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
                      </div>
                      <div className="h-2 w-20 rounded-full bg-[var(--color-line)]" />
                      <div className="h-2 w-8 rounded-full bg-[var(--color-line-subtle)]" />
                    </div>

                    {/* 3 Mini Stat Tiles with Sparklines */}
                    <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
                      {/* Stat 1: Blue tint */}
                      <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-tint-blue)] p-2.5">
                        <span className="text-[10px] font-semibold text-[var(--color-muted)] block truncate">
                          {t('features.cashDashboard.title')}
                        </span>
                        <div className="mt-1 flex items-baseline justify-between">
                          <span
                            data-tabular="true"
                            className="font-[family-name:var(--font-display)] text-sm sm:text-base font-bold text-[var(--color-ink)]"
                          >
                            ₹ 4.8L
                          </span>
                          <svg className="w-8 h-4 text-[var(--color-accent)]" viewBox="0 0 32 16" fill="none">
                            <path d="M1 14 L 10 10 L 18 12 L 31 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        </div>
                      </div>

                      {/* Stat 2: Green tint */}
                      <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-tint-green)] p-2.5">
                        <span className="text-[10px] font-semibold text-[var(--color-muted)] block truncate">
                          {t('features.documentParser.title')}
                        </span>
                        <div className="mt-1 flex items-baseline justify-between">
                          <span
                            data-tabular="true"
                            className="font-[family-name:var(--font-display)] text-sm sm:text-base font-bold text-[var(--color-ink)]"
                          >
                            99.4%
                          </span>
                          <svg className="w-8 h-4 text-[var(--color-dept-finance)]" viewBox="0 0 32 16" fill="none">
                            <path d="M1 12 L 11 13 L 20 6 L 31 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        </div>
                      </div>

                      {/* Stat 3: Amber tint */}
                      <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-tint-amber)] p-2.5">
                        <span className="text-[10px] font-semibold text-[var(--color-muted)] block truncate">
                          {t('features.invoiceGenerator.title')}
                        </span>
                        <div className="mt-1 flex items-baseline justify-between">
                          <span
                            data-tabular="true"
                            className="font-[family-name:var(--font-display)] text-sm sm:text-base font-bold text-[var(--color-ink)]"
                          >
                            1,420
                          </span>
                          <svg className="w-8 h-4 text-[var(--color-highlight)]" viewBox="0 0 32 16" fill="none">
                            <path d="M1 15 L 12 8 L 22 9 L 31 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Area Chart: draws itself once with Saffron line and soft gradient fill */}
                    <div className="mt-4 rounded-xl border border-[var(--color-line-subtle)] bg-[var(--color-surface-2)] p-3">
                      <div className="flex items-center justify-between pb-1 text-[11px] font-semibold text-[var(--color-muted)]">
                        <span>{t('features.cashDashboard.title')}</span>
                        <span className="text-xs font-bold text-[var(--color-success)]">+18.2%</span>
                      </div>
                      <div className="relative aspect-[16/7] w-full overflow-hidden">
                        <svg className="w-full h-full overflow-visible" viewBox="0 0 400 130" fill="none">
                          <defs>
                            <filter id="heroSaffronGlow" x="-20%" y="-20%" width="140%" height="140%">
                              <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#FF8A1F" floodOpacity="0.4" />
                            </filter>
                            <linearGradient id="saffronGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="var(--color-highlight)" stopOpacity="0.38" />
                              <stop offset="70%" stopColor="var(--color-highlight)" stopOpacity="0.08" />
                              <stop offset="100%" stopColor="var(--color-highlight)" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>
                          {/* Reference grid lines */}
                          <line x1="0" y1="40" x2="400" y2="40" stroke="var(--color-line)" strokeWidth="1" strokeDasharray="3 3" />
                          <line x1="0" y1="85" x2="400" y2="85" stroke="var(--color-line)" strokeWidth="1" strokeDasharray="3 3" />

                          {/* Soft gradient fill underneath */}
                          <motion.path
                            d="M 10 110 Q 80 100 140 65 T 260 50 T 390 15 L 390 125 L 10 125 Z"
                            fill="url(#saffronGradient)"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 1.2, delay: 0.2 }}
                          />

                          {/* Saffron line self-drawing path with glowing filter */}
                          <motion.path
                            d="M 10 110 Q 80 100 140 65 T 260 50 T 390 15"
                            fill="none"
                            stroke="var(--color-highlight)"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            filter="url(#heroSaffronGlow)"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
                          />

                          {/* Pulse dot on the peak */}
                          <g transform="translate(390, 15)">
                            <motion.circle
                              r="8"
                              className="fill-[var(--color-highlight)]/30"
                              animate={{ r: [5, 11, 5], opacity: [0.8, 0.15, 0.8] }}
                              transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
                            />
                            <circle r="4.5" fill="var(--color-highlight)" stroke="#FFFFFF" strokeWidth="2" />
                          </g>

                          {/* Data marker circles */}
                          <circle cx="140" cy="65" r="3.5" fill="var(--color-surface)" stroke="var(--color-highlight)" strokeWidth="2.5" />
                          <circle cx="260" cy="50" r="3.5" fill="var(--color-surface)" stroke="var(--color-highlight)" strokeWidth="2.5" />
                        </svg>
                      </div>
                    </div>

                    {/* 3 Document Rows with Bank, Invoice, Pen icons and Department-colored Chips */}
                    <div className="mt-4 space-y-2">
                      {/* Row 1: Bank (Finance green) */}
                      <div className="flex items-center justify-between rounded-xl border border-[var(--color-line-subtle)] bg-[var(--color-surface)] px-3 py-2 text-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-tint-green)] text-[var(--color-dept-finance)] shrink-0">
                            <Building2 className="h-4 w-4" />
                          </div>
                          <span className="font-medium text-[var(--color-ink)] truncate max-w-[140px] sm:max-w-[180px]">
                            {t('features.documentParser.title')}
                          </span>
                        </div>
                        <span className="rounded-md px-2 py-0.5 text-[10px] font-bold text-white bg-[var(--color-dept-finance)] shrink-0">
                          {tTeam('departments.finance')}
                        </span>
                      </div>

                      {/* Row 2: Invoice (Sales blue) */}
                      <div className="flex items-center justify-between rounded-xl border border-[var(--color-line-subtle)] bg-[var(--color-surface)] px-3 py-2 text-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-tint-blue)] text-[var(--color-dept-sales)] shrink-0">
                            <Receipt className="h-4 w-4" />
                          </div>
                          <span className="font-medium text-[var(--color-ink)] truncate max-w-[140px] sm:max-w-[180px]">
                            {t('features.invoiceGenerator.title')}
                          </span>
                        </div>
                        <span className="rounded-md px-2 py-0.5 text-[10px] font-bold text-white bg-[var(--color-dept-sales)] shrink-0">
                          {tTeam('departments.sales')}
                        </span>
                      </div>

                      {/* Row 3: Pen / Document (HR purple) */}
                      <div className="flex items-center justify-between rounded-xl border border-[var(--color-line-subtle)] bg-[var(--color-surface)] px-3 py-2 text-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F5EFFE] dark:bg-[#2A1D3D] text-[var(--color-dept-hr)] shrink-0">
                            <FileSpreadsheet className="h-4 w-4" />
                          </div>
                          <span className="font-medium text-[var(--color-ink)] truncate max-w-[140px] sm:max-w-[180px]">
                            {t('features.indiaLocalized.title')}
                          </span>
                        </div>
                        <span className="rounded-md px-2 py-0.5 text-[10px] font-bold text-white bg-[var(--color-dept-hr)] shrink-0">
                          {tTeam('departments.hr')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Two Small Floating Chips (one saffron, one white/cobalt) */}
                  {/* Floating Chip 1: Saffron (Restricted highlight usage) */}
                  <motion.div
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute -top-3 -right-2 sm:-right-4 z-20 flex items-center gap-1.5 rounded-full bg-[var(--color-highlight)] px-3 py-1.5 text-xs font-bold text-[var(--color-highlight-text)] shadow-md"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    <span>{t('hero.trust3')}</span>
                  </motion.div>

                  {/* Floating Chip 2: White/Cobalt */}
                  <motion.div
                    animate={{ y: [0, 6, 0] }}
                    transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                    className="absolute -bottom-4 -left-2 sm:-left-4 z-20 flex items-center gap-1.5 rounded-full bg-white dark:bg-[var(--color-surface)] border border-[var(--color-line)] px-3.5 py-1.5 text-xs font-bold text-[var(--color-ink)] shadow-md"
                  >
                    <ShieldCheck className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                    <span>{t('hero.trust2')}</span>
                  </motion.div>
                </motion.div>
              </div>
            </div>
          </div>
        </section>

        {/* BENTO GRID FEATURES SECTION */}
        <section
          id="features"
          className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 md:py-24"
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

          {/* Bento Grid: Varied tile sizes & four tints */}
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {/* Tile 1 (Large 2-col on lg, blue tint): Cash Dashboard */}
            <FeatureFlipCard
              name={t('features.cashDashboard.title')}
              tagline={t('features.cashDashboard.tagline')}
              description={t('features.cashDashboard.description')}
              icon={featureIcons.cash_dashboard}
              variant="blue"
              className="sm:col-span-2 lg:col-span-2"
              decorativeSvg={bentoSvgs.line}
            />

            {/* Tile 2 (Solid Cobalt tile): Document Parser */}
            <FeatureFlipCard
              name={t('features.documentParser.title')}
              tagline={t('features.documentParser.tagline')}
              description={t('features.documentParser.description')}
              icon={featureIcons.document_parser}
              variant="cobalt"
              decorativeSvg={bentoSvgs.bars}
            />

            {/* Tile 3 (Dark-block tile): India Localized */}
            <FeatureFlipCard
              name={t('features.indiaLocalized.title')}
              tagline={t('features.indiaLocalized.tagline')}
              description={t('features.indiaLocalized.description')}
              icon={featureIcons.india_localized}
              variant="dark"
              decorativeSvg={bentoSvgs.dottedAnomaly}
            />

            {/* Tile 4 (Large 2-col on lg, amber tint): Invoice Generator */}
            <FeatureFlipCard
              name={t('features.invoiceGenerator.title')}
              tagline={t('features.invoiceGenerator.tagline')}
              description={t('features.invoiceGenerator.description')}
              icon={featureIcons.invoice_generator}
              variant="amber"
              className="sm:col-span-2 lg:col-span-2"
              decorativeSvg={bentoSvgs.ring}
            />
          </div>
        </section>

        {/* HOW IT WORKS SECTION (DARK BLOCK RHYTHM) */}
        <section
          id="how-it-works"
          className="bg-[var(--color-dark-block)] text-[var(--color-dark-text)] py-20 md:py-24 border-y border-[var(--color-dark-line)]"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-accent)]">
                {t('howItWorks.eyebrow')}
              </span>
              <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-bold text-[var(--color-dark-text)]">
                {t('howItWorks.heading')}
              </h2>
            </div>

            <div className="mt-14 grid gap-6 md:grid-cols-3">
              {/* Card 1: Sales blue top border */}
              <div className="rounded-2xl border border-[var(--color-dark-line)] border-t-4 border-t-[var(--color-dept-sales)] bg-[var(--color-dark-surface)] p-6 text-center shadow-md">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-accent)] text-white dark:text-[#0E1116] font-bold text-base shadow-xs">
                  1
                </div>
                <h3 className="mt-4 font-[family-name:var(--font-display)] font-bold text-base text-[var(--color-dark-text)]">
                  {t('howItWorks.step1Title')}
                </h3>
                <p className="mt-2 text-xs text-[var(--color-dark-muted)] leading-relaxed">
                  {t('howItWorks.step1Desc')}
                </p>
              </div>

              {/* Card 2: Finance green top border */}
              <div className="rounded-2xl border border-[var(--color-dark-line)] border-t-4 border-t-[var(--color-dept-finance)] bg-[var(--color-dark-surface)] p-6 text-center shadow-md">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-accent)] text-white dark:text-[#0E1116] font-bold text-base shadow-xs">
                  2
                </div>
                <h3 className="mt-4 font-[family-name:var(--font-display)] font-bold text-base text-[var(--color-dark-text)]">
                  {t('howItWorks.step2Title')}
                </h3>
                <p className="mt-2 text-xs text-[var(--color-dark-muted)] leading-relaxed">
                  {t('howItWorks.step2Desc')}
                </p>
              </div>

              {/* Card 3: HR purple top border */}
              <div className="rounded-2xl border border-[var(--color-dark-line)] border-t-4 border-t-[var(--color-dept-hr)] bg-[var(--color-dark-surface)] p-6 text-center shadow-md">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-accent)] text-white dark:text-[#0E1116] font-bold text-base shadow-xs">
                  3
                </div>
                <h3 className="mt-4 font-[family-name:var(--font-display)] font-bold text-base text-[var(--color-dark-text)]">
                  {t('howItWorks.step3Title')}
                </h3>
                <p className="mt-2 text-xs text-[var(--color-dark-muted)] leading-relaxed">
                  {t('howItWorks.step3Desc')}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* PRICING SECTION */}
        <section
          id="pricing"
          className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 md:py-24"
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

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {TIERS.map((tier) => (
              <PricingTierCard key={tier.id} tier={tier} onSelect={() => navigate('/signup')} />
            ))}

            {/* Custom Plan Option Card */}
            <div className="flex flex-col justify-between rounded-2xl border-2 border-dashed border-[var(--color-line)] bg-[var(--color-surface)] p-6 shadow-xs hover:border-[var(--color-accent)]/60 hover:shadow-[var(--shadow-cool-md)] transition-all">
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
                className="mt-8 w-full rounded-xl border border-[var(--color-accent)] py-3 text-xs font-bold text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-white dark:hover:text-[#0E1116] transition-all cursor-pointer active:scale-[0.98]"
              >
                {t('pricing.customCta')}
              </button>
            </div>
          </div>
        </section>

        {/* MSME GUIDE BANNER */}
        <section className="mx-auto max-w-5xl px-4 sm:px-6 pb-20">
          <div className="rounded-3xl border border-[var(--color-line)] bg-[var(--color-surface)] p-8 sm:p-12 text-center shadow-[var(--shadow-cool-md)]">
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

      {/* Dark-Block Footer */}
      <footer className="border-t border-[var(--color-dark-line)] bg-[var(--color-dark-block)] py-10 text-[var(--color-dark-muted)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <span>{t('footer.copyright')}</span>
          <div className="flex gap-6">
            <Link to="/login" className="hover:text-white transition-colors">
              {t('footer.logIn')}
            </Link>
            <Link to="/signup" className="hover:text-white transition-colors">
              {t('footer.signUp')}
            </Link>
            <Link to="/msme-guide" className="hover:text-white transition-colors">
              {t('nav.msmeGuideShort', { ns: 'common' })}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
