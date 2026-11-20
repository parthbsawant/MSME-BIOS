import { useState, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Receipt,
  Plus,
  Trash2,
  Download,
  Building2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  FileText,
  CreditCard,
  ChevronDown,
  Clock,
  ShieldCheck,
} from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout'
import { Skeleton } from '../components/ui'
import { useBusiness } from '../context/BusinessContext'
import {
  getInvoiceProfile,
  updateInvoiceProfile,
  searchCustomers,
  createInvoice,
  listGeneratedInvoices,
  getInvoicePdfBlob,
} from '../lib/api'

const ALLOWED_GST = [0, 0.25, 3, 5, 12, 18, 28]

function formatRupees(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '₹0.00'
  return `₹${Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatDate(isoStr) {
  if (!isoStr) return '–'
  try {
    const d = new Date(isoStr)
    if (isNaN(d.getTime())) return isoStr
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return isoStr
  }
}

export default function InvoiceGeneratorPage() {
  const { t } = useTranslation('invoicegen')
  const { isOwner } = useBusiness()

  // Profile state
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileEditing, setProfileEditing] = useState(false)
  const [profileForm, setProfileForm] = useState({
    address: '',
    phone: '',
    tagline: '',
    upi_id: '',
    bank_name: '',
    bank_branch: '',
    terms: '',
    invoice_prefix: '',
  })
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMessage, setProfileMessage] = useState(null)

  // Invoice creation state
  const [customerName, setCustomerName] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [customerGstin, setCustomerGstin] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0])
  const [paymentMode, setPaymentMode] = useState('cash')
  const [creditDays, setCreditDays] = useState(30)

  // Line items state (max 40)
  const [lines, setLines] = useState([
    { id: 1, name: '', hsn: '', unit: 'NOS', qty: 1, rate: '', gst_pct: 5 },
  ])

  // Customer suggestions
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchTimeoutRef = useRef(null)

  // Generation state
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState(null)
  const [lastGenerated, setLastGenerated] = useState(null)

  // History state
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState(null)

  // Fetch initial profile & history
  const loadProfile = async () => {
    try {
      setProfileLoading(true)
      const data = await getInvoiceProfile()
      setProfile(data)
      setProfileForm({
        address: data.address || '',
        phone: data.phone || '',
        tagline: data.tagline || '',
        upi_id: data.upi_id || '',
        bank_name: data.bank_name || '',
        bank_branch: data.bank_branch || '',
        terms: data.terms || '',
        invoice_prefix: data.invoice_prefix || '',
      })
    } catch (err) {
      console.error('Failed to load profile:', err)
    } finally {
      setProfileLoading(false)
    }
  }

  const loadHistory = async () => {
    try {
      setHistoryLoading(true)
      const data = await listGeneratedInvoices(50)
      setHistory(data.invoices || [])
    } catch (err) {
      console.error('Failed to load history:', err)
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    loadProfile()
    loadHistory()
  }, [])

  // Customer typeahead search
  const handleCustomerChange = (val) => {
    setCustomerName(val)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    if (!val || val.trim().length < 1) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await searchCustomers(val.trim())
        setSuggestions(res.customers || [])
        setShowSuggestions((res.customers || []).length > 0)
      } catch {
        setSuggestions([])
      }
    }, 250)
  }

  // Profile save
  const handleSaveProfile = async (e) => {
    e?.preventDefault()
    setProfileSaving(true)
    setProfileMessage(null)
    try {
      const updated = await updateInvoiceProfile(profileForm)
      setProfile(updated)
      setProfileEditing(false)
      setProfileMessage({ type: 'success', text: t('banner.saved', 'Shop details saved successfully!') })
    } catch (err) {
      setProfileMessage({ type: 'error', text: err.message || 'Failed to save shop details' })
    } finally {
      setProfileSaving(false)
    }
  }

  // Line item manipulation
  const updateLine = (id, field, value) => {
    setLines((prev) =>
      prev.map((ln) => (ln.id === id ? { ...ln, [field]: value } : ln))
    )
  }

  const addLine = () => {
    if (lines.length >= 40) return
    const nextId = lines.length ? Math.max(...lines.map((l) => l.id)) + 1 : 1
    setLines((prev) => [
      ...prev,
      { id: nextId, name: '', hsn: '', unit: 'NOS', qty: 1, rate: '', gst_pct: 5 },
    ])
  }

  const removeLine = (id) => {
    if (lines.length <= 1) return
    setLines((prev) => prev.filter((ln) => ln.id !== id))
  }

  // Live totals calculation for browser preview (paise rounding)
  const computedTotals = useMemo(() => {
    let sub = 0
    let cg = 0
    let sg = 0

    lines.forEach((ln) => {
      const qty = parseFloat(ln.qty) || 0
      const rate = parseFloat(ln.rate) || 0
      const gst = parseFloat(ln.gst_pct) || 0
      const taxable = Math.round(qty * rate * 100) / 100
      const halfRate = gst / 2
      const c = Math.round(taxable * (halfRate / 100) * 100) / 100
      const s = c
      sub += taxable
      cg += c
      sg += s
    })

    const grand = sub + cg + sg
    return {
      subtotal: sub,
      cgst: cg,
      sgst: sg,
      grandTotal: grand,
    }
  }, [lines])

  // Generate Invoice Handler
  const handleGenerate = async (e) => {
    e.preventDefault()
    setGenerateError(null)
    setLastGenerated(null)

    // Quick client validations
    if (!customerName.trim()) {
      setGenerateError(t('form.customerRequired', 'Customer name is required'))
      return
    }

    const cleanLines = lines.map((ln) => ({
      name: ln.name.trim(),
      hsn: (ln.hsn || '').trim(),
      unit: (ln.unit || 'NOS').trim(),
      qty: Number(ln.qty) || 0,
      rate: Number(ln.rate) || 0,
      gst_pct: Number(ln.gst_pct) || 0,
    }))

    for (let i = 0; i < cleanLines.length; i++) {
      if (!cleanLines[i].name) {
        setGenerateError(`Item ${i + 1} needs a name`)
        return
      }
      if (cleanLines[i].qty <= 0) {
        setGenerateError(`Item ${i + 1} quantity must be above 0`)
        return
      }
      if (cleanLines[i].rate < 0) {
        setGenerateError(`Item ${i + 1} rate cannot be negative`)
        return
      }
    }

    setGenerating(true)
    try {
      const payload = {
        customer_name: customerName.trim(),
        customer_address: customerAddress.trim(),
        customer_gstin: customerGstin.trim(),
        invoice_date: invoiceDate,
        payment_mode: paymentMode,
        credit_days: paymentMode === 'credit' ? parseInt(creditDays, 10) || 30 : null,
        lines: cleanLines,
      }

      const res = await createInvoice(payload)
      setLastGenerated(res)

      // Automatically trigger PDF download
      downloadBase64Pdf(res.pdf_base64, `${res.invoice_number.replace('/', '_')}.pdf`)

      // Refresh history list
      loadHistory()
    } catch (err) {
      setGenerateError(err.message || 'Failed to generate invoice')
    } finally {
      setGenerating(false)
    }
  }

  // Base64 PDF downloader
  const downloadBase64Pdf = (b64Data, filename) => {
    try {
      const byteChars = atob(b64Data)
      const byteNumbers = new Array(byteChars.length)
      for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('PDF download error:', err)
    }
  }

  // Re-download from history
  const handleDownloadHistory = async (inv) => {
    try {
      setDownloadingId(inv.id)
      const blob = await getInvoicePdfBlob(inv.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${inv.invoice_number.replace('/', '_')}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      alert(`Could not download PDF: ${err.message}`)
    } finally {
      setDownloadingId(null)
    }
  }

  const hasShopDetails = profile && Boolean(profile.address && profile.address.trim())

  return (
    <DashboardLayout activeItem="Invoice Generator">
      <div className="w-full max-w-7xl mx-auto min-w-0 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block rounded-md bg-[var(--color-surface-2)] dark:bg-[#1C222B] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#1E9E6E] border border-[var(--color-line)] dark:border-[#272F3A]">
                {t('department', 'Sales')}
              </span>
              {profile?.business_name && (
                <span className="text-xs font-semibold text-[var(--color-muted)]">
                  {profile.business_name}
                </span>
              )}
            </div>
            <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-extrabold text-[var(--color-text)] tracking-tight">
              {t('title', 'Invoice Generator')}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[var(--color-muted)]">
              {t('subtitle', 'Create GST-compliant tax invoices with automatic CGST/SGST splits and print-ready PDF downloads.')}
            </p>
          </div>

          {isOwner && (
            <button
              onClick={() => setProfileEditing((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] px-4 py-2 text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-all cursor-pointer shadow-xs shrink-0 self-start sm:self-auto"
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>{profileEditing ? 'Close Shop Profile' : 'Edit Shop Profile'}</span>
            </button>
          )}
        </div>

        {/* First-time Shop Details Banner */}
        {!profileLoading && !hasShopDetails && !profileEditing && (
          <div className="rounded-2xl border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 shrink-0">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-950 dark:text-amber-200">
                  {t('banner.title', 'Add your shop details first')}
                </h3>
                <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5 max-w-xl leading-relaxed">
                  {isOwner
                    ? t('banner.desc', 'To generate GST-compliant invoices with your business details, add your shop address, contact number and terms.')
                    : t('banner.askOwner', 'Ask the owner to add shop details before generating invoices.')}
                </p>
              </div>
            </div>

            {isOwner && (
              <button
                onClick={() => setProfileEditing(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-400 text-white dark:text-amber-950 px-4 py-2 text-xs font-bold shadow-xs transition-all cursor-pointer shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{t('banner.saveBtn', 'Add Shop Details')}</span>
              </button>
            )}
          </div>
        )}

        {/* Profile Edit Drawer / Form */}
        {profileEditing && (
          <div className="rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-[var(--color-line)] dark:border-[#272F3A] pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-[var(--color-surface-2)] dark:bg-[#1C222B] text-[var(--color-text)]">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[var(--color-text)]">
                    Shop / Business Profile for Invoices
                  </h2>
                  <p className="text-xs text-[var(--color-muted)]">
                    These details will appear printed on every generated GST tax invoice.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setProfileEditing(false)}
                className="text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] font-semibold"
              >
                Cancel
              </button>
            </div>

            {profileMessage && (
              <div
                className={`p-3.5 rounded-xl text-xs font-medium flex items-center gap-2 border ${
                  profileMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60'
                    : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60'
                }`}
              >
                {profileMessage.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                )}
                <span>{profileMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                    {t('fields.address', 'Shop / Business Address')} (max 200)
                  </label>
                  <input
                    type="text"
                    maxLength={200}
                    value={profileForm.address}
                    onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                    placeholder="e.g. Shop No 4, Main Bazaar, Sangli - 416416"
                    className="w-full rounded-xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#1C222B] px-3.5 py-2 text-xs text-[var(--color-text)] placeholder-[var(--color-muted)] focus:outline-hidden focus:ring-2 focus:ring-[#2F6FDE]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                    {t('fields.phone', 'Contact Phone')} (max 20)
                  </label>
                  <input
                    type="text"
                    maxLength={20}
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    placeholder="e.g. +91 98765 43210"
                    className="w-full rounded-xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#1C222B] px-3.5 py-2 text-xs text-[var(--color-text)] placeholder-[var(--color-muted)] focus:outline-hidden focus:ring-2 focus:ring-[#2F6FDE]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                    {t('fields.upiId', 'UPI ID for QR Code')} (max 60)
                  </label>
                  <input
                    type="text"
                    maxLength={60}
                    value={profileForm.upi_id}
                    onChange={(e) => setProfileForm({ ...profileForm, upi_id: e.target.value })}
                    placeholder="e.g. storename@upi"
                    className="w-full rounded-xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#1C222B] px-3.5 py-2 text-xs text-[var(--color-text)] placeholder-[var(--color-muted)] focus:outline-hidden focus:ring-2 focus:ring-[#2F6FDE]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                    {t('fields.prefix', 'Invoice Number Prefix')} (e.g. MT/)
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    value={profileForm.invoice_prefix}
                    onChange={(e) => setProfileForm({ ...profileForm, invoice_prefix: e.target.value })}
                    placeholder="e.g. MT/"
                    className="w-full rounded-xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#1C222B] px-3.5 py-2 text-xs text-[var(--color-text)] placeholder-[var(--color-muted)] focus:outline-hidden focus:ring-2 focus:ring-[#2F6FDE]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                    {t('fields.bankName', 'Bank Name')}
                  </label>
                  <input
                    type="text"
                    maxLength={100}
                    value={profileForm.bank_name}
                    onChange={(e) => setProfileForm({ ...profileForm, bank_name: e.target.value })}
                    placeholder="e.g. State Bank of India"
                    className="w-full rounded-xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#1C222B] px-3.5 py-2 text-xs text-[var(--color-text)] placeholder-[var(--color-muted)] focus:outline-hidden focus:ring-2 focus:ring-[#2F6FDE]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                    {t('fields.bankBranch', 'Branch & IFSC')}
                  </label>
                  <input
                    type="text"
                    maxLength={100}
                    value={profileForm.bank_branch}
                    onChange={(e) => setProfileForm({ ...profileForm, bank_branch: e.target.value })}
                    placeholder="e.g. Sangli Main, SBIN0001234"
                    className="w-full rounded-xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#1C222B] px-3.5 py-2 text-xs text-[var(--color-text)] placeholder-[var(--color-muted)] focus:outline-hidden focus:ring-2 focus:ring-[#2F6FDE]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                  {t('fields.terms', 'Terms & Conditions (one per line, max 600 chars)')}
                </label>
                <textarea
                  rows={3}
                  maxLength={600}
                  value={profileForm.terms}
                  onChange={(e) => setProfileForm({ ...profileForm, terms: e.target.value })}
                  placeholder="1. Goods once sold will not be taken back.&#10;2. Interest @ 18% p.a. charged on overdue bills."
                  className="w-full rounded-xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#1C222B] px-3.5 py-2 text-xs text-[var(--color-text)] placeholder-[var(--color-muted)] focus:outline-hidden focus:ring-2 focus:ring-[#2F6FDE]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setProfileEditing(false)}
                  className="px-4 py-2 text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-text)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#2F6FDE] hover:bg-[#2557B2] text-white px-5 py-2 text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {profileSaving && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>{profileSaving ? t('banner.saving', 'Saving...') : 'Save Shop Profile'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* INVOICE CREATION CARD */}
        <div className="rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-5 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[var(--color-line)] dark:border-[#272F3A] pb-4">
            <div>
              <h2 className="text-lg font-bold text-[var(--color-text)]">
                {t('form.title', 'Create New Tax Invoice')}
              </h2>
              <p className="text-xs text-[var(--color-muted)] mt-0.5">
                Generate an invoice with intra-state CGST & SGST splits. All totals are calculated automatically.
              </p>
            </div>
            {profile?.invoice_prefix && (
              <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-[var(--color-surface-2)] dark:bg-[#1C222B] text-[var(--color-text)] border border-[var(--color-line)] dark:border-[#272F3A] self-start sm:self-auto">
                Prefix: {profile.invoice_prefix}
              </span>
            )}
          </div>

          {/* Success Banner if just generated */}
          {lastGenerated && (
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
                    {t('form.success', 'Invoice generated successfully!')}
                  </h3>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-0.5">
                    {t('form.createdNumber', 'Invoice Number:')}{' '}
                    <strong className="font-mono">{lastGenerated.invoice_number}</strong> &bull; Total:{' '}
                    <strong>{formatRupees(lastGenerated.total)}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => downloadBase64Pdf(lastGenerated.pdf_base64, `${lastGenerated.invoice_number.replace('/', '_')}.pdf`)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-emerald-950 px-4 py-2 text-xs font-bold shadow-xs transition-all cursor-pointer shrink-0"
              >
                <Download className="h-3.5 w-3.5" />
                <span>{t('form.downloadPdf', 'Download PDF')}</span>
              </button>
            </div>
          )}

          {/* Server / Validation Error Banner */}
          {generateError && (
            <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 p-4 flex items-center gap-3 text-xs text-rose-800 dark:text-rose-200">
              <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />
              <span className="font-medium">{generateError}</span>
            </div>
          )}

          <form onSubmit={handleGenerate} className="space-y-6">
            {/* Customer & Date Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Customer Name with Typeahead */}
              <div className="relative">
                <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                  {t('form.customer', 'Customer Name')} *
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={customerName}
                  onChange={(e) => handleCustomerChange(e.target.value)}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder={t('form.customerPlaceholder', 'Search customer or type new name...')}
                  className="w-full rounded-xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#1C222B] px-3.5 py-2 text-xs text-[var(--color-text)] placeholder-[var(--color-muted)] focus:outline-hidden focus:ring-2 focus:ring-[#2F6FDE]"
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#1C222B] shadow-lg py-1 scrollbar-themed">
                    {suggestions.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onMouseDown={() => {
                          setCustomerName(name)
                          setShowSuggestions(false)
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-[var(--color-text)] hover:bg-[var(--color-surface-2)] dark:hover:bg-[#272F3A] transition-colors truncate"
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Customer Address */}
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                  {t('form.customerAddress', 'Customer Address (optional)')}
                </label>
                <input
                  type="text"
                  maxLength={150}
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="e.g. Kalamwadi, Sangli"
                  className="w-full rounded-xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#1C222B] px-3.5 py-2 text-xs text-[var(--color-text)] placeholder-[var(--color-muted)] focus:outline-hidden focus:ring-2 focus:ring-[#2F6FDE]"
                />
              </div>

              {/* Customer GSTIN */}
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                  {t('form.customerGstin', 'Customer GSTIN (optional)')}
                </label>
                <input
                  type="text"
                  maxLength={15}
                  value={customerGstin}
                  onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
                  placeholder="e.g. 27ABCDE1234F1Z5"
                  className="w-full rounded-xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#1C222B] px-3.5 py-2 text-xs font-mono text-[var(--color-text)] placeholder-[var(--color-muted)] focus:outline-hidden focus:ring-2 focus:ring-[#2F6FDE]"
                />
              </div>
            </div>

            {/* Date and Payment Mode Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                  {t('form.date', 'Invoice Date')} *
                </label>
                <input
                  type="date"
                  required
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#1C222B] px-3.5 py-2 text-xs text-[var(--color-text)] focus:outline-hidden focus:ring-2 focus:ring-[#2F6FDE]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                  {t('form.paymentMode', 'Payment Mode')}
                </label>
                <div className="grid grid-cols-3 gap-1 rounded-xl border border-[var(--color-line)] dark:border-[#272F3A] p-1 bg-[var(--color-surface-2)] dark:bg-[#1C222B]">
                  {['cash', 'upi', 'credit'].map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPaymentMode(mode)}
                      className={`py-1.5 text-xs font-semibold rounded-lg transition-all capitalize ${
                        paymentMode === mode
                          ? 'bg-white dark:bg-[#151A21] text-[var(--color-text)] shadow-xs font-bold'
                          : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMode === 'credit' ? (
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                    {t('form.creditDays', 'Credit Days')} (1–365)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={creditDays}
                    onChange={(e) => setCreditDays(e.target.value)}
                    className="w-full rounded-xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#1C222B] px-3.5 py-2 text-xs text-[var(--color-text)] focus:outline-hidden focus:ring-2 focus:ring-[#2F6FDE]"
                  />
                </div>
              ) : (
                <div className="flex items-center text-xs text-[var(--color-muted)] pt-6">
                  <ShieldCheck className="h-4 w-4 mr-1 text-emerald-500" />
                  <span>Immediate settlement (paid on invoice date)</span>
                </div>
              )}
            </div>

            {/* Line Items Table */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[var(--color-text)]">
                  Line Items ({lines.length} / 40)
                </h3>
                <button
                  type="button"
                  onClick={addLine}
                  disabled={lines.length >= 40}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2F6FDE] hover:underline disabled:opacity-40 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{t('form.addItem', 'Add Item')}</span>
                </button>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-[var(--color-line)] dark:border-[#272F3A] scrollbar-themed">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-[var(--color-line)] dark:border-[#272F3A] bg-[var(--color-surface-2)]/70 dark:bg-[#1C222B]/70 text-[11px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3 w-52">{t('form.item', 'Item Name')} *</th>
                      <th className="py-2.5 px-3 w-24">{t('form.hsn', 'HSN')}</th>
                      <th className="py-2.5 px-3 w-20">{t('form.unit', 'Unit')}</th>
                      <th className="py-2.5 px-3 w-20 text-right">{t('form.qty', 'Qty')} *</th>
                      <th className="py-2.5 px-3 w-28 text-right">{t('form.rate', 'Rate (₹)')} *</th>
                      <th className="py-2.5 px-3 w-24">{t('form.gst', 'GST %')}</th>
                      <th className="py-2.5 px-3 text-right">{t('form.taxable', 'Taxable')}</th>
                      <th className="py-2.5 px-3 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-line)] dark:divide-[#272F3A] text-xs">
                    {lines.map((ln, idx) => {
                      const taxable = Math.round((parseFloat(ln.qty) || 0) * (parseFloat(ln.rate) || 0) * 100) / 100
                      return (
                        <tr key={ln.id} className="hover:bg-[var(--color-surface-2)]/40 dark:hover:bg-[#1C222B]/40">
                          <td className="py-2 px-3 text-[var(--color-muted)] font-mono">{idx + 1}</td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              required
                              maxLength={120}
                              value={ln.name}
                              onChange={(e) => updateLine(ln.id, 'name', e.target.value)}
                              placeholder="Item description"
                              className="w-full rounded-lg border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] px-2.5 py-1 text-xs text-[var(--color-text)] focus:outline-hidden focus:ring-1 focus:ring-[#2F6FDE]"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              maxLength={12}
                              value={ln.hsn}
                              onChange={(e) => updateLine(ln.id, 'hsn', e.target.value)}
                              placeholder="e.g. 1006"
                              className="w-full rounded-lg border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] px-2 py-1 text-xs font-mono text-[var(--color-text)] focus:outline-hidden focus:ring-1 focus:ring-[#2F6FDE]"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              maxLength={8}
                              value={ln.unit}
                              onChange={(e) => updateLine(ln.id, 'unit', e.target.value.toUpperCase())}
                              placeholder="NOS"
                              className="w-full rounded-lg border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] px-2 py-1 text-xs text-[var(--color-text)] focus:outline-hidden focus:ring-1 focus:ring-[#2F6FDE]"
                            />
                          </td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              required
                              step="any"
                              min="0.001"
                              value={ln.qty}
                              onChange={(e) => updateLine(ln.id, 'qty', e.target.value)}
                              className="w-full rounded-lg border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] px-2 py-1 text-xs text-right text-[var(--color-text)] focus:outline-hidden focus:ring-1 focus:ring-[#2F6FDE]"
                            />
                          </td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              required
                              step="any"
                              min="0"
                              value={ln.rate}
                              onChange={(e) => updateLine(ln.id, 'rate', e.target.value)}
                              placeholder="0.00"
                              className="w-full rounded-lg border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] px-2 py-1 text-xs text-right text-[var(--color-text)] focus:outline-hidden focus:ring-1 focus:ring-[#2F6FDE]"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={ln.gst_pct}
                              onChange={(e) => updateLine(ln.id, 'gst_pct', parseFloat(e.target.value))}
                              className="w-full rounded-lg border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] px-2 py-1 text-xs text-[var(--color-text)] focus:outline-hidden focus:ring-1 focus:ring-[#2F6FDE]"
                            >
                              {ALLOWED_GST.map((g) => (
                                <option key={g} value={g}>
                                  {g}%
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-medium text-[var(--color-text)]">
                            {formatRupees(taxable)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => removeLine(ln.id)}
                              disabled={lines.length <= 1}
                              title="Delete row"
                              className="text-[var(--color-muted)] hover:text-rose-500 disabled:opacity-20 cursor-pointer transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Live Totals & Action Row */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pt-4 border-t border-[var(--color-line)] dark:border-[#272F3A]">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 text-xs">
                <div>
                  <span className="text-[var(--color-muted)] block">{t('form.subtotal', 'Taxable Subtotal')}</span>
                  <span className="text-sm font-semibold text-[var(--color-text)] font-mono">
                    {formatRupees(computedTotals.subtotal)}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--color-muted)] block">{t('form.cgst', 'CGST')}</span>
                  <span className="text-sm font-semibold text-[var(--color-text)] font-mono">
                    {formatRupees(computedTotals.cgst)}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--color-muted)] block">{t('form.sgst', 'SGST')}</span>
                  <span className="text-sm font-semibold text-[var(--color-text)] font-mono">
                    {formatRupees(computedTotals.sgst)}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--color-muted)] block font-bold">{t('form.grandTotal', 'Grand Total')}</span>
                  <span className="font-[family-name:var(--font-display)] text-lg font-extrabold text-[#1E9E6E] font-mono">
                    {formatRupees(computedTotals.grandTotal)}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={generating}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#2F6FDE] hover:bg-[#2557B2] text-white px-6 py-3 text-xs font-bold shadow-md hover:brightness-105 transition-all cursor-pointer disabled:opacity-50 shrink-0"
              >
                {generating ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>{t('form.generating', 'Generating Invoice & PDF...')}</span>
                  </>
                ) : (
                  <>
                    <Receipt className="h-4 w-4" />
                    <span>{t('form.generateBtn', 'Generate Tax Invoice')}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* GENERATED INVOICES HISTORY TABLE */}
        <div className="rounded-3xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] p-5 sm:p-8 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[var(--color-text)]">
                {t('history.title', 'Recent Generated Invoices')}
              </h2>
              <p className="text-xs text-[var(--color-muted)] mt-0.5">
                Last 50 invoices issued by this tenant. Download print-ready PDFs at any time.
              </p>
            </div>
            <button
              onClick={loadHistory}
              disabled={historyLoading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${historyLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {historyLoading ? (
            <div className="space-y-3 py-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-[var(--color-muted)] space-y-2">
              <FileText className="h-8 w-8 mx-auto opacity-50" />
              <p className="text-xs font-medium">{t('history.empty', 'No generated invoices yet.')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-[var(--color-line)] dark:border-[#272F3A] scrollbar-themed">
              <table className="w-full text-left border-collapse min-w-[640px]">
                <thead>
                  <tr className="border-b border-[var(--color-line)] dark:border-[#272F3A] bg-[var(--color-surface-2)]/70 dark:bg-[#1C222B]/70 text-[11px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                    <th className="py-2.5 px-3.5">{t('history.invNo', 'Invoice #')}</th>
                    <th className="py-2.5 px-3.5">{t('history.customer', 'Customer')}</th>
                    <th className="py-2.5 px-3.5">{t('history.date', 'Date')}</th>
                    <th className="py-2.5 px-3.5">{t('history.mode', 'Mode')}</th>
                    <th className="py-2.5 px-3.5 text-right">{t('history.amount', 'Amount')}</th>
                    <th className="py-2.5 px-3.5">{t('history.status', 'Status')}</th>
                    <th className="py-2.5 px-3.5 text-right">{t('history.action', 'Action')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-line)] dark:divide-[#272F3A] text-xs">
                  {history.map((inv) => {
                    const isCredit = inv.payment_mode === 'credit'
                    const isPaid = Boolean(inv.paid_at)
                    return (
                      <tr key={inv.id} className="hover:bg-[var(--color-surface-2)]/50 dark:hover:bg-[#1C222B]/50 transition-colors">
                        <td className="py-3 px-3.5 font-mono font-bold text-[var(--color-text)]">
                          {inv.invoice_number}
                        </td>
                        <td className="py-3 px-3.5 font-semibold text-[var(--color-text)]">
                          {inv.party_name}
                        </td>
                        <td className="py-3 px-3.5 text-[var(--color-muted)]">
                          {formatDate(inv.invoice_date)}
                        </td>
                        <td className="py-3 px-3.5 capitalize">
                          <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[var(--color-surface-2)] dark:bg-[#1C222B] border border-[var(--color-line)] dark:border-[#272F3A] text-[var(--color-text)]">
                            {inv.payment_mode}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-bold text-[var(--color-text)]">
                          {formatRupees(inv.total)}
                        </td>
                        <td className="py-3 px-3.5">
                          {isPaid ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>{t('history.paid', 'Paid')}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                              <Clock className="h-3 w-3" />
                              <span>{t('history.unpaid', 'Open Credit')}</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleDownloadHistory(inv)}
                            disabled={downloadingId === inv.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#1C222B] text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-2)] shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                          >
                            <Download className={`h-3 w-3 ${downloadingId === inv.id ? 'animate-bounce' : ''}`} />
                            <span>PDF</span>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
