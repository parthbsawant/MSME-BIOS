import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'

const classification = [
  { tier: 'Micro', investment: 'Up to \u20b92.5 crore', turnover: 'Up to \u20b910 crore' },
  { tier: 'Small', investment: 'Up to \u20b925 crore', turnover: 'Up to \u20b9100 crore' },
  { tier: 'Medium', investment: 'Up to \u20b9125 crore', turnover: 'Up to \u20b9500 crore' },
]

const whoCanRegister = [
  'Proprietorships and HUFs',
  'Partnership firms and LLPs',
  'Private and public limited companies',
  'Co-operative societies, trusts, and self-help groups',
  'Manufacturing, service, and trading businesses alike',
]

const steps = [
  { title: 'Go to the official portal', detail: 'udyamregistration.gov.in \u2014 this is the only site you need. Registration is completely free; be cautious of third parties charging a fee to do this for you.' },
  { title: 'Verify with Aadhaar', detail: 'Enter the Aadhaar number of the proprietor (or authorised signatory, for a company/LLP) and the name exactly as it appears on the Aadhaar card. An OTP is sent to the linked mobile number.' },
  { title: 'Verify PAN', detail: 'Enter the business or proprietor\u2019s PAN. The portal validates it automatically.' },
  { title: 'Fill in business details', detail: 'Business name, address, bank account and IFSC, NIC activity code (what the business actually does), and number of employees.' },
  { title: 'Declare investment and turnover', detail: 'These figures are what determine which category \u2014 Micro, Small, or Medium \u2014 the business falls into.' },
  { title: 'Submit and receive your certificate', detail: 'A Udyam Registration Number (URN) is generated immediately, and the official e-certificate is emailed shortly after. No documents are uploaded \u2014 the whole process is based on self-declaration.' },
]

const benefits = [
  {
    title: 'Collateral-free loans',
    detail: 'Through the CGTMSE scheme, government-guaranteed loans are available without needing to pledge property or assets as security \u2014 often the single biggest barrier small businesses face when applying for credit.',
  },
  {
    title: 'Lower interest rates',
    detail: 'Registered MSMEs typically qualify for priority-sector lending, meaning banks offer meaningfully lower interest rates than standard commercial loans.',
  },
  {
    title: 'Protection against late payment',
    detail: 'Under the MSMED Act, a buyer is legally required to pay a registered MSME within 45 days \u2014 a real, enforceable protection that unregistered businesses don\u2019t have.',
  },
  {
    title: 'Preference in government tenders',
    detail: 'A share of central government procurement is specifically reserved for Micro and Small Enterprises with Udyam registration.',
  },
  {
    title: 'Subsidies on growth costs',
    detail: 'Reduced fees on patent and trademark registration, reimbursement on ISO certification, and subsidy schemes like PMEGP (new ventures) and CLCSS (technology upgrades).',
  },
  {
    title: 'Tax and compliance benefits',
    detail: 'Including extended MAT credit carry-forward and, in many states, concessions on electricity bills.',
  },
]

export default function MSMEGuidePage() {
  return (
    <div className="min-h-screen bg-white text-black dark:bg-black dark:text-white transition-colors">
      <Navbar showNavLinks />

      <main className="mx-auto max-w-4xl px-6 py-20">
        <p className="font-[family-name:var(--font-data)] text-xs text-black/40 dark:text-white/40">A plain guide</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight md:text-5xl">
          What is an MSME, and should you register as one?
        </h1>
        <p className="mt-4 max-w-xl text-lg text-black/70 dark:text-white/70">
          If you run a small or growing business in India, this is probably the single highest-value, lowest-effort thing you can do for it &mdash; and it&rsquo;s free. Here&rsquo;s what it actually means, whether you qualify, and exactly how to do it.
        </p>

        {/* What is an MSME */}
        <section className="mt-16 border-t border-black/15 dark:border-white/15 pt-10">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">What is an MSME?</h2>
          <p className="mt-4 text-black/70 dark:text-white/70 leading-relaxed">
            MSME stands for Micro, Small, and Medium Enterprise &mdash; a classification the Government of India uses to identify smaller businesses and extend specific support to them: easier credit, tax relief, and protection that larger businesses don&rsquo;t get. <strong className="text-black dark:text-white">Udyam Registration</strong> is the official, free process for getting that recognition.
          </p>
        </section>

        {/* Classification table */}
        <section className="mt-16 border-t border-black/15 dark:border-white/15 pt-10">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">Do you qualify?</h2>
          <p className="mt-4 text-black/70 dark:text-white/70 leading-relaxed">
            Classification is based on two things together &mdash; how much you&rsquo;ve invested in plant, machinery, or equipment, and your annual turnover. Whichever of the two is higher determines your category. These limits were revised upward by the government in 2025 (Notification S.O. 1364(E), effective 1 April 2025), specifically so growing businesses don&rsquo;t lose MSME status just for scaling up.
          </p>
          <div className="mt-8 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-black/15 dark:border-white/15 text-black/50 dark:text-white/50">
                  <th className="pb-3 font-medium">Category</th>
                  <th className="pb-3 pl-4 font-medium">Investment limit</th>
                  <th className="pb-3 pl-4 font-medium">Turnover limit</th>
                </tr>
              </thead>
              <tbody className="font-[family-name:var(--font-data)]">
                {classification.map((row) => (
                  <tr key={row.tier} className="border-b border-black/10 dark:border-white/10">
                    <td className="py-4 pr-4 font-[family-name:var(--font-body)] font-medium">{row.tier}</td>
                    <td className="py-4 pl-4">{row.investment}</td>
                    <td className="py-4 pl-4">{row.turnover}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-6 text-sm text-black/60 dark:text-white/60">
            This applies the same way whether the business manufactures goods, provides a service, or trades &mdash; there&rsquo;s no separate, stricter set of limits for any one type anymore.
          </p>

          <h3 className="mt-10 text-lg font-medium">Who can register</h3>
          <ul className="mt-4 space-y-2">
            {whoCanRegister.map((item) => (
              <li key={item} className="flex gap-3 text-black/70 dark:text-white/70">
                <span className="text-black/30 dark:text-white/30">&mdash;</span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* Benefits */}
        <section className="mt-16 border-t border-black/15 dark:border-white/15 pt-10">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">What you actually get</h2>
          <p className="mt-4 text-black/70 dark:text-white/70 leading-relaxed">
            Registration itself takes about 10&ndash;15 minutes. Here&rsquo;s what it unlocks once it&rsquo;s done.
          </p>
          <div className="mt-8 grid gap-8 sm:grid-cols-2">
            {benefits.map((b) => (
              <div key={b.title}>
                <p className="font-medium">{b.title}</p>
                <p className="mt-2 text-sm text-black/60 dark:text-white/60 leading-relaxed">{b.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How to register */}
        <section className="mt-16 border-t border-black/15 dark:border-white/15 pt-10">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">How to register, step by step</h2>
          <div className="mt-8 space-y-8">
            {steps.map((step, i) => (
              <div key={step.title} className="flex gap-5">
                <span className="font-[family-name:var(--font-data)] text-sm text-black/30 dark:text-white/30">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <p className="font-medium">{step.title}</p>
                  <p className="mt-1 text-sm text-black/60 dark:text-white/60 leading-relaxed">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Where to register */}
        <section className="mt-16 border-t border-black/15 dark:border-white/15 pt-10">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">Where to go</h2>
          <p className="mt-4 text-black/70 dark:text-white/70 leading-relaxed">
            The only official portal is{' '}
            <a
              href="https://udyamregistration.gov.in"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-black/70 dark:hover:text-white/70"
            >
              udyamregistration.gov.in
            </a>
            . Registration there is entirely free &mdash; if any site or consultant asks for a payment to "process" your Udyam registration, that's not the government portal.
          </p>
        </section>

        {/* CTA back to the product */}
        <section className="mt-20 border-t border-black/15 dark:border-white/15 pt-10 text-center">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">
            Already registered &mdash; or not sure yet?
          </h2>
          <p className="mt-3 text-black/60 dark:text-white/60">
            Either way, MSME-BIOS can help you run the business itself &mdash; starting with turning your bills and statements into real records.
          </p>
          <Link
            to="/signup"
            className="mt-6 inline-block bg-black px-7 py-3 text-sm font-medium text-white dark:bg-white dark:text-black hover:opacity-80 transition-opacity"
          >
            Get started
          </Link>
        </section>
      </main>
    </div>
  )
}
