import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Landmark,
  Receipt,
  Camera,
  UploadCloud,
  FileCheck2,
  ArrowRight,
  Loader2,
  AlertCircle,
  Info,
} from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout'
import { parseDocument } from '../lib/api'
import { useBusiness } from '../context/BusinessContext'

const docTypes = [
  {
    id: 'bank_statement',
    accept: '.pdf',
    icon: <Landmark className="h-6 w-6" strokeWidth={2} />,
  },
  {
    id: 'invoice_bill',
    accept: '.pdf',
    icon: <Receipt className="h-6 w-6" strokeWidth={2} />,
  },
  {
    id: 'photo_bill',
    accept: 'image/*',
    icon: <Camera className="h-6 w-6" strokeWidth={2} />,
  },
]

export default function UploadPage() {
  const { t } = useTranslation('upload')
  const [selectedType, setSelectedType] = useState(null)
  const [file, setFile] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)
  const navigate = useNavigate()
  // STEP 5: the owner files each upload under a department; a member's
  // uploads always go to their own department (the backend enforces it).
  const { t: tTeam } = useTranslation('team')
  const { isOwner, department: myDepartment } = useBusiness()
  const [department, setDepartment] = useState('finance')

  const activeType = docTypes.find((d) => d.id === selectedType)

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
      const result = await parseDocument(file, selectedType, isOwner ? department : undefined)
      // /results/<id> survives a refresh (ResultsPage reloads the saved
      // document); the state just lets it show instantly without a fetch.
      const target = result.document_id ? `/results/${result.document_id}` : '/results'
      navigate(target, { state: { result, documentType: selectedType, fileName: file.name } })
    } catch (err) {
      // The error is stored as a key (not translated text) so it
      // re-translates if the language is switched while it's showing.
      // err.message is the server's own English text; kept separately
      // so the technical detail isn't lost.
      const serverMessage = err.message || ''
      if (err.code === 'feature_not_available') setError({ key: 'notAllowed', serverMessage: '' })
      else if (err.status === 501) setError({ key: 'notEnabled', serverMessage: '' })
      else if (err.status === 400) setError({ key: 'unreadable', serverMessage })
      else if (err.status) setError({ key: 'server', status: err.status, serverMessage })
      else setError({ key: 'network', serverMessage: '' })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <DashboardLayout activeItem="Upload Document">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Page Header */}
        <div>
          <span className="inline-block rounded-md bg-[var(--color-accent-soft)] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[var(--color-accent)]">
            {t('header.eyebrow')}
          </span>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-extrabold text-[var(--color-text)] tracking-tight">
            {t('header.title')}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[var(--color-muted)]">
            {t('header.subtitle')}
          </p>
        </div>

        {/* Department (STEP 5) */}
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] px-5 py-3.5 shadow-xs">
          {isOwner ? (
            <>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#1E9E6E]" />
                <label htmlFor="upload-department" className="text-xs font-bold text-[var(--color-text)]">
                  {tTeam('department.label')}
                </label>
              </div>
              <select
                id="upload-department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                disabled={isProcessing}
                className="rounded-xl border border-[var(--color-line)] dark:border-[#272F3A] bg-[var(--color-surface-2)] dark:bg-[#1C222B] px-3 py-1.5 text-xs font-medium text-[var(--color-text)] focus:ring-2 focus:ring-[var(--color-accent)] focus:outline-none transition-all"
              >
                {['finance', 'sales', 'hr', 'marketing'].map((d) => (
                  <option key={d} value={d}>
                    {tTeam(`roles.${d}`)}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-[var(--color-muted)]">
                {tTeam('department.ownerHint')}
              </span>
            </>
          ) : (
            <p className="text-xs text-[var(--color-text)]">
              {tTeam('department.memberFixed', { department: tTeam(`roles.${myDepartment}`) })}
            </p>
          )}
        </div>

        {/* STEP 1: SELECT DOCUMENT TYPE */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-accent)] text-white font-bold text-xs shadow-xs">
              1
            </span>
            <h2 className="font-[family-name:var(--font-display)] text-base font-bold text-[var(--color-text)]">
              {t('step1')}
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
                  className={`flex flex-col justify-between rounded-2xl border p-5 text-left transition-all duration-350 ease-out cursor-pointer ${
                    isSelected
                      ? 'border-[var(--color-accent)] bg-[var(--color-surface-2)] dark:bg-[#1C222B] ring-2 ring-[var(--color-accent)]/20 shadow-[var(--shadow-cool-md)]'
                      : 'border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] hover:-translate-y-1 hover:border-[var(--color-accent)]/50 hover:shadow-[var(--shadow-cool-md)] shadow-xs'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors duration-300 ${
                          isSelected
                            ? 'bg-[var(--color-accent)] text-white shadow-xs'
                            : 'bg-[var(--color-surface-2)] dark:bg-[#1C222B] text-[var(--color-accent)]'
                        }`}
                      >
                        {type.icon}
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                          isSelected
                            ? 'bg-[var(--color-accent)] text-white'
                            : 'bg-[var(--color-surface-2)] dark:bg-[#1C222B] text-[var(--color-muted)] border border-[var(--color-line)] dark:border-[#272F3A]'
                        }`}
                      >
                        {t(`types.${type.id}.hint`)}
                      </span>
                    </div>

                    <h3 className="mt-4 font-[family-name:var(--font-display)] text-base font-bold text-[var(--color-text)]">
                      {t(`types.${type.id}.label`)}
                    </h3>
                    <p className="mt-1 text-xs text-[var(--color-muted)] leading-relaxed">
                      {t(`types.${type.id}.description`)}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[var(--color-line)] dark:border-[#272F3A] flex items-center justify-end">
                    <div
                      className={`h-4 w-4 rounded-full border flex items-center justify-center transition-colors duration-300 ${
                        isSelected
                          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]'
                          : 'border-[var(--color-line)] dark:border-[#272F3A]'
                      }`}
                    >
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
          <div className="space-y-4 pt-4 border-t border-[var(--color-line)] dark:border-[#272F3A]">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-accent)] text-white font-bold text-xs shadow-xs">
                2
              </span>
              <h2 className="font-[family-name:var(--font-display)] text-base font-bold text-[var(--color-text)]">
                {t('step2', { type: t(`types.${activeType.id}.label`) })}
              </h2>
            </div>

            {/* Drag & Drop Box */}
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-8 text-center transition-all duration-350 ease-out ${
                isDragging
                  ? 'border-[var(--color-accent)] bg-[var(--color-surface-2)] dark:bg-[#1C222B] scale-[0.99] shadow-[var(--shadow-cool-md)]'
                  : 'border-[var(--color-line)] dark:border-[#272F3A] bg-white dark:bg-[#151A21] hover:border-[var(--color-accent)]/60 hover:shadow-[var(--shadow-cool-md)] shadow-xs'
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

              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-surface-2)] dark:bg-[#1C222B] text-[var(--color-accent)] mb-4 shadow-xs">
                {file ? <FileCheck2 className="h-7 w-7" strokeWidth={2} /> : <UploadCloud className="h-7 w-7" strokeWidth={2} />}
              </div>

              {file ? (
                <div>
                  <p className="font-[family-name:var(--font-data)] text-sm font-bold text-[var(--color-accent)]">
                    {file.name}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    {t('dropzone.replace', { size: (file.size / 1024).toFixed(1) })}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-bold text-[var(--color-text)]">
                    {t('dropzone.drag')}
                    <span className="text-[var(--color-accent)] underline ml-1 cursor-pointer">
                      {t('dropzone.browse')}
                    </span>
                  </p>
                  <p className="mt-1.5 text-xs text-[var(--color-muted)]">
                    {t('dropzone.supports', { hint: t(`types.${activeType.id}.hint`) })}
                  </p>
                </div>
              )}

              <button
                type="button"
                className="mt-5 rounded-xl border border-[var(--color-line)] dark:border-[#272F3A] bg-[var(--color-surface-2)] dark:bg-[#1C222B] px-4 py-2 text-xs font-bold text-[var(--color-text)] hover:border-[var(--color-accent)] transition-colors duration-300 cursor-pointer"
              >
                {t('dropzone.browseButton')}
              </button>
            </div>

            {/* Action Submit Button */}
            <div className="flex items-center justify-end pt-2">
              <button
                onClick={handleSubmit}
                disabled={!file || isProcessing}
                className="flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-8 py-3 text-xs font-bold text-white shadow-md shadow-[var(--color-accent)]/20 hover:brightness-110 transition-all duration-300 ease-out transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-white" strokeWidth={2} />
                    <span>{t('processing')}</span>
                  </>
                ) : (
                  <>
                    <span>{t('process')}</span>
                    <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-[var(--color-line)] dark:border-[#272F3A] bg-white/50 dark:bg-[#151A21]/50 p-10 text-center">
            {/* Calm geometric SVG placeholder */}
            <svg className="mx-auto h-12 w-12 text-[var(--color-muted)]/40 mb-3" viewBox="0 0 48 48" fill="none">
              <rect x="8" y="8" width="32" height="32" rx="8" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
              <circle cx="24" cy="24" r="6" stroke="currentColor" strokeWidth="2" />
            </svg>
            <p className="text-xs text-[var(--color-muted)]">{t('step2Hint')}</p>
          </div>
        )}

        {/* Error Callout */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] p-5 space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-[var(--color-danger)] shrink-0 mt-0.5" strokeWidth={2} />
                    <div>
                      <h4 className="text-xs font-bold text-[var(--color-danger)]">
                        {t(`errors.${error.key}.title`)}
                      </h4>
                      <p className="mt-1 text-xs text-[var(--color-danger)]/90 leading-relaxed">
                        {t(`errors.${error.key}.detail`, { status: error.status })}
                      </p>
                      {error.serverMessage && (
                        <p className="mt-2 text-[11px] text-[var(--color-danger)]/80 font-[family-name:var(--font-data)] break-words">
                          {t('serverMessage')} {error.serverMessage}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="pl-8">
                    <button
                      onClick={handleSubmit}
                      className="rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-card)] px-3.5 py-1.5 text-xs font-bold text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] transition-colors cursor-pointer"
                    >
                      {t('tryAgain')}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

        {/* INFO TIP CALLOUT */}
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 flex items-center gap-3 text-xs text-[var(--color-muted)] shadow-xs">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
            <Info className="h-4 w-4" strokeWidth={2} />
          </div>
          <p>
            <strong className="text-[var(--color-text)]">{t('tip.label')}</strong> {t('tip.body')}
          </p>
        </div>
      </div>
    </DashboardLayout>
  )
}
