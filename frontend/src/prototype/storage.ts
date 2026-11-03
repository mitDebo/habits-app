import type { NewGoal } from '@/week/goalKinds'

// Prototype data, kept in this browser's localStorage until the app has a real backend for it: your goals,
// and every plan (its dates, which goals it has, and what's been recorded). Each browser has its own copy.

// A goal. The id ties it to its plans, ticks and values, so it stays the same even if the name changes.
export type MockGoal = { id: number } & NewGoal

// A plan as it's saved. Dates are real calendar days ("2026-11-03"), so a plan stays on its dates as the
// weeks go by. Ticks, values and removed days are keyed "goalId|date".
export type StoredSheet = {
  id: number
  name: string
  start: string
  end: string
  goalIds: number[]
  ticked: string[]
  values: Record<string, number | string>
  removedDays: string[]
}

export type PrototypeData = { goals: MockGoal[]; sheets: StoredSheet[] }

// Bump the version if the saved shape changes, so old saves are ignored instead of breaking the page.
const KEY = 'goals-prototype-data-v1'

// The saved data, or null if there's none yet (a new user) or it can't be read.
export function loadPrototype(): PrototypeData | null {
  try {
    const saved = localStorage.getItem(KEY)
    if (!saved) return null
    const data = JSON.parse(saved) as PrototypeData
    return Array.isArray(data.goals) && Array.isArray(data.sheets) ? data : null
  } catch {
    return null
  }
}

export function savePrototype(data: PrototypeData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // No storage (a private window, or it's full): the page still works, it just won't remember.
  }
}

// Back to a clean slate: no goals, and one empty plan for this week (made the next time the grid opens).
export function resetPrototype() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing to clear.
  }
}

// A goal's settings in a few words, for lists: "Toggle ✓", "Number, 1–10 pages", "Choice 😀 🙂 😐".
export function describeGoal(goal: MockGoal): string {
  if (goal.kind === 'toggle') return `Toggle ${goal.mark ?? '✓'}`
  if (goal.kind === 'choice') return `Choice ${goal.choice.options.map((o) => o.emoji).join(' ')}`
  const { min, max, unit } = goal.number
  const bounds =
    min !== undefined && max !== undefined
      ? `${min}–${max}`
      : min !== undefined
        ? `${min} or more`
        : max !== undefined
          ? `up to ${max}`
          : ''
  return ['Number', [bounds, unit].filter(Boolean).join(' ')].filter(Boolean).join(', ')
}
