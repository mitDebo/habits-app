import { apiFetch, readFieldErrors } from '@/api/client'
import { devSession, devSignInAvailable } from '@/auth/devSession'

export type WeekStart = 'sunday' | 'monday'
export type Profile = { timeZone: string; weekStart: WeekStart; today: string }

export const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

// The pretend dev sign-in (see devSession.ts) has no account on our backend, so its profile lives here in
// the browser instead: your browser's time zone, weeks starting on Monday, and today's date from this device.
const isDev = (token: string) => devSignInAvailable && token === devSession.access_token
const localToday = () => {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
let devProfile: Omit<Profile, 'today'> = { timeZone: browserTimeZone(), weekStart: 'monday' }
const devProfileNow = (): Profile => ({ ...devProfile, today: localToday() })

// Creates the profile on first visit; returns the existing one otherwise.
// Returns null if it couldn't be done (server error or no connection).
export async function ensureProfile(token: string): Promise<Profile | null> {
  if (isDev(token)) return devProfileNow()
  try {
    const res = await apiFetch('/api/me', token, {
      method: 'POST',
      body: JSON.stringify({ timeZone: browserTimeZone() }),
    })
    return res.ok ? ((await res.json()) as Profile) : null
  } catch {
    return null
  }
}

export async function getProfile(token: string): Promise<Profile | null> {
  if (isDev(token)) return devProfileNow()
  const res = await apiFetch('/api/me', token)
  return res.ok ? ((await res.json()) as Profile) : null
}

export type SaveResult = { ok: true; profile: Profile } | { ok: false; errors: string[] }

// Sends only the fields given. On a 400, returns the server's reasons.
export async function updateProfile(
  token: string,
  changes: Partial<Pick<Profile, 'timeZone' | 'weekStart'>>,
): Promise<SaveResult> {
  if (isDev(token)) {
    devProfile = { ...devProfile, ...changes }
    return { ok: true, profile: devProfileNow() }
  }
  const res = await apiFetch('/api/me', token, { method: 'PATCH', body: JSON.stringify(changes) })
  if (res.ok) return { ok: true, profile: (await res.json()) as Profile }

  const errors = Object.values(await readFieldErrors(res)).flat()
  return { ok: false, errors: errors.length ? errors : ["Couldn't save your settings."] }
}
