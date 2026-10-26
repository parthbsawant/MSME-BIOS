import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Check, ArrowRight } from 'lucide-react'
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
    <div className="min-h-screen bg-[var(--color-canvas)] text-[var(--color-ink)] transition-colors">
      <Navbar showNavLinks />

      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-12 md:py-16">
        <span className="inline-block rounded-full bg-[var(--color-accent-soft)] px-3 py-1 text-xs font-bold text-[var(--color-accent)]">
          {t('badge')}
        </span>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-[var(--color-ink)]">
          {t('title')}
        </h1>
        <p className="mt-4 text-base sm:text-lg text-[var(--color-muted)] leading-relaxed max-w-3xl">
          {t('intro')}
        </p>

        {/* What is an MSME */}
        <section className="mt-10 rounded-3xl border border-[var(--color-line)] bg-[var(--color-surface)] p-6 sm:p-8 shadow-xs">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-ink)]">
            {t('what.title')}
          </h2>
          <p className="mt-3 text-sm text-[var(--color-muted)] leading-relaxed">
            {t('what.body1')}
            <strong className="text-[var(--color-ink)] font-semibold">{t('what.strong')}</strong>
            {t('what.body2')}
          </p>
        </section>

        {/* Qualification & Table */}
        <section className="mt-8 rounded-3xl border border-[var(--color-line)] bg-[var(--color-surface)] p-6 sm:p-8 shadow-xs">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-ink)]">
            {t('qualify.title')}
          </h2>
          <p className="mt-3 text-sm text-[var(--color-muted)] leading-relaxed">
            {t('qualify.intro')}
          </p>

          <div className="mt-6 overflow-x-auto rounded-xl border border-[var(--color-line-subtle)] bg-[var(--color-surface-2)]/40">
            <table className="w-full text-left text-xs" data-tabular="true">
              <thead>
                <tr className="border-b border-[var(--color-line)] bg-[var(--color-surface-2)] text-[var(--color-muted)] font-semibold">
                  <th className="py-3 px-4">{t('qualify.headers.category')}</th>
                  <th className="py-3 px-4">{t('qualify.headers.investment')}</th>
                  <th className="py-3 px-4">{t('qualify.headers.turnover')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line-subtle)] font-[family-name:var(--font-data)]">
                {classification.map((row) => (
                  <tr key={row.tier} className="hover:bg-[var(--color-surface-2)]/80 transition-colors">
                    <td className="py-3.5 px-4 font-[family-name:var(--font-body)] font-bold text-[var(--color-accent)]">
                      {row.tier}
                    </td>
                    <td className="py-3.5 px-4 text-[var(--color-ink)]">{row.investment}</td>
                    <td className="py-3.5 px-4 text-[var(--color-ink)]">{row.turnover}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="mt-8 font-[family-name:var(--font-display)] text-base font-bold text-[var(--color-ink)]">
            {t('qualify.whoTitle')}
          </h3>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {whoCanRegister.map((item) => (
              <div key={item} className="flex items-center gap-2.5 text-xs text-[var(--color-ink)]">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-success-soft)] text-[var(--color-success)] shrink-0">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </div>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Benefits Grid */}
        <section className="mt-8 rounded-3xl border border-[var(--color-line)] bg-[var(--color-surface)] p-6 sm:p-8 shadow-xs">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-ink)]">
            {t('benefits.title')}
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {benefits.map((b) => (
              <div
                key={b.title}
                className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-2)]/60 p-4 hover:border-[var(--color-accent)]/30 hover:bg-[var(--color-surface-2)] transition-all"
              >
                <h3 className="font-[family-name:var(--font-display)] text-sm font-bold text-[var(--color-accent)]">
                  {b.title}
                </h3>
                <p className="mt-1.5 text-xs text-[var(--color-muted)] leading-relaxed">
                  {b.detail}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Steps */}
        <section className="mt-8 rounded-3xl border border-[var(--color-line)] bg-[var(--color-surface)] p-6 sm:p-8 shadow-xs">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-ink)]">
            {t('steps.title')}
          </h2>
          <div className="mt-6 space-y-4">
            {steps.map((step, i) => (
              <div
                key={step.title}
                className="flex items-start gap-4 rounded-2xl border border-[var(--color-line-subtle)] bg-[var(--color-surface)] p-4 hover:border-[var(--color-line)] transition-colors"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)] text-white font-bold text-xs shadow-xs">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-[family-name:var(--font-display)] text-sm font-bold text-[var(--color-ink)]">
                    {step.title}
                  </h3>
                  <p className="mt-1 text-xs text-[var(--color-muted)] leading-relaxed">
                    {step.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Banner */}
        <div className="mt-12 rounded-3xl border border-[var(--color-accent)]/40 bg-[var(--color-surface)] p-8 text-center shadow-[var(--shadow-warm-md)]">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-ink)]">
            {t('cta.title')}
          </h2>
          <p className="mt-2 text-xs text-[var(--color-muted)] max-w-lg mx-auto">
            {t('cta.body')}
          </p>
          <Link
            to="/signup"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-7 py-3 text-xs font-bold text-white shadow-xs hover:bg-[var(--color-accent-hover)] transition-all cursor-pointer"
          >
            <span>{t('cta.button')}</span>
            <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
          </Link>
        </div>
      </main>
    </div>
  )
}
