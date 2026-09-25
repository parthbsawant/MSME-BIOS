import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { useBusiness } from '../context/BusinessContext'

const API_URL = import.meta.env.VITE_API_URL

// Kept as a plain array specifically so adding Excel, GST, ITR, and
// business-rule file types later (parked for the backend phase) is a
// small addition here, not a rewrite of the page.
const docTypes = [
  { id: 'bank_statement', label: 'Bank statement', hint: 'PDF', accept: '.pdf' },
  { id: 'invoice_bill', label: 'Invoice / bill', hint: 'PDF', accept: '.pdf' },
  { id: 'photo_bill', label: 'Handwritten bill', hint: 'Photo', accept: 'image/*' },
]

// A simple, readable tenant_id derived from the business name, rather
// than a meaningless hardcoded string - e.g. "Shree Ganesh Stores" ->
// "shree-ganesh-stores". Not a real user-identity system (that's what
// real auth will provide later), just a genuine identifier instead of a
// placeholder one.
function slugify(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export default function UploadPage() {
  const [selectedType, setSelectedType] = useState(null)
  const [file, setFile] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)
  const navigate = useNavigate()
  const { business } = useBusiness()

  const activeType = docTypes.find((t) => t.id === selectedType)

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0])
  }

  const handleSubmit = async () => {
    if (!file || !selectedType) return
    setIsProcessing(true)
    setError(null)

    const tenantId = business?.businessName ? slugify(business.businessName) : 'default_tenant'

    const formData = new FormData()
    formData.append('file', file)
    formData.append('document_type', selectedType)
    formData.append('tenant_id', tenantId)

    try {
      const response = await fetch(`${API_URL}/api/parse`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        if (response.status === 501) {
          // The parser reached its AI-vision path, but that parser's flag
          // isn't enabled yet - a known, expected state, not a bug, so it
          // gets its own clear message rather than a generic failure.
          setError({
            title: 'AI-powered reading isn\u2019t enabled for this document yet',
            detail: 'This document needs AI vision to read, and that\u2019s not turned on for this parser yet. Try a different document, or check back once it\u2019s enabled.',
          })
        } else if (response.status === 400) {
          setError({
            title: 'This document couldn\u2019t be read',
            detail: errorBody.message || 'The file may not match the document type you selected.',
          })
        } else {
          setError({
            title: 'Something went wrong on our end',
            detail: errorBody.message || `The server responded with an unexpected error (${response.status}).`,
          })
        }
        setIsProcessing(false)
        return
      }

      const result = await response.json()
      navigate('/results', { state: { result, documentType: selectedType, fileName: file.name } })
    } catch {
      // A genuine network failure - the backend is unreachable, not
      // running, or CORS is misconfigured. Distinct, actionable message
      // rather than a silent console-only failure.
      setError({
        title: 'Couldn\u2019t reach the server',
        detail: 'Check that the backend is running, then try again.',
      })
      setIsProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-white text-black dark:bg-black dark:text-white transition-colors">
      <Navbar />
      <main className="mx-auto max-w-2xl px-6 py-14">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">Add documents</h1>
        <p className="mt-2 text-black/60 dark:text-white/60">Tell us what it is, then add the file.</p>

        <div className="mt-10">
          <p className="text-sm font-medium">What are you uploading?</p>
          <div className="mt-3 grid gap-px border border-black/15 bg-black/15 dark:border-white/15 dark:bg-white/15 sm:grid-cols-3">
            {docTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => { setSelectedType(type.id); setFile(null); setError(null) }}
                className={`bg-white dark:bg-black p-4 text-left transition-colors ${
                  selectedType === type.id ? 'bg-black text-white dark:bg-white dark:text-black' : ''
                }`}
              >
                <p className="text-sm font-medium">{type.label}</p>
                <p className={`mt-1 font-[family-name:var(--font-data)] text-xs ${
                  selectedType === type.id ? 'opacity-60' : 'text-black/40 dark:text-white/40'
                }`}>{type.hint}</p>
              </button>
            ))}
          </div>
        </div>

        {activeType && (
          <div className="mt-8">
            <p className="text-sm font-medium">Add the file</p>
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`mt-3 flex min-h-[160px] cursor-pointer flex-col items-center justify-center border border-dashed px-6 py-10 text-center transition-colors ${
                isDragging ? 'border-black bg-black/5 dark:border-white dark:bg-white/5' : 'border-black/25 dark:border-white/25'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={activeType.accept}
                onChange={(e) => { if (e.target.files?.[0]) { setFile(e.target.files[0]); setError(null) } }}
                className="hidden"
              />
              {file ? (
                <>
                  <p className="font-[family-name:var(--font-data)] text-sm">{file.name}</p>
                  <p className="mt-1 text-xs text-black/50 dark:text-white/50">Click to choose a different file</p>
                </>
              ) : (
                <>
                  <p className="text-sm">Drag a file here, or click to browse</p>
                  <p className="mt-1 text-xs text-black/50 dark:text-white/50">Accepts {activeType.hint.toLowerCase()}</p>
                </>
              )}
            </div>

            <button
              onClick={handleSubmit}
              disabled={!file || isProcessing}
              className="mt-6 bg-black px-6 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-black hover:opacity-80 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Reading document\u2026' : 'Process document'}
            </button>

            {error && (
              <div className="mt-4 border border-black/20 dark:border-white/20 p-4">
                <p className="text-sm font-medium">{error.title}</p>
                <p className="mt-1 text-sm text-black/60 dark:text-white/60">{error.detail}</p>
                <button
                  onClick={handleSubmit}
                  className="mt-3 text-sm font-medium border border-black dark:border-white px-4 py-1.5 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
