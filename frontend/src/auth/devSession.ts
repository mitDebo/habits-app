import type { Session } from '@supabase/supabase-js'

// A pretend sign-in for trying the app on your own computer (`npm run dev`), for when the real sign-in can't
// come back to it, like from a phone on the home network. Only in the dev server: `import.meta.env.DEV` is
// false in the built site, so none of this ends up on goals.kdubs.tech.
export const devSignInAvailable = import.meta.env.DEV

const KEY = 'goals-dev-signed-in'
const EVENT = 'goals-dev-auth'

// The pretend session. Only the parts the app reads are filled in; anything that calls the real API with it
// will be turned away, which is fine for the mockup pages.
export const devSession = {
  access_token: 'dev',
  refresh_token: 'dev',
  token_type: 'bearer',
  expires_in: 3600,
  user: {
    id: 'dev-user',
    email: 'dev@localhost',
    aud: 'authenticated',
    app_metadata: {},
    user_metadata: { full_name: 'Dev User' },
    created_at: '2026-01-01T00:00:00Z',
  },
} as Session

// Whether the pretend sign-in is on (it lasts until you sign out, even across refreshes).
export function devSignedIn(): boolean {
  if (!devSignInAvailable) return false
  try {
    return localStorage.getItem(KEY) === 'yes'
  } catch {
    return false
  }
}

function setDevSignedIn(on: boolean) {
  if (!devSignInAvailable) return
  try {
    if (on) localStorage.setItem(KEY, 'yes')
    else localStorage.removeItem(KEY)
  } catch {
    // No storage (private window): it just won't last across a refresh.
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: on }))
}

export const startDevSession = () => setDevSignedIn(true)
export const endDevSession = () => setDevSignedIn(false)

// Calls `listener` with true/false whenever the pretend sign-in turns on or off. Returns a stop function.
export function onDevSessionChange(listener: (on: boolean) => void): () => void {
  const handle = (event: Event) => listener((event as CustomEvent<boolean>).detail)
  window.addEventListener(EVENT, handle)
  return () => window.removeEventListener(EVENT, handle)
}
