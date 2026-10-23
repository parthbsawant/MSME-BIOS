import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Navbar from '../components/Navbar'

export default function MSMEGuidePage() {
  const { t } = useTranslation('guide')

  // Lists come from the locale file as arrays so each language controls
  // its own wording and item count.
  const classification = t('qualify.rows', { returnObjects: true })
  const whoCanRegister = t('qualify.who', { returnObjects: true })
  const benefits = t('benefits.items', { returnObjects: true })
  const steps = t('steps.items', { returnObjects: true })

  return (
    <div className="min-h-screen bg-[#FBF3EC] dark:bg-[#1A1714] text-[#2A2521] dark:text-[#F5EFE8] transition-colors">
      <Navbar showNavLinks />

      <main className="mx-auto max-w-4xl px-6 py-16">
        <span className="rounded-full bg-[#E8622C]/10 dark:bg-[#F27A4A]/20 px-3 py-1 text-xs font-bold text-[#E8622C] dark:text-[#F27A4A]">
          {t('badge')}
        </span>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-[#2A2521] dark:text-[#F5EFE8]">
          {t('title')}
        </h1>
        <p className="mt-4 text-base sm:text-lg text-[#8A7F74] dark:text-[#A89E92] leading-relaxed">
          {t('intro')}
        </p>

        {/* What is an MSME */}
        <section className="mt-12 rounded-3xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] p-8 shadow-sm">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[#2A2521] dark:text-[#F5EFE8]">{t('what.title')}</h2>
          <p className="mt-3 text-sm text-[#8A7F74] dark:text-[#A89E92] leading-relaxed">
            {t('what.body1')}<strong className="text-[#2A2521] dark:text-[#F5EFE8]">{t('what.strong')}</strong>{t('what.body2')}
          </p>
        </section>

        {/* Qualification & Table */}
        <section className="mt-8 rounded-3xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] p-8 shadow-sm">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[#2A2521] dark:text-[#F5EFE8]">{t('qualify.title')}</h2>
          <p className="mt-3 text-sm text-[#8A7F74] dark:text-[#A89E92] leading-relaxed">
            {t('qualify.intro')}
          </p>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#F0E4D8] dark:border-[#3A332A] text-[#8A7F74] dark:text-[#A89E92] font-semibold">
                  <th className="pb-3 pr-4">{t('qualify.headers.category')}</th>
                  <th className="pb-3 px-4">{t('qualify.headers.investment')}</th>
                  <th className="pb-3 pl-4">{t('qualify.headers.turnover')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0E4D8] dark:divide-[#3A332A]/50 font-[family-name:var(--font-data)]">
                {classification.map((row) => (
                  <tr key={row.tier}>
                    <td className="py-3.5 pr-4 font-[family-name:var(--font-body)] font-bold text-[#E8622C] dark:text-[#F27A4A]">{row.tier}</td>
                    <td className="py-3.5 px-4 text-[#2A2521] dark:text-[#F5EFE8]">{row.investment}</td>
                    <td className="py-3.5 pl-4 text-[#2A2521] dark:text-[#F5EFE8]">{row.turnover}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="mt-8 font-[family-name:var(--font-display)] text-base font-bold text-[#2A2521] dark:text-[#F5EFE8]">{t('qualify.whoTitle')}</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {whoCanRegister.map((item) => (
              <div key={item} className="flex items-center gap-2 text-xs text-[#2A2521] dark:text-[#F5EFE8]">
                <svg className="h-4 w-4 text-[#1F9254] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Benefits Grid */}
        <section className="mt-8 rounded-3xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] p-8 shadow-sm">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[#2A2521] dark:text-[#F5EFE8]">{t('benefits.title')}</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {benefits.map((b) => (
              <div key={b.title} className="rounded-2xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FBF3EC]/50 dark:bg-[#1A1714]/50 p-4">
                <h4 className="font-[family-name:var(--font-display)] text-sm font-bold text-[#E8622C] dark:text-[#F27A4A]">{b.title}</h4>
                <p className="mt-1.5 text-xs text-[#8A7F74] dark:text-[#A89E92] leading-relaxed">{b.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Steps */}
        <section className="mt-8 rounded-3xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] p-8 shadow-sm">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[#2A2521] dark:text-[#F5EFE8]">{t('steps.title')}</h2>
          <div className="mt-6 space-y-4">
            {steps.map((step, i) => (
              <div key={step.title} className="flex items-start gap-4 rounded-2xl border border-[#F0E4D8] dark:border-[#3A332A] p-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#E8622C] text-white font-bold text-xs">
                  {i + 1}
                </span>
                <div>
                  <h4 className="font-[family-name:var(--font-display)] text-sm font-bold text-[#2A2521] dark:text-[#F5EFE8]">{step.title}</h4>
                  <p className="mt-1 text-xs text-[#8A7F74] dark:text-[#A89E92] leading-relaxed">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Banner */}
        <div className="mt-12 rounded-3xl border border-[#E8622C]/40 dark:border-[#F27A4A]/40 bg-[#FFFFFF] dark:bg-[#242019] p-8 text-center shadow-lg">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[#2A2521] dark:text-[#F5EFE8]">
            {t('cta.title')}
          </h2>
          <p className="mt-2 text-xs text-[#8A7F74] dark:text-[#A89E92]">
            {t('cta.body')}
          </p>
          <Link
            to="/signup"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#E8622C] dark:bg-[#F27A4A] px-7 py-3 text-xs font-bold text-white shadow-md hover:bg-[#D4531F] dark:hover:bg-[#E56938] transition-all cursor-pointer"
          >
            <span>{t('cta.button')}</span>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </Link>
        </div>
      </main>
    </div>
  )
}
