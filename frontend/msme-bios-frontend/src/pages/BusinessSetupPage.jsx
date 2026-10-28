import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle } from 'lucide-react'
import Navbar from '../components/Navbar'
import OnboardingProgress from '../components/OnboardingProgress'
import { useBusiness } from '../context/BusinessContext'
import { saveBusiness as saveBusinessToBackend } from '../lib/api'

const businessTypes = [
  'Kirana / general store',
  'Retail shop',
  'Wholesale trader',
  'Manufacturer',
  'Service provider',
  'Other',
]
const turnoverBands = [
  'Under \u20b940 lakh',
  '\u20b940 lakh \u2013 \u20b95 crore',
  '\u20b95 crore \u2013 \u20b950 crore',
  'Above \u20b950 crore',
]

// The stored value stays English (the backend keeps it as-is); these keys
// only pick the translated label shown in the dropdown, matched by position.
const businessTypeLabelKeys = ['kirana', 'retail', 'wholesale', 'manufacturer', 'service', 'other']
const turnoverLabelKeys = ['under40L', '40Lto5Cr', '5Crto50Cr', 'above50Cr']

export default function BusinessSetupPage() {
  const { business, saveBusiness } = useBusiness()
  const navigate = useNavigate()
  const { t } = useTranslation('onboarding')
  const [form, setForm] = useState(
    business || {
      businessName: '',
      ownerName: '',
      type: businessTypes[0],
      turnover: turnoverBands[0],
      city: '',
      gstin: '',
    },
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (business) {
      setForm(business)
    }
  }, [business])

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.businessName.trim() || !form.ownerName.trim()) return
    setError('')
    setSaving(true)

    try {
      await saveBusinessToBackend(form)
      saveBusiness(form)
      navigate('/choose-plan')
    } catch (err) {
      console.error('Failed to save business:', err)
      setError('businessSetup.saveError')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] text-[var(--color-ink)] transition-colors">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-10 md:py-14">
        <OnboardingProgress currentStep={1} />
        <div className="rounded-3xl border border-[var(--color-line)] bg-[var(--color-surface)] p-6 sm:p-10 shadow-[var(--shadow-cool-md)]">
          <span className="inline-block rounded-full bg-[var(--color-accent-soft)] px-3 py-1 text-xs font-bold text-[var(--color-accent)]">
            {t('businessSetup.badge')}
          </span>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--color-ink)]">
            {t('businessSetup.title')}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[var(--color-muted)] leading-relaxed">
            {t('businessSetup.subtitle')}
          </p>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="mt-6 rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] p-4 text-xs text-[var(--color-danger)] flex items-start gap-2.5"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" strokeWidth={2} />
                <span className="font-medium">{t(error)}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                id="businessName"
                label={t('businessSetup.businessName')}
                value={form.businessName}
                onChange={update('businessName')}
                placeholder={t('businessSetup.businessNamePlaceholder')}
                required
              />
              <Field
                id="ownerName"
                label={t('businessSetup.ownerName')}
                value={form.ownerName}
                onChange={update('ownerName')}
                placeholder={t('businessSetup.ownerNamePlaceholder')}
                required
              />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <SelectField
                id="businessType"
                label={t('businessSetup.businessType')}
                value={form.type}
                onChange={update('type')}
                options={businessTypes}
                labels={businessTypeLabelKeys.map((k) => t(`businessSetup.types.${k}`))}
              />
              <SelectField
                id="turnover"
                label={t('businessSetup.turnover')}
                value={form.turnover}
                onChange={update('turnover')}
                options={turnoverBands}
                labels={turnoverLabelKeys.map((k) => t(`businessSetup.turnoverBands.${k}`))}
              />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                id="city"
                label={t('businessSetup.city')}
                value={form.city}
                onChange={update('city')}
                placeholder={t('businessSetup.cityPlaceholder')}
              />
              <Field
                id="gstin"
                label={t('businessSetup.gstin')}
                value={form.gstin}
                onChange={update('gstin')}
                placeholder={t('businessSetup.gstinPlaceholder')}
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-6 w-full inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] py-3.5 text-xs sm:text-sm font-bold text-white dark:text-[#0E1116] shadow-xs hover:bg-[var(--color-accent-hover)] transition-all transform active:scale-[0.98] disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
              {saving ? t('businessSetup.submitting') : t('businessSetup.submit')}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}

function Field({ id, label, value, onChange, placeholder, required }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-bold text-[var(--color-ink)]">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="mt-1.5 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] dark:bg-[var(--color-canvas)] px-3.5 py-2.5 text-xs sm:text-sm text-[var(--color-ink)] placeholder-[var(--color-muted)]/60 focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 focus:outline-none transition-all"
      />
    </div>
  )
}

function SelectField({ id, label, value, onChange, options, labels }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-bold text-[var(--color-ink)]">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={onChange}
        className="mt-1.5 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] dark:bg-[var(--color-canvas)] px-3.5 py-2.5 text-xs sm:text-sm text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 focus:outline-none transition-all cursor-pointer"
      >
        {options.map((opt, i) => (
          <option key={opt} value={opt}>
            {labels?.[i] ?? opt}
          </option>
        ))}
      </select>
    </div>
  )
}
