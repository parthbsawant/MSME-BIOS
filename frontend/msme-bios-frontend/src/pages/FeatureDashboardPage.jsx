import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { usePlan } from '../context/PlanContext'
import { featureById } from '../lib/featuresData'

export default function FeatureDashboardPage() {
  const { user } = useAuth()
  const { plan } = usePlan()
  const navigate = useNavigate()
  const firstName = user?.name?.split(' ')[0]

  const features = plan.featureIds.map(featureById)

  return (
    <div className="min-h-screen bg-white text-black dark:bg-black dark:text-white transition-colors">
      <Navbar />
      <main className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
          Welcome{firstName ? `, ${firstName}` : ''}.
        </h1>
        <p className="mt-2 text-black/60 dark:text-white/60">Here's everything in your plan.</p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {features.map((feature) => {
            const isParser = feature.id === 'document_parser'
            return (
              <div key={feature.id} className="border border-black/15 dark:border-white/15 bg-white dark:bg-black p-6 flex flex-col justify-between min-h-[160px]">
                <div>
                  <p className="font-medium">{feature.name}</p>
                  <p className="mt-2 text-sm text-black/60 dark:text-white/60">{feature.description}</p>
                </div>
                {isParser ? (
                  <button
                    onClick={() => navigate('/upload')}
                    className="mt-6 self-start text-sm font-medium border border-black dark:border-white px-4 py-2 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
                  >
                    Add documents
                  </button>
                ) : (
                  <button className="mt-6 self-start text-sm font-medium border border-black/20 dark:border-white/20 px-4 py-2 text-black/40 dark:text-white/40 cursor-default">
                    Open
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
