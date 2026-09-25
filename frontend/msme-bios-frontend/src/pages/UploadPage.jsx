import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { generateMockResult } from '../lib/mockParser'

// Kept as a plain array specifically so adding Excel, GST, ITR, and
// business-rule file types later (parked for the backend phase) is a
// small addition here, not a rewrite of the page.
const docTypes = [
  { id: 'bank_statement', label: 'Bank statement', hint: 'PDF', accept: '.pdf' },
  { id: 'invoice_bill', label: 'Invoice / bill', hint: 'PDF', accept: '.pdf' },
  { id: 'photo_bill', label: 'Handwritten bill', hint: 'Photo', accept: 'image/*' },
]

export default function UploadPage() {
  const [selectedType, setSelectedType] = useState(null)
  const [file, setFile] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef(null)
  const navigate = useNavigate()

  const activeType = docTypes.find((t) => t.id === selectedType)

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0])
  }

  const handleSubmit = () => {
    if (!file || !selectedType) return
    setIsProcessing(true)
    setTimeout(() => {
      const result = generateMockResult(selectedType, file.name)
      navigate('/results', { state: { result, documentType: selectedType, fileName: file.name } })
    }, 1400)
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
                onClick={() => { setSelectedType(type.id); setFile(null) }}
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
                onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
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
          </div>
        )}
      </main>
    </div>
  )
}
