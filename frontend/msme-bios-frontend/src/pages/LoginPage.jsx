// import { useState } from 'react'
// import { useNavigate, Link } from 'react-router-dom'
// import { useAuth } from '../context/AuthContext'
// import Navbar from '../components/Navbar'

// export default function LoginPage() {
//   const [name, setName] = useState('')
//   const { login } = useAuth()
//   const navigate = useNavigate()

//   const handleSubmit = (e) => {
//     e.preventDefault()
//     if (!name.trim()) return
//     login(name.trim())
//     navigate('/dashboard')
//   }

//   return (
//     <div className="flex min-h-screen flex-col bg-white text-black dark:bg-black dark:text-white transition-colors">
//       <Navbar />
//       <main className="flex flex-1 items-center justify-center px-6">
//         <div className="w-full max-w-sm">
//           <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">Log in</h1>
//           <p className="mt-2 text-sm text-black/60 dark:text-white/60">This is a demo login — enter any name to continue.</p>

//           <form onSubmit={handleSubmit} className="mt-8 space-y-5">
//             <div>
//               <label htmlFor="name" className="block text-sm font-medium">Your name</label>
//               <input
//                 id="name"
//                 type="text"
//                 value={name}
//                 onChange={(e) => setName(e.target.value)}
//                 placeholder="e.g. Parth Sawant"
//                 className="mt-2 w-full border border-black/20 dark:border-white/20 bg-transparent px-3 py-2.5 text-sm placeholder:text-black/30 dark:placeholder:text-white/30 focus:border-black dark:focus:border-white focus:outline-none transition-colors"
//               />
//             </div>
//             <button type="submit" className="w-full bg-black px-4 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-black hover:opacity-80 transition-opacity">
//               Continue
//             </button>
//           </form>

//           <p className="mt-6 text-sm text-black/60 dark:text-white/60">
//             New here? <Link to="/signup" className="font-medium text-black dark:text-white underline">Sign up</Link>
//           </p>
//         </div>
//       </main>
//     </div>
//   )
// }


import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { login, loginWithGoogle } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()

    setError('')

    if (!email.trim() || !password) {
      setError('Please enter your email and password.')
      return
    }

    try {
      setLoading(true)

      await login(email.trim(), password)

      navigate('/dashboard')
    } catch (err) {
      console.error('Login error:', err)

      switch (err.code) {
        case 'auth/invalid-credential':
          setError('Invalid email or password.')
          break

        case 'auth/user-not-found':
          setError('No account found with this email.')
          break

        case 'auth/wrong-password':
          setError('Incorrect password.')
          break

        case 'auth/invalid-email':
          setError('Please enter a valid email address.')
          break

        case 'auth/too-many-requests':
          setError('Too many failed attempts. Please try again later.')
          break

        default:
          setError('Unable to log in. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setError('')

    try {
      setLoading(true)

      await loginWithGoogle()

      navigate('/dashboard')
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        console.error('Google login error:', err)
      }

      if (err.code === 'auth/popup-closed-by-user') {
        setError('Google sign-in was cancelled.')
      } else if (err.code === 'auth/popup-blocked') {
        setError('The Google sign-in popup was blocked by your browser.')
      } else {
        setError('Unable to sign in with Google. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-white text-black dark:bg-black dark:text-white transition-colors">
      <Navbar />

      <main className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-sm">

          {/* Heading */}
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
              Log in
            </h1>

            <p className="mt-2 text-sm text-black/60 dark:text-white/60">
              Log in to continue to MSME-BIOS.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-6 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Email / Password Form */}
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">

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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={loading}
                className="mt-2 w-full border border-black/20 dark:border-white/20 bg-transparent px-3 py-2.5 text-sm placeholder:text-black/30 dark:placeholder:text-white/30 focus:border-black dark:focus:border-white focus:outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* Login button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black px-4 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-black hover:opacity-80 transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Logging in...' : 'Log in'}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />

            <span className="text-xs text-black/40 dark:text-white/40">
              OR
            </span>

            <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
          </div>

          {/* Google Login */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 border border-black/20 dark:border-white/20 px-4 py-2.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="text-base font-semibold">
              G
            </span>

            {loading ? 'Please wait...' : 'Continue with Google'}
          </button>

          {/* Signup */}
          <p className="mt-6 text-sm text-black/60 dark:text-white/60">
            New here?{' '}
            <Link
              to="/signup"
              className="font-medium text-black dark:text-white underline"
            >
              Sign up
            </Link>
          </p>

        </div>
      </main>
    </div>
  )
}