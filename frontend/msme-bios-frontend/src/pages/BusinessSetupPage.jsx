import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { useBusiness } from '../context/BusinessContext'
import { saveBusiness as saveBusinessToBackend } from '../lib/api'

const businessTypes = ['Kirana / general store', 'Retail shop', 'Wholesale trader', 'Manufacturer', 'Service provider', 'Other']
const turnoverBands = ['Under \u20b940 lakh', '\u20b940 lakh \u2013 \u20b95 crore', '\u20b95 crore \u2013 \u20b950 crore', 'Above \u20b950 crore']

export default function BusinessSetupPage() {
  const { business, saveBusiness } = useBusiness()
  const navigate = useNavigate()
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
      // MILESTONE 2: persists to the real backend first, scoped to the
      // authenticated user's resolved tenant - the backend never sees
      // or accepts a tenant_id from this call. The existing localStorage
      // save stays too for now, since it's still what the route guards
      // (RequireOnboarded) check - a later milestone moves that check
      // to the backend as well.
      await saveBusinessToBackend(form)
      saveBusiness(form)
      navigate('/choose-plan')
    } catch (err) {
      console.error('Failed to save business:', err)
      setError('Couldn\u2019t save your business details. Check that the backend is running, then try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-white text-black dark:bg-black dark:text-white transition-colors">
      <Navbar />
      <main className="mx-auto max-w-2xl px-6 py-14">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">Tell us about your business</h1>
        <p className="mt-2 text-black/60 dark:text-white/60">A few basics before you choose a plan — takes under a minute.</p>

        {error && (
          <div className="mt-6 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-10 space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Business name" value={form.businessName} onChange={update('businessName')} placeholder="e.g. Shree Ganesh Stores" required />
            <Field label="Owner / contact name" value={form.ownerName} onChange={update('ownerName')} placeholder="e.g. Ramesh Patil" required />
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <SelectField label="Business type" value={form.type} onChange={update('type')} options={businessTypes} />
            <SelectField label="Annual turnover" value={form.turnover} onChange={update('turnover')} options={turnoverBands} />
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="City" value={form.city} onChange={update('city')} placeholder="e.g. Pune" />
            <Field label="GSTIN (optional)" value={form.gstin} onChange={update('gstin')} placeholder="e.g. 27ABCDE1234F1Z5" />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="mt-4 bg-black px-6 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-black hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving\u2026' : 'Continue to plans'}
          </button>
        </form>
      </main>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, required }) {
  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="mt-2 w-full border border-black/20 dark:border-white/20 bg-transparent px-3 py-2.5 text-sm placeholder:text-black/30 dark:placeholder:text-white/30 focus:border-black dark:focus:border-white focus:outline-none transition-colors"
      />
    </div>
  )
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      <select
        value={value}
        onChange={onChange}
        className="mt-2 w-full border border-black/20 dark:border-white/20 bg-white dark:bg-black px-3 py-2.5 text-sm focus:border-black dark:focus:border-white focus:outline-none transition-colors"
      >
        {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  )
}
