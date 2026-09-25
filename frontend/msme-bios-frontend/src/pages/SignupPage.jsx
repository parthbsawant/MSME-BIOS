import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'

export default function SignupPage() {
  const [form, setForm] = useState({ name: '', email: '', businessName: '' })
  const { signup } = useAuth()
  const navigate = useNavigate()

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim()) return
    signup(form)
    navigate('/business-setup')
  }

  return (
    <div className="flex min-h-screen flex-col bg-white text-black dark:bg-black dark:text-white transition-colors">
      <Navbar />
      <main className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">Sign up</h1>
          <p className="mt-2 text-sm text-black/60 dark:text-white/60">This is a demo signup — no real account is created yet.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="block text-sm font-medium">Your name</label>
              <input
                type="text"
                value={form.name}
                onChange={update('name')}
                placeholder="e.g. Parth Sawant"
                className="mt-2 w-full border border-black/20 dark:border-white/20 bg-transparent px-3 py-2.5 text-sm placeholder:text-black/30 dark:placeholder:text-white/30 focus:border-black dark:focus:border-white focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={update('email')}
                placeholder="e.g. parth@example.com"
                className="mt-2 w-full border border-black/20 dark:border-white/20 bg-transparent px-3 py-2.5 text-sm placeholder:text-black/30 dark:placeholder:text-white/30 focus:border-black dark:focus:border-white focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Business name</label>
              <input
                type="text"
                value={form.businessName}
                onChange={update('businessName')}
                placeholder="e.g. Shree Ganesh Stores"
                className="mt-2 w-full border border-black/20 dark:border-white/20 bg-transparent px-3 py-2.5 text-sm placeholder:text-black/30 dark:placeholder:text-white/30 focus:border-black dark:focus:border-white focus:outline-none transition-colors"
              />
            </div>
            <button type="submit" className="w-full bg-black px-4 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-black hover:opacity-80 transition-opacity">
              Create account
            </button>
          </form>

          <p className="mt-6 text-sm text-black/60 dark:text-white/60">
            Already have an account? <Link to="/login" className="font-medium text-black dark:text-white underline">Log in</Link>
          </p>
        </div>
      </main>
    </div>
  )
}
