import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import { parseDocument } from '../lib/api'

const docTypes = [
  {
    id: 'bank_statement',
    label: 'Bank Statement',
    hint: 'PDF file format',
    description: 'Automated extraction of debit/credit ledgers and running balances.',
    accept: '.pdf',
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </svg>
    ),
  },
  {
    id: 'invoice_bill',
    label: 'Invoice / Bill',
    hint: 'PDF file format',
    description: 'GSTIN validation, line items, CGST/SGST splits, and totals.',
    accept: '.pdf',
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    id: 'photo_bill',
    label: 'Handwritten Bill',
    hint: 'JPG / PNG photo',
    description: 'AI vision OCR for paper invoices, vernacular receipts, & handwritten chits.',
    accept: 'image/*',
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    ),
  },
]

export default function UploadPage() {
  const [selectedType, setSelectedType] = useState(null)
  const [file, setFile] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)
  const navigate = useNavigate()

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

    try {
      const result = await parseDocument(file, selectedType)
      navigate('/results', { state: { result, documentType: selectedType, fileName: file.name } })
    } catch (err) {
      if (err.status === 501) {
        setError({
          title: 'AI-powered reading isn’t enabled for this document yet',
          detail: 'This document needs AI vision to read, and that’s not turned on for this parser yet. Try a different document, or check back once it’s enabled.',
        })
      } else if (err.status === 400) {
        setError({
          title: 'This document couldn’t be read',
          detail: err.message || 'The file may not match the document type you selected.',
        })
      } else if (err.status) {
        setError({
          title: 'Something went wrong on our end',
          detail: err.message || `The server responded with an unexpected error (${err.status}).`,
        })
      } else {
        setError({
          title: 'Couldn’t reach the server',
          detail: 'Check that the backend is running, then try again.',
        })
      }
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <DashboardLayout activeItem="Upload Document">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Page Header */}
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#E8622C] dark:text-[#F27A4A]">Document Processing</span>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-extrabold text-[#2A2521] dark:text-[#F5EFE8]">
            Upload Document
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#8A7F74] dark:text-[#A89E92]">
            Select your document format and upload the file to trigger automated AI parsing.
          </p>
        </div>

        {/* STEP 1: SELECT DOCUMENT TYPE */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#E8622C] text-white font-bold text-xs">1</span>
            <h2 className="font-[family-name:var(--font-display)] text-base font-bold text-[#2A2521] dark:text-[#F5EFE8]">
              Select Document Type
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {docTypes.map((type) => {
              const isSelected = selectedType === type.id
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => {
                    setSelectedType(type.id)
                    setFile(null)
                    setError(null)
                  }}
                  className={`flex flex-col justify-between rounded-2xl border p-5 text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#E8622C] dark:border-[#F27A4A] bg-[#E8622C]/10 dark:bg-[#F27A4A]/15 ring-2 ring-[#E8622C]/30 shadow-md'
                      : 'border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] hover:border-[#E8622C]/50 dark:hover:border-[#F27A4A]/50'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                        isSelected ? 'bg-[#E8622C] text-white' : 'bg-[#FBF3EC] dark:bg-[#1A1714] text-[#E8622C] dark:text-[#F27A4A]'
                      }`}>
                        {type.icon}
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                        isSelected ? 'bg-[#E8622C] text-white' : 'bg-[#FBF3EC] dark:bg-[#1A1714] text-[#8A7F74] dark:text-[#A89E92]'
                      }`}>
                        {type.hint}
                      </span>
                    </div>

                    <h3 className="mt-4 font-[family-name:var(--font-display)] text-base font-bold text-[#2A2521] dark:text-[#F5EFE8]">
                      {type.label}
                    </h3>
                    <p className="mt-1 text-xs text-[#8A7F74] dark:text-[#A89E92] leading-relaxed">
                      {type.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#F0E4D8] dark:border-[#3A332A]/50 flex items-center justify-end">
                    <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                      isSelected ? 'border-[#E8622C] bg-[#E8622C]' : 'border-[#8A7F74]'
                    }`}>
                      {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* STEP 2: UPLOAD FILE */}
        {activeType ? (
          <div className="space-y-4 pt-4 border-t border-[#F0E4D8] dark:border-[#3A332A]">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#E8622C] text-white font-bold text-xs">2</span>
              <h2 className="font-[family-name:var(--font-display)] text-base font-bold text-[#2A2521] dark:text-[#F5EFE8]">
                Upload File ({activeType.label})
              </h2>
            </div>

            {/* Drag & Drop Box */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-8 text-center transition-all ${
                isDragging
                  ? 'border-[#E8622C] bg-[#E8622C]/10 dark:border-[#F27A4A] dark:bg-[#F27A4A]/10 scale-[0.99]'
                  : 'border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] hover:border-[#E8622C]/60 dark:hover:border-[#F27A4A]/60'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={activeType.accept}
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    setFile(e.target.files[0])
                    setError(null)
                  }
                }}
                className="hidden"
              />

              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E8622C]/10 dark:bg-[#F27A4A]/20 text-[#E8622C] dark:text-[#F27A4A] mb-4">
                <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>

              {file ? (
                <div>
                  <p className="font-[family-name:var(--font-data)] text-sm font-bold text-[#E8622C] dark:text-[#F27A4A]">
                    {file.name}
                  </p>
                  <p className="mt-1 text-xs text-[#8A7F74] dark:text-[#A89E92]">
                    {(file.size / 1024).toFixed(1)} KB &bull; Click or drag to replace
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-bold text-[#2A2521] dark:text-[#F5EFE8]">
                    Drag and drop your file here, or <span className="text-[#E8622C] dark:text-[#F27A4A] underline">browse files</span>
                  </p>
                  <p className="mt-1.5 text-xs text-[#8A7F74] dark:text-[#A89E92]">
                    Supports {activeType.hint} (max 10MB)
                  </p>
                </div>
              )}

              <button
                type="button"
                className="mt-5 rounded-xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FBF3EC] dark:bg-[#1A1714] px-4 py-2 text-xs font-bold text-[#2A2521] dark:text-[#F5EFE8] hover:border-[#E8622C] transition-colors"
              >
                Browse Files
              </button>
            </div>

            {/* Action Submit Button */}
            <div className="flex items-center justify-end pt-2">
              <button
                onClick={handleSubmit}
                disabled={!file || isProcessing}
                className="flex items-center gap-2 rounded-xl bg-[#E8622C] dark:bg-[#F27A4A] px-8 py-3.5 text-xs font-bold text-white shadow-lg shadow-[#E8622C]/20 hover:bg-[#D4531F] dark:hover:bg-[#E56938] transition-all transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <svg className="h-4 w-4 animate-spin text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12"/></svg>
                    <span>Reading Document with AI…</span>
                  </>
                ) : (
                  <>
                    <span>Process Document</span>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </>
                )}
              </button>
            </div>

            {/* Error Callout */}
            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/40 p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <svg className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <div>
                    <h4 className="text-xs font-bold text-red-800 dark:text-red-200">{error.title}</h4>
                    <p className="mt-1 text-xs text-red-700 dark:text-red-300 leading-relaxed">{error.detail}</p>
                  </div>
                </div>
                <div className="pl-8">
                  <button
                    onClick={handleSubmit}
                    className="rounded-lg border border-red-300 dark:border-red-800 bg-white dark:bg-red-950 px-3.5 py-1.5 text-xs font-bold text-red-800 dark:text-red-200 hover:bg-red-100 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#F0E4D8] dark:border-[#3A332A] p-8 text-center text-xs text-[#8A7F74] dark:text-[#A89E92]">
            Please select a document type above to continue to file selection.
          </div>
        )}

        {/* INFO TIP CALLOUT */}
        <div className="rounded-2xl border border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF] dark:bg-[#242019] p-4 flex items-center gap-3 text-xs text-[#8A7F74] dark:text-[#A89E92]">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#E8622C]/10 text-[#E8622C]">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          </div>
          <p>
            <strong className="text-[#2A2521] dark:text-[#F5EFE8]">Pro Tip:</strong> For handwritten bills or photos, ensure good lighting and flat alignment so our vision model can extract accurate item line rates and GST totals.
          </p>
        </div>

      </div>
    </DashboardLayout>
  )
}
