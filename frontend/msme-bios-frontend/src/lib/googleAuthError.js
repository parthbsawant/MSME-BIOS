// Maps a Firebase auth error code from a Google popup sign-in to an
// auth-namespace translation key. Unknown codes use the page's fallback.
export function googleErrorKey(code, fallbackKey) {
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'errors.googleCancelled'
    case 'auth/popup-blocked':
      return 'errors.googlePopupBlocked'
    case 'auth/unauthorized-domain':
      return 'errors.googleUnauthorizedDomain'
    case 'auth/operation-not-allowed':
      return 'errors.googleNotEnabled'
    case 'auth/network-request-failed':
      return 'errors.networkError'
    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
    case 'auth/configuration-not-found':
    case 'auth/invalid-app-credential':
      return 'errors.googleConfigError'
    default:
      return fallbackKey
  }
}
