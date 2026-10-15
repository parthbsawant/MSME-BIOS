import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Navbar from '../components/Navbar'
import { useBusiness } from '../context/BusinessContext'
import { saveBusiness as saveBusinessToBackend } from '../lib/api'

const businessTypes = ['Kirana / general store', 'Retail shop', 'Wholesale trader', 'Manufacturer', 'Service provider', 'Other']
const turnoverBands = ['Under \u20b940 lakh', '\u20b940 lakh \u2013 \u20b95 crore', '\u20b95 crore \u2013 \u20b950 crore', 'Above \u20b950 crore']

// The stored value stays English (the backend keeps it as-is); these keys
// only pick the translated label shown in the dropdown, matched by position.
const businessTypeLabelKeys = ['kirana', 'retail', 'wholesale', 'manufacturer', 'service', 'other']
const turnoverLabelKeys = ['under40L', '40Lto5Cr', '5Crto50Cr', 'above50Cr']

export default function BusinessSetupPage() {
  const { business, saveBusiness } = useBusiness()
  const navigate = useNavigate()
  const { t } = useTranslation('onboarding')
  const [form, setForm] = useState(
    business || { businessName: '', ownerName: '', type: businessTypes[0], turnover: turnoverBands[0], city: '', gstin: '' }
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
    <div className="min-h-screen bg-[#FBF3EC] dark:bg-[#1A1714] text-[#2A2521] dark:text-[#F5EFE8] transition-colors">
      <Navbar />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <div className="rounded-3xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] p-8 sm:p-10 shadow-xl">
          <span className="rounded-full bg-[#E8622C]/10 dark:bg-[#F27A4A]/20 px-3 py-1 text-xs font-bold text-[#E8622C] dark:text-[#F27A4A]">
            {t('businessSetup.badge')}
          </span>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-extrabold tracking-tight text-[#2A2521] dark:text-[#F5EFE8]">
            {t('businessSetup.title')}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#8A7F74] dark:text-[#A89E92]">
            {t('businessSetup.subtitle')}
          </p>

          {error && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/40 p-4 text-xs text-red-700 dark:text-red-300">
              {t(error)}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t('businessSetup.businessName')} value={form.businessName} onChange={update('businessName')} placeholder={t('businessSetup.businessNamePlaceholder')} required />
              <Field label={t('businessSetup.ownerName')} value={form.ownerName} onChange={update('ownerName')} placeholder={t('businessSetup.ownerNamePlaceholder')} required />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <SelectField label={t('businessSetup.businessType')} value={form.type} onChange={update('type')} options={businessTypes} labels={businessTypeLabelKeys.map((k) => t(`businessSetup.types.${k}`))} />
              <SelectField label={t('businessSetup.turnover')} value={form.turnover} onChange={update('turnover')} options={turnoverBands} labels={turnoverLabelKeys.map((k) => t(`businessSetup.turnoverBands.${k}`))} />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t('businessSetup.city')} value={form.city} onChange={update('city')} placeholder={t('businessSetup.cityPlaceholder')} />
              <Field label={t('businessSetup.gstin')} value={form.gstin} onChange={update('gstin')} placeholder={t('businessSetup.gstinPlaceholder')} />
            </div>
            
            <button
              type="submit"
              disabled={saving}
              className="mt-6 w-full rounded-xl bg-[#E8622C] dark:bg-[#F27A4A] py-3.5 text-xs font-bold text-white shadow-md shadow-[#E8622C]/20 hover:bg-[#D4531F] dark:hover:bg-[#E56938] transition-all transform active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {saving ? t('businessSetup.submitting') : t('businessSetup.submit')}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, required }) {
  return (
    <div>
      <label className="block text-xs font-bold text-[#2A2521] dark:text-[#F5EFE8]">{label}</label>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="mt-1.5 w-full rounded-xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FBF3EC] dark:bg-[#1A1714] px-4 py-3 text-xs text-[#2A2521] dark:text-[#F5EFE8] placeholder-[#8A7F74]/50 focus:border-[#E8622C] dark:focus:border-[#F27A4A] focus:outline-none transition-colors"
      />
    </div>
  )
}

function SelectField({ label, value, onChange, options, labels }) {
  return (
    <div>
      <label className="block text-xs font-bold text-[#2A2521] dark:text-[#F5EFE8]">{label}</label>
      <select
        value={value}
        onChange={onChange}
        className="mt-1.5 w-full rounded-xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FBF3EC] dark:bg-[#1A1714] px-4 py-3 text-xs text-[#2A2521] dark:text-[#F5EFE8] focus:border-[#E8622C] dark:focus:border-[#F27A4A] focus:outline-none transition-colors cursor-pointer"
      >
        {options.map((opt, i) => <option key={opt} value={opt}>{labels?.[i] ?? opt}</option>)}
      </select>
    </div>
  )
}
