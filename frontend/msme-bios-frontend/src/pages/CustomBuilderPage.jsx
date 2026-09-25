import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion'
import Navbar from '../components/Navbar'
import { usePlan } from '../context/PlanContext'
import { FEATURES, formatPrice } from '../lib/featuresData'

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
  const { selectCustom } = usePlan()
  const [selectedIds, setSelectedIds] = useState(['document_parser'])

  const toggleFeature = (id) => {
    const feature = FEATURES.find((f) => f.id === id)
    if (feature.locked) return
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const total = selectedIds.reduce((sum, id) => sum + FEATURES.find((f) => f.id === id).price, 0)

  const handleConfirm = () => {
    selectCustom(selectedIds)
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-white text-black dark:bg-black dark:text-white transition-colors">
      <Navbar />
      <main className="mx-auto max-w-5xl px-6 py-14 pb-40">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">Build your plan</h1>
        <p className="mt-2 text-black/60 dark:text-white/60">
          Document parser is included in every plan. Add whatever else you need. Prices shown are illustrative for this demo.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {FEATURES.map((f) => {
            const isSelected = selectedIds.includes(f.id)
            return (
              <div
                key={f.id}
                className={`flex flex-col justify-between border p-5 transition-colors ${
                  isSelected ? 'border-black dark:border-white' : 'border-black/15 dark:border-white/15'
                }`}
              >
                <div>
                  <p className="font-medium">{f.name}</p>
                  <p className="mt-1 text-xs text-black/50 dark:text-white/50">{f.tagline}</p>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="font-[family-name:var(--font-data)] text-sm">{formatPrice(f.price)}/mo</span>
                  {f.locked ? (
                    <span className="font-[family-name:var(--font-data)] text-[10px] border border-black/20 dark:border-white/20 px-2 py-1 text-black/50 dark:text-white/50">
                      Included
                    </span>
                  ) : (
                    <button
                      onClick={() => toggleFeature(f.id)}
                      aria-label={isSelected ? `Remove ${f.name}` : `Add ${f.name}`}
                      className={`flex h-7 w-7 items-center justify-center border transition-colors ${
                        isSelected
                          ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
                          : 'border-black/30 hover:border-black dark:border-white/30 dark:hover:border-white'
                      }`}
                    >
                      {isSelected ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 border-t border-black/15 bg-white/95 backdrop-blur dark:border-white/15 dark:bg-black/95">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between gap-6">
          <div className="flex flex-1 items-center gap-2 overflow-x-auto">
            <AnimatePresence initial={false}>
              {selectedIds.map((id) => {
                const f = FEATURES.find((feat) => feat.id === id)
                return (
                  <motion.span
                    key={id}
                    layout
                    initial={{ opacity: 0, scale: 0.8, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: 8 }}
                    transition={{ duration: 0.2 }}
                    className="whitespace-nowrap border border-black/20 dark:border-white/20 px-3 py-1.5 text-xs"
                  >
                    {f.name}
                  </motion.span>
                )
              })}
            </AnimatePresence>
          </div>
          <div className="flex items-center gap-6 shrink-0">
            <div className="text-right">
              <p className="text-xs text-black/50 dark:text-white/50">Total</p>
              <p className="font-[family-name:var(--font-data)] text-xl">
                <AnimatedPrice value={total} /><span className="text-sm text-black/40 dark:text-white/40">/mo</span>
              </p>
            </div>
            <button
              onClick={handleConfirm}
              className="bg-black px-6 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-black hover:opacity-80 transition-opacity"
            >
              Confirm plan
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
