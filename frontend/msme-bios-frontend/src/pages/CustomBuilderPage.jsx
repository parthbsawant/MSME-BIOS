import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion'
import Navbar from '../components/Navbar'
import { usePlan } from '../context/PlanContext'
import { FEATURES, formatPrice } from '../lib/featuresData'
import { useCatalog } from '../lib/useCatalog'
import { savePlan as savePlanToBackend } from '../lib/api'

function AnimatedPrice({ value }) {
  const motionValue = useMotionValue(value)
  const rounded = useTransform(motionValue, (v) => formatPrice(Math.round(v)))

  useEffect(() => {
    const controls = animate(motionValue, value, { duration: 0.4, ease: 'easeOut' })
    return controls.stop
  }, [value, motionValue])

  return <motion.span>{rounded}</motion.span>
}

export default function CustomBuilderPage() {
  const navigate = useNavigate()
  const { t } = useTranslation('onboarding')
  const { selectCustom } = usePlan()
  const { featureName, featureTagline } = useCatalog()
  const [selectedIds, setSelectedIds] = useState(['document_parser'])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toggleFeature = (id) => {
    const feature = FEATURES.find((f) => f.id === id)
    if (feature.locked) return
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const total = selectedIds.reduce((sum, id) => sum + FEATURES.find((f) => f.id === id).price, 0)

  const handleConfirm = async () => {
    setError('')
    setSaving(true)
    try {
      await savePlanToBackend({ type: 'custom', featureIds: selectedIds, price: total })
      selectCustom(selectedIds)
      navigate('/dashboard')
    } catch (err) {
      console.error('Failed to save plan:', err)
      setError('customBuilder.saveError')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FBF3EC] dark:bg-[#1A1714] text-[#2A2521] dark:text-[#F5EFE8] transition-colors">
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 py-12 pb-44">
        <button
          onClick={() => navigate('/choose-plan')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#8A7F74] hover:text-[#E8622C] dark:hover:text-[#F27A4A] transition-colors cursor-pointer"
        >
          &larr; {t('customBuilder.back')}
        </button>

        <div className="mt-4 max-w-2xl">
          <span className="text-xs font-bold uppercase tracking-wider text-[#E8622C] dark:text-[#F27A4A]">{t('customBuilder.badge')}</span>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-tight text-[#2A2521] dark:text-[#F5EFE8]">
            {t('customBuilder.title')}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#8A7F74] dark:text-[#A89E92]">
            {t('customBuilder.subtitle')}
          </p>
        </div>

        {/* Features Grid */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const isSelected = selectedIds.includes(f.id)
            return (
              <div
                key={f.id}
                className={`flex flex-col justify-between rounded-2xl border p-5 transition-all ${
                  isSelected
                    ? 'border-[#E8622C] dark:border-[#F27A4A] bg-[#FFFFFF] dark:bg-[#242019] ring-2 ring-[#E8622C]/20 shadow-sm'
                    : 'border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF]/60 dark:bg-[#242019]/60 hover:border-[#E8622C]/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-[#2A2521] dark:text-[#F5EFE8]">
                      {featureName(f.id)}
                    </h3>
                    <span className="font-[family-name:var(--font-data)] text-xs font-bold text-[#E8622C] dark:text-[#F27A4A]">
                      {formatPrice(f.price)}{t('customBuilder.perMonthShort')}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#8A7F74] dark:text-[#A89E92] leading-relaxed">
                    {f.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#F0E4D8] dark:border-[#3A332A]/50 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#8A7F74] dark:text-[#A89E92] truncate max-w-[170px]">
                    {featureTagline(f.id)}
                  </span>

                  {f.locked ? (
                    <span className="rounded-full bg-[#E8F5EC] dark:bg-[#132E21] px-2.5 py-1 text-[10px] font-bold text-[#1F9254] dark:text-[#34D399]">
                      {t('customBuilder.included')}
                    </span>
                  ) : (
                    <button
                      onClick={() => toggleFeature(f.id)}
                      aria-label={isSelected ? t('customBuilder.remove', { name: featureName(f.id) }) : t('customBuilder.add', { name: featureName(f.id) })}
                      className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#E8622C] text-white dark:bg-[#F27A4A] dark:text-white shadow-xs'
                          : 'border border-[#F0E4D8] dark:border-[#3A332A] text-[#8A7F74] hover:border-[#E8622C] hover:text-[#E8622C]'
                      }`}
                    >
                      {isSelected ? (
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      ) : (
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* Fixed Bottom Checkout Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#F0E4D8] dark:border-[#3A332A] bg-[#FFFFFF]/95 dark:bg-[#242019]/95 backdrop-blur-md px-6 py-4 shadow-2xl">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Selected Pills */}
          <div className="flex flex-1 items-center gap-2 overflow-x-auto max-w-full pb-1 sm:pb-0">
            <AnimatePresence initial={false}>
              {selectedIds.map((id) => {
                return (
                  <motion.span
                    key={id}
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                    className="whitespace-nowrap rounded-full bg-[#E8622C]/10 dark:bg-[#F27A4A]/20 border border-[#E8622C]/30 px-3 py-1 text-xs font-semibold text-[#E8622C] dark:text-[#F27A4A]"
                  >
                    {featureName(id)}
                  </motion.span>
                )
              })}
            </AnimatePresence>
          </div>

          {/* Price & Confirmation */}
          <div className="flex items-center gap-6 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8A7F74] dark:text-[#A89E92]">{t('customBuilder.monthlyTotal')}</p>
              <p className="font-[family-name:var(--font-display)] text-2xl font-extrabold text-[#2A2521] dark:text-[#F5EFE8]">
                <AnimatedPrice value={total} /><span className="text-xs font-normal text-[#8A7F74]">{t('customBuilder.perMonthShort')}</span>
              </p>
            </div>

            <button
              onClick={handleConfirm}
              disabled={saving}
              className="rounded-xl bg-[#E8622C] dark:bg-[#F27A4A] px-7 py-3.5 text-xs font-bold text-white shadow-lg shadow-[#E8622C]/20 hover:bg-[#D4531F] dark:hover:bg-[#E56938] transition-all transform active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {saving ? t('customBuilder.saving') : t('customBuilder.confirm')}
            </button>
          </div>
        </div>
        {error && (
          <p className="mx-auto max-w-6xl mt-2 text-xs font-semibold text-red-600 dark:text-red-400 text-center">{t(error)}</p>
        )}
      </div>
    </div>
  )
}
