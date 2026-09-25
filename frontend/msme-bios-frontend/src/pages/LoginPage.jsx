import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'

export default function LoginPage() {
  const [name, setName] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    login(name.trim())
    navigate('/dashboard')
  }

  return (
    <div className="flex min-h-screen flex-col bg-white text-black dark:bg-black dark:text-white transition-colors">
      <Navbar />
      <main className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">Log in</h1>
          <p className="mt-2 text-sm text-black/60 dark:text-white/60">This is a demo login — enter any name to continue.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="name" className="block text-sm font-medium">Your name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Parth Sawant"
                className="mt-2 w-full border border-black/20 dark:border-white/20 bg-transparent px-3 py-2.5 text-sm placeholder:text-black/30 dark:placeholder:text-white/30 focus:border-black dark:focus:border-white focus:outline-none transition-colors"
              />
            </div>
            <button type="submit" className="w-full bg-black px-4 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-black hover:opacity-80 transition-opacity">
              Continue
            </button>
          </form>

          <p className="mt-6 text-sm text-black/60 dark:text-white/60">
            New here? <Link to="/signup" className="font-medium text-black dark:text-white underline">Sign up</Link>
          </p>
        </div>
      </main>
    </div>
  )
}
