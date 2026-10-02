import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Navbar from '../components/Navbar'
import FeatureFlipCard from '../components/FeatureFlipCard'
import PricingTierCard from '../components/PricingTierCard'
import { TIERS } from '../lib/featuresData'

// Icons stay fixed regardless of language - only the title/tagline/
// description keys change, pulled from the "landing" translation
// namespace inside the component itself (translation hooks only work
// inside components, not in this static module-level array).
const featureIcons = {
  document_parser: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  cash_dashboard: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  ),
  invoice_generator: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <line x1="6" y1="8" x2="10" y2="8" />
      <line x1="6" y1="12" x2="18" y2="12" />
    </svg>
  ),
  india_localized: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="m4.93 4.93 4.24 4.24M14.83 9.17l4.24-4.24M14.83 14.83l4.24 4.24M4.93 19.07l4.24-4.24" />
    </svg>
  ),
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
    <div className="min-h-screen bg-[#FBF3EC] dark:bg-[#1A1714] text-[#2A2521] dark:text-[#F5EFE8] transition-colors">
      {/* Full Header Navbar */}
      <Navbar showNavLinks />

      <main>
        {/* HERO SECTION - NO IMAGE */}
        <section id="hero" className="mx-auto max-w-5xl px-6 pt-16 pb-20 md:pt-24 md:pb-28 text-center">
          
          {/* Top Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-[#E8622C]/30 dark:border-[#F27A4A]/30 bg-[#E8622C]/10 dark:bg-[#F27A4A]/10 px-3.5 py-1 text-xs font-semibold text-[#E8622C] dark:text-[#F27A4A] shadow-xs mb-8">
            <span className="h-2 w-2 rounded-full bg-[#E8622C] dark:bg-[#F27A4A] animate-pulse" />
            <span>{t('hero.badge')}</span>
          </div>

          {/* Headline */}
          <h1 className="font-[family-name:var(--font-display)] text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.1] tracking-tight text-[#2A2521] dark:text-[#F5EFE8]">
            {t('hero.headline1')} <br className="hidden sm:block" />
            <span className="text-[#E8622C] dark:text-[#F27A4A] relative inline-block">
              {t('hero.headlineHighlight')}
              <svg className="absolute -bottom-2 left-0 w-full text-[#E8622C]/30 dark:text-[#F27A4A]/30" viewBox="0 0 100 20" preserveAspectRatio="none">
                <path d="M0 15 Q 50 0 100 15" fill="none" stroke="currentColor" strokeWidth="4" />
              </svg>
            </span>
          </h1>

          {/* Subheading */}
          <p className="mx-auto mt-8 max-w-2xl text-base sm:text-lg text-[#8A7F74] dark:text-[#A89E92] leading-relaxed">
            {t('hero.subheading')}
          </p>

          {/* Primary CTA */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('/signup')}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-[#E8622C] dark:bg-[#F27A4A] px-8 py-4 text-sm font-bold text-white shadow-lg shadow-[#E8622C]/25 hover:bg-[#D4531F] dark:hover:bg-[#E56938] transition-all transform active:scale-95 cursor-pointer"
            >
              <span>{t('hero.ctaPrimary')}</span>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
            <a
              href="#how-it-works"
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] px-6 py-4 text-sm font-semibold text-[#2A2521] dark:text-[#F5EFE8] hover:border-[#E8622C] dark:hover:border-[#F27A4A] transition-colors"
            >
              <span>{t('hero.ctaSecondary')}</span>
            </a>
          </div>

          {/* Trust Indicators Row */}
          <div className="mt-14 pt-10 border-t border-[#F0E4D8] dark:border-[#3A332A] flex flex-wrap items-center justify-center gap-8 sm:gap-12">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#2A2521] dark:text-[#F5EFE8]">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1F9254]/10 text-[#1F9254]">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <span>{t('hero.trust1')}</span>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-[#2A2521] dark:text-[#F5EFE8]">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1F9254]/10 text-[#1F9254]">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <span>{t('hero.trust2')}</span>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-[#2A2521] dark:text-[#F5EFE8]">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1F9254]/10 text-[#1F9254]">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <span>{t('hero.trust3')}</span>
            </div>
          </div>
        </section>

        {/* 4-COLUMN FEATURE GRID SECTION */}
        <section id="features" className="mx-auto max-w-7xl px-6 py-20 border-t border-[#F0E4D8] dark:border-[#3A332A]">
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-[#E8622C] dark:text-[#F27A4A]">{t('features.eyebrow')}</span>
            <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-bold tracking-tight text-[#2A2521] dark:text-[#F5EFE8]">
              {t('features.heading')}
            </h2>
            <p className="mt-3 text-sm text-[#8A7F74] dark:text-[#A89E92]">
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
        <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-20 border-t border-[#F0E4D8] dark:border-[#3A332A]">
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-[#E8622C] dark:text-[#F27A4A]">{t('howItWorks.eyebrow')}</span>
            <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold text-[#2A2521] dark:text-[#F5EFE8]">
              {t('howItWorks.heading')}
            </h2>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-3">
            <div className="rounded-2xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] p-6 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8622C] text-white font-bold text-lg">
                1
              </div>
              <h3 className="mt-4 font-[family-name:var(--font-display)] font-bold text-base text-[#2A2521] dark:text-[#F5EFE8]">{t('howItWorks.step1Title')}</h3>
              <p className="mt-2 text-xs text-[#8A7F74] dark:text-[#A89E92]">{t('howItWorks.step1Desc')}</p>
            </div>

            <div className="rounded-2xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] p-6 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8622C] text-white font-bold text-lg">
                2
              </div>
              <h3 className="mt-4 font-[family-name:var(--font-display)] font-bold text-base text-[#2A2521] dark:text-[#F5EFE8]">{t('howItWorks.step2Title')}</h3>
              <p className="mt-2 text-xs text-[#8A7F74] dark:text-[#A89E92]">{t('howItWorks.step2Desc')}</p>
            </div>

            <div className="rounded-2xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] p-6 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8622C] text-white font-bold text-lg">
                3
              </div>
              <h3 className="mt-4 font-[family-name:var(--font-display)] font-bold text-base text-[#2A2521] dark:text-[#F5EFE8]">{t('howItWorks.step3Title')}</h3>
              <p className="mt-2 text-xs text-[#8A7F74] dark:text-[#A89E92]">{t('howItWorks.step3Desc')}</p>
            </div>
          </div>
        </section>

        {/* PRICING SECTION */}
        <section id="pricing" className="mx-auto max-w-7xl px-6 py-20 border-t border-[#F0E4D8] dark:border-[#3A332A]">
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-[#E8622C] dark:text-[#F27A4A]">{t('pricing.eyebrow')}</span>
            <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-bold text-[#2A2521] dark:text-[#F5EFE8]">
              {t('pricing.heading')}
            </h2>
            <p className="mt-2 text-sm text-[#8A7F74] dark:text-[#A89E92]">
              {t('pricing.subheading')}
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {TIERS.map((tier) => (
              <PricingTierCard key={tier.id} tier={tier} onSelect={() => navigate('/signup')} />
            ))}
            
            {/* Custom Plan Option Card */}
            <div className="flex flex-col justify-between rounded-2xl border border-dashed border-[#E8622C]/50 dark:border-[#F27A4A]/50 bg-[#FFFFFF] dark:bg-[#242019] p-6 shadow-sm">
              <div>
                <span className="rounded-full bg-[#E8622C]/10 dark:bg-[#F27A4A]/20 px-2.5 py-0.5 text-[10px] font-bold text-[#E8622C] dark:text-[#F27A4A]">{t('pricing.customBadge')}</span>
                <h3 className="mt-3 font-[family-name:var(--font-display)] text-xl font-bold text-[#2A2521] dark:text-[#F5EFE8]">{t('pricing.customTitle')}</h3>
                <p className="mt-1 text-xs text-[#8A7F74] dark:text-[#A89E92]">{t('pricing.customTagline')}</p>
                <p className="mt-6 text-xs text-[#2A2521]/80 dark:text-[#F5EFE8]/80 leading-relaxed">
                  {t('pricing.customDescription')}
                </p>
              </div>
              <button
                onClick={() => navigate('/signup')}
                className="mt-8 w-full rounded-xl border border-[#E8622C] dark:border-[#F27A4A] py-3 text-xs font-bold text-[#E8622C] dark:text-[#F27A4A] hover:bg-[#E8622C] hover:text-white dark:hover:bg-[#F27A4A] dark:hover:text-[#1A1714] transition-all cursor-pointer"
              >
                {t('pricing.customCta')}
              </button>
            </div>
          </div>
        </section>

        {/* MSME GUIDE BANNER */}
        <section className="mx-auto max-w-5xl px-6 py-20 border-t border-[#F0E4D8] dark:border-[#3A332A]">
          <div className="rounded-3xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] p-8 sm:p-12 text-center shadow-md">
            <span className="inline-block rounded-full bg-[#1F9254]/10 dark:bg-[#132E21] px-3 py-1 text-xs font-bold text-[#1F9254] dark:text-[#34D399]">
              {t('msmeBanner.badge')}
            </span>
            <h2 className="mt-4 font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-bold text-[#2A2521] dark:text-[#F5EFE8]">
              {t('msmeBanner.heading')}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-[#8A7F74] dark:text-[#A89E92] leading-relaxed">
              {t('msmeBanner.description')}
            </p>
            <Link
              to="/msme-guide"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#2A2521] dark:bg-[#F5EFE8] px-6 py-3 text-xs font-bold text-white dark:text-[#1A1714] hover:bg-[#E8622C] dark:hover:bg-[#F27A4A] dark:hover:text-white transition-all cursor-pointer"
            >
              <span>{t('msmeBanner.cta')}</span>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] py-8">
        <div className="mx-auto max-w-7xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#8A7F74] dark:text-[#A89E92]">
          <span>{t('footer.copyright')}</span>
          <div className="flex gap-6">
            <Link to="/login" className="hover:text-[#E8622C] dark:hover:text-[#F27A4A] transition-colors">{t('footer.logIn')}</Link>
            <Link to="/signup" className="hover:text-[#E8622C] dark:hover:text-[#F27A4A] transition-colors">{t('footer.signUp')}</Link>
            <Link to="/msme-guide" className="hover:text-[#E8622C] dark:hover:text-[#F27A4A] transition-colors">{t('nav.msmeGuideShort', { ns: 'common' })}</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
