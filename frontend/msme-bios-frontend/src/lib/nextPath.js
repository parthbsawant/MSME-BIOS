// Where to go after login/signup, from ?next=. Only invite links are
// allowed: anything else is ignored, so the parameter can't be abused to
// send people to other pages or sites (open redirect).
const ALLOWED = /^\/invite\/[A-Za-z0-9_-]+$/

export function safeNext(searchParams) {
  const next = searchParams.get('next')
  return next && ALLOWED.test(next) ? next : null
}

// "?next=..." to carry the same destination to the other auth page.
export function nextQuery(next) {
  return next ? `?next=${encodeURIComponent(next)}` : ''
}
