// Dates travel as plain "2026-03-05" strings (a calendar day, no time or zone).
// The maths happens in UTC so daylight-saving changes can't make a day 23 or 25 hours long.
const toUtc = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

const DAY_MS = 86_400_000

export const addDays = (iso: string, days: number) => new Date(toUtc(iso) + days * DAY_MS).toISOString().slice(0, 10)

// How many days from a to b (b - a). Same day = 0.
export const daysBetween = (a: string, b: string) => Math.round((toUtc(b) - toUtc(a)) / DAY_MS)

// "Mar 5"
export const shortDate = (iso: string) =>
  new Date(toUtc(iso)).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })

// 0 = Sunday … 6 = Saturday.
export const weekdayOf = (iso: string) => new Date(toUtc(iso)).getUTCDay()

