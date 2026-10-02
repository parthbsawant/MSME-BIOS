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
  { title: 'Go to the official portal', detail: 'udyamregistration.gov.in \u2014 this is the only site you need. Registration is completely free; be cautious of third parties charging a fee.' },
  { title: 'Verify with Aadhaar', detail: 'Enter the Aadhaar number of the proprietor (or authorised signatory) and OTP sent to the linked mobile number.' },
  { title: 'Verify PAN', detail: 'Enter the business or proprietor\u2019s PAN. The portal validates it automatically.' },
  { title: 'Fill in business details', detail: 'Business name, address, bank account & IFSC, NIC activity code, and number of employees.' },
  { title: 'Declare investment and turnover', detail: 'These figures determine which category \u2014 Micro, Small, or Medium \u2014 the business falls into.' },
  { title: 'Submit and receive your certificate', detail: 'A Udyam Registration Number (URN) is generated immediately, and the official e-certificate is emailed shortly after.' },
]

const benefits = [
  {
    title: 'Collateral-free bank loans',
    detail: 'Through CGTMSE scheme, government-guaranteed loans are available without needing to pledge property as security.',
  },
  {
    title: 'Lower interest rates',
    detail: 'Registered MSMEs qualify for priority-sector lending, offering lower interest rates than commercial bank loans.',
  },
  {
    title: 'Protection against late payment',
    detail: 'Under the MSMED Act, buyers are legally required to pay a registered MSME within 45 days.',
  },
  {
    title: 'Preference in government tenders',
    detail: 'Central government procurement reserves dedicated quotes for Micro and Small Enterprises.',
  },
  {
    title: 'Subsidies on growth costs',
    detail: 'Reduced fees on patent/trademark registration, ISO certification reimbursement, and tech subsidies.',
  },
  {
    title: 'Tax and compliance concessions',
    detail: 'Extended MAT credit carry-forward and state-level electricity concessions.',
  },
]

export default function MSMEGuidePage() {
  return (
    <div className="min-h-screen bg-[#FBF3EC] dark:bg-[#1A1714] text-[#2A2521] dark:text-[#F5EFE8] transition-colors">
      <Navbar showNavLinks />

      <main className="mx-auto max-w-4xl px-6 py-16">
        <span className="rounded-full bg-[#E8622C]/10 dark:bg-[#F27A4A]/20 px-3 py-1 text-xs font-bold text-[#E8622C] dark:text-[#F27A4A]">
          Complete Guide for Indian Businesses
        </span>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-[#2A2521] dark:text-[#F5EFE8]">
          What is an MSME, and should you register as one?
        </h1>
        <p className="mt-4 text-base sm:text-lg text-[#8A7F74] dark:text-[#A89E92] leading-relaxed">
          If you run a small or growing business in India, this is probably the single highest-value, lowest-effort thing you can do for it &mdash; and it&rsquo;s free. Here&rsquo;s what it actually means, whether you qualify, and exactly how to do it.
        </p>

        {/* What is an MSME */}
        <section className="mt-12 rounded-3xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] p-8 shadow-sm">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[#2A2521] dark:text-[#F5EFE8]">What is an MSME?</h2>
          <p className="mt-3 text-sm text-[#8A7F74] dark:text-[#A89E92] leading-relaxed">
            MSME stands for Micro, Small, and Medium Enterprise &mdash; a classification the Government of India uses to extend specific support: easier credit, tax relief, and payment protection that larger businesses don&rsquo;t get. <strong className="text-[#2A2521] dark:text-[#F5EFE8]">Udyam Registration</strong> is the official, free process for getting that recognition.
          </p>
        </section>

        {/* Qualification & Table */}
        <section className="mt-8 rounded-3xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] p-8 shadow-sm">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[#2A2521] dark:text-[#F5EFE8]">Do you qualify?</h2>
          <p className="mt-3 text-sm text-[#8A7F74] dark:text-[#A89E92] leading-relaxed">
            Classification is based on investment in plant/machinery and annual turnover.
          </p>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#F0E4D8] dark:border-[#3A332A] text-[#8A7F74] dark:text-[#A89E92] font-semibold">
                  <th className="pb-3 pr-4">Category</th>
                  <th className="pb-3 px-4">Investment Limit</th>
                  <th className="pb-3 pl-4">Turnover Limit</th>
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

          <h3 className="mt-8 font-[family-name:var(--font-display)] text-base font-bold text-[#2A2521] dark:text-[#F5EFE8]">Who can register</h3>
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
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[#2A2521] dark:text-[#F5EFE8]">Key Benefits Unlocked</h2>
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
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[#2A2521] dark:text-[#F5EFE8]">How to Register, Step by Step</h2>
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
            Ready to digitize your business intelligence?
          </h2>
          <p className="mt-2 text-xs text-[#8A7F74] dark:text-[#A89E92]">
            Start uploading handwritten bills, invoices, and bank statements today with MSME-BIOS.
          </p>
          <Link
            to="/signup"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#E8622C] dark:bg-[#F27A4A] px-7 py-3 text-xs font-bold text-white shadow-md hover:bg-[#D4531F] dark:hover:bg-[#E56938] transition-all cursor-pointer"
          >
            <span>Get Started for Free</span>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </Link>
        </div>
      </main>
    </div>
  )
}
