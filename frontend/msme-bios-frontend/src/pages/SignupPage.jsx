// import { useState } from 'react'
// import { useNavigate, Link } from 'react-router-dom'
// import { useAuth } from '../context/AuthContext'
// import Navbar from '../components/Navbar'

// export default function SignupPage() {
//   const [form, setForm] = useState({ name: '', email: '', businessName: '' })
//   const { signup } = useAuth()
//   const navigate = useNavigate()

//   const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

//   const handleSubmit = (e) => {
//     e.preventDefault()
//     if (!form.name.trim() || !form.email.trim()) return
//     signup(form)
//     navigate('/business-setup')
//   }

//   return (
//     <div className="flex min-h-screen flex-col bg-white text-black dark:bg-black dark:text-white transition-colors">
//       <Navbar />
//       <main className="flex flex-1 items-center justify-center px-6">
//         <div className="w-full max-w-sm">
//           <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">Sign up</h1>
//           <p className="mt-2 text-sm text-black/60 dark:text-white/60">This is a demo signup — no real account is created yet.</p>

//           <form onSubmit={handleSubmit} className="mt-8 space-y-5">
//             <div>
//               <label className="block text-sm font-medium">Your name</label>
//               <input
//                 type="text"
//                 value={form.name}
//                 onChange={update('name')}
//                 placeholder="e.g. Parth Sawant"
//                 className="mt-2 w-full border border-black/20 dark:border-white/20 bg-transparent px-3 py-2.5 text-sm placeholder:text-black/30 dark:placeholder:text-white/30 focus:border-black dark:focus:border-white focus:outline-none transition-colors"
//               />
//             </div>
//             <div>
//               <label className="block text-sm font-medium">Email</label>
//               <input
//                 type="email"
//                 value={form.email}
//                 onChange={update('email')}
//                 placeholder="e.g. parth@example.com"
//                 className="mt-2 w-full border border-black/20 dark:border-white/20 bg-transparent px-3 py-2.5 text-sm placeholder:text-black/30 dark:placeholder:text-white/30 focus:border-black dark:focus:border-white focus:outline-none transition-colors"
//               />
//             </div>
//             <div>
//               <label className="block text-sm font-medium">Business name</label>
//               <input
//                 type="text"
//                 value={form.businessName}
//                 onChange={update('businessName')}
//                 placeholder="e.g. Shree Ganesh Stores"
//                 className="mt-2 w-full border border-black/20 dark:border-white/20 bg-transparent px-3 py-2.5 text-sm placeholder:text-black/30 dark:placeholder:text-white/30 focus:border-black dark:focus:border-white focus:outline-none transition-colors"
//               />
//             </div>
//             <button type="submit" className="w-full bg-black px-4 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-black hover:opacity-80 transition-opacity">
//               Create account
//             </button>
//           </form>

//           <p className="mt-6 text-sm text-black/60 dark:text-white/60">
//             Already have an account? <Link to="/login" className="font-medium text-black dark:text-white underline">Log in</Link>
//           </p>
//         </div>
//       </main>
//     </div>
//   )
// }


import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'

export default function SignupPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { signup, loginWithGoogle } = useAuth()
  const navigate = useNavigate()

  const handleGoogleSignup = async () => {
    setError('')

    try {
      setLoading(true)
      await loginWithGoogle()
      navigate('/business-setup')
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        console.error('Google signup error:', err)
      }

      if (err.code === 'auth/popup-closed-by-user') {
        setError('Google sign-in was cancelled.')
      } else if (err.code === 'auth/popup-blocked') {
        setError('The Google sign-in popup was blocked by your browser.')
      } else {
        setError('Unable to sign up with Google. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const update = (field) => (e) => {
    setForm((f) => ({
      ...f,
      [field]: e.target.value,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    setError('')

    if (!form.name.trim()) {
      setError('Please enter your name.')
      return
    }

    if (!form.email.trim()) {
      setError('Please enter your email address.')
      return
    }

    if (!form.password) {
      setError('Please enter a password.')
      return
    }

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters long.')
      return
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    try {
      setLoading(true)

      await signup({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      })

      navigate('/business-setup')
    } catch (err) {
      console.error('Signup error:', err)

      switch (err.code) {
        case 'auth/email-already-in-use':
          setError('An account already exists with this email.')
          break

        case 'auth/invalid-email':
          setError('Please enter a valid email address.')
          break

        case 'auth/weak-password':
          setError('Password is too weak. Please use a stronger password.')
          break

        case 'auth/operation-not-allowed':
          setError('Email/password authentication is not enabled in Firebase.')
          break

        default:
          setError('Unable to create your account. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-white text-black dark:bg-black dark:text-white transition-colors">
      <Navbar />

      <main className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">

          {/* Heading */}
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
              Sign up
            </h1>

            <p className="mt-2 text-sm text-black/60 dark:text-white/60">
              Create your MSME-BIOS account.
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mt-6 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">

            {/* Name */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium"
              >
                Your name
              </label>

              <input
                id="name"
                type="text"
                value={form.name}
                onChange={update('name')}
                placeholder="e.g. Parth Sawant"
                autoComplete="name"
                disabled={loading}
                className="mt-2 w-full border border-black/20 dark:border-white/20 bg-transparent px-3 py-2.5 text-sm placeholder:text-black/30 dark:placeholder:text-white/30 focus:border-black dark:focus:border-white focus:outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium"
              >
                Email
              </label>

              <input
                id="email"
                type="email"
                value={form.email}
                onChange={update('email')}
                placeholder="e.g. parth@example.com"
                autoComplete="email"
                disabled={loading}
                className="mt-2 w-full border border-black/20 dark:border-white/20 bg-transparent px-3 py-2.5 text-sm placeholder:text-black/30 dark:placeholder:text-white/30 focus:border-black dark:focus:border-white focus:outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium"
              >
                Password
              </label>

              <input
                id="password"
                type="password"
                value={form.password}
                onChange={update('password')}
                placeholder="Minimum 6 characters"
                autoComplete="new-password"
                disabled={loading}
                className="mt-2 w-full border border-black/20 dark:border-white/20 bg-transparent px-3 py-2.5 text-sm placeholder:text-black/30 dark:placeholder:text-white/30 focus:border-black dark:focus:border-white focus:outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium"
              >
                Confirm password
              </label>

              <input
                id="confirmPassword"
                type="password"
                value={form.confirmPassword}
                onChange={update('confirmPassword')}
                placeholder="Re-enter your password"
                autoComplete="new-password"
                disabled={loading}
                className="mt-2 w-full border border-black/20 dark:border-white/20 bg-transparent px-3 py-2.5 text-sm placeholder:text-black/30 dark:placeholder:text-white/30 focus:border-black dark:focus:border-white focus:outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* Create account */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black px-4 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-black hover:opacity-80 transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
            <span className="text-xs text-black/40 dark:text-white/40">OR</span>
            <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
          </div>

          {/* Google Signup */}
          <button
            type="button"
            onClick={handleGoogleSignup}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 border border-black/20 dark:border-white/20 px-4 py-2.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="text-base font-semibold">G</span>
            {loading ? 'Please wait...' : 'Continue with Google'}
          </button>

          {/* Login link */}
          <p className="mt-6 text-sm text-black/60 dark:text-white/60">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-medium text-black dark:text-white underline"
            >
              Log in
            </Link>
          </p>

        </div>
      </main>
    </div>
  )
}
