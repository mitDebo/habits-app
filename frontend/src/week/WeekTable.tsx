import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowUp, Plus, Settings } from 'lucide-react'
import type { WeekStart } from '@/profile/api'
import { addDays, daysBetween, weekdayOf } from '@/dates/dates'
import { loadPrototype, savePrototype, type MockGoal, type PrototypeData } from '@/prototype/storage'
import { formatDate, formatShortDate, savedDateFormat, savedShortDateFormat } from '@/settings/dateFormat'
import { GoalDialog } from '@/week/GoalDialog'
import type { NewGoal } from '@/week/goalKinds'
import { DayCell } from '@/week/DayCell'
import { frameEdges } from '@/week/frame'
import { GoalNameCell } from '@/week/GoalNameCell'
import { RangeButtons } from '@/week/RangeButtons'
import { shortNumber } from '@/week/numbers'
import { RecordDialog, type Recording } from '@/week/RecordDialog'
import { SaveChangesDialog } from '@/week/SaveChangesDialog'
import { SheetTabs, MAX_SHEETS } from '@/week/SheetTabs'
import { TipBanner, type Tip } from '@/week/TipBanner'

// A plan's first and last days, counted from this week's first day (0 = that day, -2 = two days before).
type Range = { first: number; last: number }
const MAX_DAYS = 366

// A plan ("sheet"): its own dates, goals, ticks and removed days. Saved in this browser (see
// prototype/storage.ts), with real dates; here the dates are counted from this week's first day.
type Sheet = {
  id: number
  name: string
  range: Range
  goals: MockGoal[]
  ticked: Set<string>
  // Recorded numbers (and chosen options' emoji), by "goalId|date".
  values: Record<string, number | string>
  removedDays: Set<string>
}
const newSheet = (id: number, name: string, range: Range, goals: MockGoal[] = []): Sheet => ({
  id,
  name,
  range,
  goals,
  ticked: new Set(),
  values: {},
  removedDays: new Set(),
})
// "Schedule 1", "Schedule 2"…: the lowest number not already used by a plan's name.
const nextSheetName = (sheets: Sheet[]) => {
  let n = 1
  while (sheets.some((s) => s.name === `Schedule ${n}`)) n++
  return `Schedule ${n}`
}

// Stripes (tints set per theme in index.css). Each row and each day column alternates between a
// stronger and a lighter tint. They're see-through, so where a row crosses a column the two add up.
const rowTint = (row: number) => (row % 2 === 0 ? 'bg-row-1' : 'bg-row-2')
// The same stripe as a colour value (for places a class can't reach, like layering it over a solid base).
const stripeColor = (row: number) =>
  `color-mix(in oklab, var(--tint) var(${row % 2 === 0 ? '--row-1' : '--row-2'}), transparent)`
const columnStripeColor = (column: number) =>
  `color-mix(in oklab, var(--tint) var(${column % 2 === 0 ? '--column-1' : '--column-2'}), transparent)`
// A day cell's look as one solid background: its column's stripe over its row's stripe over the page.
const cellSurface = (row: number, column: number) =>
  `linear-gradient(${columnStripeColor(column)}, ${columnStripeColor(column)}), linear-gradient(${stripeColor(row)}, ${stripeColor(row)}), var(--background)`
const columnTint = (column: number) => (column % 2 === 0 ? 'bg-column-1' : 'bg-column-2')

// Column lines for a day in the plan: a line on its right, and on its left too when nothing in the plan
// is to its left (the first column, or the first day after blank or removed days). Blank and removed days
// have no lines of their own.
const lines = (column: number, startsARun = column === 0) =>
  `border-r border-foreground/25 ${startsARun ? 'border-l' : ''}`

// The slanted headers (one per weekday). Change ANGLE and both the bands and the names tilt together.
const ANGLE = 65 // degrees up from flat
const COLUMN_PX = 38 // width of a day column (narrow enough for a whole week on a 393px-wide phone)
// On smaller phones (under 390px wide, like 375px iPhones and many 360px Androids) the day columns are a little slimmer, so
// the whole week still fits without scrolling sideways.
const NARROW_COLUMN_PX = 35
const NARROW_SCREEN = '(max-width: 389px)'
const TEXT_GAP_PX = 4 // space below each weekday name
const END_GAP_PX = 6 // space between the longest name and the end of its band
const LINE_PX = 20 // height of one line of date text
const radians = (degrees: number) => (degrees * Math.PI) / 180

const cos = Math.cos(radians(ANGLE))
const sin = Math.sin(radians(ANGLE))

// Each header is a band shaped like a rectangle stood up at ANGLE: its sides lean at ANGLE and its far end
// is cut square across the band, so the ends make a sawtooth. Only the bottom is flat, where it sits on its
// column. Measured along the band, the middle is `middlePx` long; the left side is a little longer and the
// right side a little shorter, which is what makes the end square.
const bandSides = (middlePx: number, columnPx: number) => ({
  left: middlePx + (columnPx / 2) * cos,
  right: middlePx - (columnPx / 2) * cos,
})

// The band's length (along its middle) for a name this many pixels long: the gap below the name, the
// name, and a gap at the end.
const bandLengthFor = (textPx: number) => TEXT_GAP_PX + (LINE_PX / 2) * cos + textPx + END_GAP_PX

// The band's corners, from its bottom-left corner (0, 0), with "up" being negative y.
function bandCorners(middlePx: number, columnPx: number) {
  const { left, right } = bandSides(middlePx, columnPx)
  return {
    bottomLeft: [0, 0],
    topLeft: [left * cos, -left * sin],
    topRight: [columnPx + right * cos, -right * sin],
    bottomRight: [columnPx, 0],
    // Where the left neighbour's right side ends, on this band's left side.
    neighbourTop: [right * cos, -right * sin],
  }
}
const point = ([x, y]: number[]) => `${x.toFixed(1)},${y.toFixed(1)}`

// The date is tilted to ANGLE around its bottom-left corner. Tilting swings the line of text a little
// left of that corner, so the corner is pushed right by the same amount: the middle of the line then
// starts at the middle of the column, right above the checkbox, and runs up the middle of the band.
const dateStyle = (columnPx: number) => ({
  left: columnPx / 2 + (LINE_PX / 2) * Math.sin(radians(ANGLE)),
  transform: `rotate(${-ANGLE}deg)`,
  transformOrigin: 'bottom left',
  lineHeight: `${LINE_PX}px`,
})

// Whether the screen is narrow (see NARROW_SCREEN), kept up to date if it changes (like turning the phone).
function useNarrowScreen() {
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW_SCREEN).matches)
  useEffect(() => {
    const query = window.matchMedia(NARROW_SCREEN)
    const update = () => setNarrow(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return narrow
}

const ROW_PX = 44 // height of a goal row (the day buttons are h-11)

const GRIP_COLUMN_PX = 20 // a grip's column: exactly the grip's width

// Faint diagonal lines, for days in the calendar that aren't in the showing plan.
const OUTSIDE_PLAN =
  'repeating-linear-gradient(135deg, color-mix(in oklab, var(--foreground) 12%, transparent) 0 1px, transparent 1px 7px)'

const weekdayName = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })

// Saved data → the page's plans (dates counted from this week's first day; goals looked up by id). Nothing
// saved, or no plans: one empty plan for this week.
function fromStorage(data: PrototypeData | null, thisWeek: string): { library: MockGoal[]; sheets: Sheet[] } {
  const library = data?.goals ?? []
  const sheets = (data?.sheets ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    range: { first: daysBetween(thisWeek, s.start), last: daysBetween(thisWeek, s.end) },
    goals: s.goalIds.map((id) => library.find((g) => g.id === id)).filter((g): g is MockGoal => !!g),
    ticked: new Set(s.ticked),
    values: s.values,
    removedDays: new Set(s.removedDays),
  }))
  return { library, sheets: sheets.length > 0 ? sheets : [newSheet(1, 'Schedule 1', { first: 0, last: 6 })] }
}

// The page's plans → what's saved.
function toStorage(library: MockGoal[], sheets: Sheet[], thisWeek: string): PrototypeData {
  return {
    goals: library,
    sheets: sheets.map((s) => ({
      id: s.id,
      name: s.name,
      start: addDays(thisWeek, s.range.first),
      end: addDays(thisWeek, s.range.last),
      goalIds: s.goals.map((g) => g.id),
      ticked: [...s.ticked],
      values: s.values,
      removedDays: [...s.removedDays],
    })),
  }
}

// The first day of the week that contains today, using your chosen first day of the week.
function startOfWeek(today: string, weekStart: WeekStart) {
  const first = weekStart === 'monday' ? 1 : 0
  return addDays(today, -((weekdayOf(today) - first + 7) % 7))
}

// The plan as a calendar: always 7 columns (your week, from your first day), and one block per week, each
// with a date line and then a row per goal. Days the calendar shows that aren't in this plan (before it
// starts, after it ends, or in another plan) get faint diagonal lines and can't be ticked.
// Days after today are greyed out and can't be ticked. Everything is saved in this browser for now.
export function WeekTable({ today, weekStart }: { today: string; weekStart: WeekStart }) {
  // The plans (tabs along the bottom) and which one is showing. Everything below works on the showing one.
  // A day column's width: slimmer on small phones.
  const columnPx = useNarrowScreen() ? NARROW_COLUMN_PX : COLUMN_PX

  // Everything starts from what's saved in this browser. A new user has no goals and one empty plan for
  // this week.
  const thisWeek = startOfWeek(today, weekStart)
  const [saved] = useState(() => fromStorage(loadPrototype(), thisWeek))
  const [sheets, setSheets] = useState<Sheet[]>(saved.sheets)
  const [activeId, setActiveId] = useState(saved.sheets[0].id)
  const sheet = sheets.find((s) => s.id === activeId) ?? sheets[0]
  // Changes one part of the showing plan, like a useState setter (a new value, or a function of the old one).
  function sheetSetter<K extends 'goals' | 'ticked' | 'values' | 'removedDays'>(key: K) {
    return (next: Sheet[K] | ((current: Sheet[K]) => Sheet[K])) =>
      setSheets((all) =>
        all.map((s) =>
          s.id !== sheet.id
            ? s
            : { ...s, [key]: typeof next === 'function' ? (next as (current: Sheet[K]) => Sheet[K])(s[key]) : next },
        ),
      )
  }

  // Each plan has its own dates (`sheet.range`). The calendar covers all of them together, from the earliest
  // first day to the latest last day, so switching tabs never reshapes it: on each tab, the days that aren't
  // in that plan are just greyed out. In edit mode the − and + buttons at each end move the showing plan's
  // start and end.
  const range = sheet.range
  const span: Range = {
    first: Math.min(...sheets.map((s) => s.range.first)),
    last: Math.max(...sheets.map((s) => s.range.last)),
  }
  const dayAt = (offset: number) => addDays(thisWeek, offset)
  // Whether a day is in the showing plan. Every other day the calendar shows (in another plan, or just
  // filling out a week) is greyed out.
  const inPlan = (offset: number) => offset >= range.first && offset <= range.last

  // The weeks the calendar touches, each as its 7 day offsets.
  const firstWeek = Math.floor(span.first / 7)
  const lastWeek = Math.floor(span.last / 7)
  const weeks = Array.from({ length: lastWeek - firstWeek + 1 }, (_, w) =>
    Array.from({ length: 7 }, (_, i) => (firstWeek + w) * 7 + i),
  )
  const weekdays = weeks[0].map((offset) => weekdayName(dayAt(offset)))

  // One step of a − or + button: moves the showing plan's start or end by a day. A plan is always at least
  // a day long, and at most MAX_DAYS.
  const length = range.last - range.first + 1
  const can = {
    start: { minus: length < MAX_DAYS, plus: length > 1 },
    end: { minus: length > 1, plus: length < MAX_DAYS },
  }
  const stepRange = (edge: 'start' | 'end', step: 'minus' | 'plus') => {
    tipDone('length', 'remove')
    setSheets((all) =>
      all.map((s) => {
        if (s.id !== sheet.id) return s
        const { first, last } = s.range
        const by = step === 'plus' ? 1 : -1
        if (edge === 'start') {
          const next = first + by
          if (next > last || last - next + 1 > MAX_DAYS) return s
          return { ...s, range: { first: next, last } }
        }
        const next = last + by
        if (next < first || next - first + 1 > MAX_DAYS) return s
        return { ...s, range: { first, last: next } }
      }),
    )
  }

  const [dateFormat] = useState(savedDateFormat)
  const [shortDateFormat] = useState(savedShortDateFormat)
  // Short dates with a space ("19 Oct", "Oct 19") are stacked on two lines so they fit their box with
  // room to spare; the number ones ("10/19") stay on one. The date row is taller only when it needs to be.
  const shortDate = (iso: string) => formatShortDate(iso, shortDateFormat).split(' ')
  // Height: two lines of 15px (text-xs, tight) plus 8px of padding; one line still needs 32px, the gear's height.
  const weekLabelPx = shortDate(dayAt(0)).length > 1 ? 38 : 32
  const date = (iso: string) => formatDate(iso, dateFormat)
  // "Mon, 19 Oct 2026" (the date part follows your date format setting).
  const withWeekday = (iso: string) => `${weekdayName(iso)}, ${date(iso)}`

  // The bands are only as long as the longest weekday name needs. Measured after drawing (before you see
  // it), and again once the font has loaded, since that changes widths.
  const nameRefs = useRef<(HTMLSpanElement | null)[]>([])
  const [bandPx, setBandPx] = useState(bandLengthFor(30))
  useLayoutEffect(() => {
    const measure = () => {
      const longest = Math.max(...nameRefs.current.map((span) => span?.offsetWidth ?? 0))
      if (longest > 0) setBandPx(bandLengthFor(longest))
    }
    measure()
    document.fonts?.ready.then(measure)
  }, [weekStart])

  const ticked = sheet.ticked
  const setTicked = sheetSetter('ticked')
  // Recorded numbers, and the number goal + day whose box is open (null when none is).
  const values = sheet.values
  const setValues = sheetSetter('values')
  const [recording, setRecording] = useState<(Recording & { key: string }) | null>(null)
  const saveValue = (key: string, value: number | string) => setValues((current) => ({ ...current, [key]: value }))
  const clearValue = (key: string) =>
    setValues((current) => Object.fromEntries(Object.entries(current).filter(([k]) => k !== key)))

  const toggle = (key: string) =>
    setTicked((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  // Edit mode (the gear): shows the grips for changing the plan's dates, and the + for adding a goal. A plan
  // with no goals yet (like a new user's) opens straight into edit mode, ready to add one.
  const [startedEditing] = useState(() => saved.sheets[0].goals.length === 0)
  const [editing, setEditing] = useState(startedEditing)
  // Right after your very first goal, a short tour of edit mode, one tip at a time: changing the plan's
  // dates, taking days off, the plan tabs, then the gear to finish. Each tip moves on when you do the thing it shows (or
  // tap Next). See TipBanner.
  const [tip, setTip] = useState<Tip | null>(null)
  const tipDone = (done: Tip, next: Tip | null) => setTip((current) => (current === done ? next : current))

  // The goals in this plan. The + opens the Add a goal box.
  const goals = sheet.goals
  const setGoals = sheetSetter('goals')
  const [addingGoal, setAddingGoal] = useState(false)

  // All of "your goals": every goal you've made, whichever plans it's in (or none, after being removed).
  // A goal is the same goal in every plan it's added to; each plan keeps its own ticks for it.
  const [library, setLibrary] = useState<MockGoal[]>(saved.library)

  // Every change is saved straight away, so a refresh (or the Goals page) sees it.
  useEffect(() => savePrototype(toStorage(library, sheets, thisWeek)), [library, sheets, thisWeek])
  const notInThisPlan = library.filter((g) => !goals.some((inPlan) => inPlan.id === g.id))
  // Adds some of your goals to the end of this plan.
  const addExistingGoals = (ids: number[]) =>
    setGoals((current) => [
      ...current,
      ...library.filter((g) => ids.includes(g.id) && !current.some((c) => c.id === g.id)),
    ])
  // Makes a new goal, keeps it in your goals, and adds it to the end of this plan.
  const createGoal = (newGoal: NewGoal) => {
    const goal: MockGoal = { id: Math.max(0, ...library.map((g) => g.id)) + 1, ...newGoal }
    setLibrary((all) => [...all, goal])
    setGoals((current) => [...current, goal])
    // Your first goal ever: start the tour.
    if (library.length === 0) setTip('length')
  }

  // Which goal name (in which week) or day cell has its hidden button slid out; only one at a time.
  const [revealed, setRevealed] = useState<string | null>(null)

  // Goal-days taken off the plan ("goalId|date"). Lined like days outside the plan, and can't be ticked;
  // any tick is kept, hidden, in case the day is put back.
  const removedDays = sheet.removedDays
  const setRemovedDays = sheetSetter('removedDays')
  const setDayRemoved = (key: string, removed: boolean) => {
    if (removed) tipDone('remove', 'tabs')
    setRemovedDays((current) => {
      const next = new Set(current)
      if (removed) next.add(key)
      else next.delete(key)
      return next
    })
  }

  // Removing: the goal and its ticks go (from every week).
  const removeGoal = (id: number) => {
    setGoals((current) => current.filter((g) => g.id !== id))
    setTicked((current) => new Set([...current].filter((key) => !key.startsWith(`${id}|`))))
    setValues((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${id}|`))))
    setRevealed(null)
  }

  // Puts the goal at `from` into spot `to` (everything in between shifts by one).
  const moveGoal = (from: number, to: number) =>
    setGoals((current) => {
      const order = [...current]
      const [moved] = order.splice(from, 1)
      order.splice(to, 0, moved)
      return order
    })

  // Dragging a goal up or down. Nothing is reordered while you drag: the grabbed goal's rows follow your
  // finger (`offsetPx`), and the goals between where it was and where it would land slide one row out of
  // its way to open a gap. When you let go, it glides into the gap ("settling"), and only then is the
  // order really changed, at which point every row snaps back to no offset, so you don't see a jump.
  type Drag = { id: number; from: number; offsetPx: number; settling: boolean }
  const [drag, setDrag] = useState<Drag | null>(null)
  const movingGoal = drag?.id ?? null
  const SETTLE_MS = 150 // the glide into place; matches duration-150 on the rows
  // The spot the goal would land in if you let go now.
  const landingSpot = (d: Drag) => Math.min(goals.length - 1, Math.max(0, d.from + Math.round(d.offsetPx / ROW_PX)))
  const startDrag = (id: number, from: number) => {
    setDrag({ id, from, offsetPx: 0, settling: false })
    setRevealed(null)
  }
  const moveDrag = (offsetPx: number) =>
    setDrag((d) => {
      if (!d) return d
      // It can float from the top goal's row down to the bottom goal's row of its week, no further.
      const limit = { up: -d.from * ROW_PX, down: (goals.length - 1 - d.from) * ROW_PX }
      return { ...d, offsetPx: Math.min(limit.down, Math.max(limit.up, offsetPx)) }
    })
  const endDrag = () => {
    if (!drag) return
    const to = landingSpot(drag)
    setDrag({ ...drag, offsetPx: (to - drag.from) * ROW_PX, settling: true })
    setTimeout(() => {
      moveGoal(drag.from, to)
      setDrag(null)
    }, SETTLE_MS)
  }
  // How far a goal's rows are shifted right now, and whether that shift should glide.
  const rowShift = (index: number): { px: number; glide: boolean } => {
    if (!drag) return { px: 0, glide: false }
    if (index === drag.from) return { px: drag.offsetPx, glide: drag.settling }
    const to = landingSpot(drag)
    if (drag.from < index && index <= to) return { px: -ROW_PX, glide: true }
    if (to <= index && index < drag.from) return { px: ROW_PX, glide: true }
    return { px: 0, glide: true }
  }

  // Editing is a draft. Starting edit mode remembers how everything was; pressing the gear again asks to
  // save (keep it) or discard (put it all back) — but only if something actually changed.
  type Snapshot = { sheets: Sheet[]; library: MockGoal[]; activeId: number }
  const beforeEditing = useRef<Snapshot | null>(
    startedEditing ? { sheets: saved.sheets, library: saved.library, activeId: saved.sheets[0].id } : null,
  )
  const [askingToSave, setAskingToSave] = useState(false)
  // A plain description of everything edit mode can change, for spotting whether anything did.
  const describe = (snap: Omit<Snapshot, 'activeId'>) =>
    JSON.stringify({
      library: snap.library.map((g) => [g.id, g.name]),
      sheets: snap.sheets.map((s) => ({
        id: s.id,
        name: s.name,
        range: s.range,
        goals: s.goals.map((g) => g.id),
        removed: [...s.removedDays].sort(),
        values: Object.entries(s.values).sort(),
        ticked: [...s.ticked].sort(),
      })),
    })
  const startEditing = () => {
    beforeEditing.current = { sheets, library, activeId }
    setEditing(true)
  }
  const stopEditing = () => {
    setAskingToSave(false)
    setDrag(null)
    setRevealed(null)
    setEditing(false)
    setTip(null)
    beforeEditing.current = null
  }
  // A plan that had no goals when editing started (like a new user's) just saves: there was nothing to lose.
  const finishEditing = () => {
    const before = beforeEditing.current
    const startedEmpty = before?.sheets.find((s) => s.id === activeId)?.goals.length === 0
    if (before && !startedEmpty && describe(before) !== describe({ sheets, library })) setAskingToSave(true)
    else stopEditing()
  }
  const discardChanges = () => {
    const before = beforeEditing.current
    if (before) {
      setSheets(before.sheets)
      setLibrary(before.library)
      setActiveId(before.sheets.some((s) => s.id === activeId) ? activeId : before.activeId)
    }
    stopEditing()
  }

  // The grips show in edit mode, except while a goal is being dragged up or down: then they fade out
  // (quickly, so they don't lag behind your finger) to leave a clear view, and fade back when you let go.
  const gripsShown = editing && movingGoal === null
  const gripFade = `transition-[opacity,visibility] ease-in-out motion-reduce:transition-none ${movingGoal === null ? 'duration-500' : 'duration-200'} ${gripsShown ? 'visible opacity-100' : 'invisible opacity-0'}`

  // Every week has room for as many goals as the plan with the most (at least one), so all the tabs are
  // the same shape. A plan with fewer goals has empty slots after its goals, lined like days outside the
  // plan; adding a goal fills the next slot.
  const rowsPerWeek = Math.max(1, ...sheets.map((s) => s.goals.length))
  const emptySlots = rowsPerWeek - goals.length
  const weekPx = weekLabelPx + rowsPerWeek * ROW_PX
  // The header row is as tall as the bands' highest corner (the top of the longer, left side), and the
  // last band's top leans past the grid's right edge by this much.
  const headerPx = Math.ceil(bandSides(bandPx, columnPx).left * sin)
  const overhangPx = Math.ceil(bandSides(bandPx, columnPx).right * cos)
  const corners = bandCorners(bandPx, columnPx)
  // Fill: the whole band. Outline: every edge except the bottom (no line between the names and the grid).
  // Neighbouring bands share a side, so after the first band, each one only draws the part of its left
  // side that rises above its neighbour, so no line is drawn twice.
  const bandFill = [corners.bottomLeft, corners.topLeft, corners.topRight, corners.bottomRight].map(point).join(' ')
  const bandOutline = (column: number) =>
    `M ${point(column === 0 ? corners.bottomLeft : corners.neighbourTop)} L ${point(corners.topLeft)} L ${point(corners.topRight)} L ${point(corners.bottomRight)}`
  // Rows per week: the date row, then a row per goal or empty slot.
  const bodyRows = weeks.length * (1 + rowsPerWeek)

  const switchSheet = (id: number) => {
    setDrag(null)
    setRevealed(null)
    setActiveId(id)
  }
  // A new, empty plan ("Schedule 2", "Schedule 3"…), shown straight away. Five at most.
  const addSheet = () => {
    if (sheets.length >= MAX_SHEETS) return
    tipDone('tabs', 'save')
    const id = Math.max(...sheets.map((s) => s.id)) + 1
    // It starts with the same dates as the plan that's showing.
    setSheets((all) => [...all, newSheet(id, nextSheetName(all), { ...range })])
    switchSheet(id)
  }
  // Deletes a plan (never the last one). If it was showing, the plan beside it is shown instead.
  const removeSheet = (id: number) => {
    if (sheets.length <= 1) return
    const index = sheets.findIndex((s) => s.id === id)
    const remaining = sheets.filter((s) => s.id !== id)
    setSheets(remaining)
    if (id === sheet.id) switchSheet(remaining[Math.min(index, remaining.length - 1)].id)
  }
  // The day the "take a day off" tip points at: the first goal's first day (still in the plan).
  const tipDay =
    tip === 'remove' && goals.length > 0
      ? Array.from({ length: range.last - range.first + 1 }, (_, i) => `${goals[0].id}|${dayAt(range.first + i)}`).find(
          (key) => !removedDays.has(key),
        )
      : undefined

  const grip = (edge: 'start' | 'end') => (
    <RangeButtons
      edge={edge}
      onStep={(step) => stepRange(edge, step)}
      canMinus={can[edge].minus}
      canPlus={can[edge].plus}
      highlight={tip === 'length'}
      // The whole grid, empty slots included.
      heightPx={weeks.length * weekPx}
    />
  )

  return (
    // Centred across the page (mx-auto: equal space either side), so it sits in the middle on any phone.
    // Extra room on the right, exactly as much as the last band leans past the edge of its column. The end
    // grip's column sits inside that room, so having it there (even invisible) doesn't make the table wider.
    <div
      className="mx-auto max-w-full overflow-x-auto"
      style={{ paddingRight: Math.max(0, overhangPx - GRIP_COLUMN_PX) }}
    >
      <table className="border-collapse">
        <thead>
          {/* The title, centred over the day columns. It floats over its row, so it never widens the columns. */}
          <tr>
            <td />
            <td />
            <th colSpan={7} className="relative h-10 p-0">
              <h2 className="absolute bottom-2 left-1/2 -translate-x-1/2 text-base font-semibold whitespace-nowrap">
                Habits for {date(dayAt(range.first))} – {date(dayAt(range.last))}
              </h2>
            </th>
          </tr>
          <tr>
            {/* The corner above the goal names (the gear is just below, on the first date row). It holds the
                goal-name column at its full width (the same as a goal name's, in GoalNameCell), so a plan with no
                goals doesn't make that column shrink and the grid shift sideways when switching tabs. */}
            <th className="p-0">
              <span className="sr-only">Habits</span>
              <div aria-hidden="true" className="w-20 max-[399px]:w-16 [@media(hover:hover)]:w-32" />
            </th>
            <th aria-hidden="true" className="p-0">
              <GripColumn fade={gripFade} />
            </th>
            {weekdays.map((name, column) => (
              <th
                key={name}
                scope="col"
                className="relative p-0 align-bottom font-normal"
                style={{ height: headerPx, width: columnPx, minWidth: columnPx }}
              >
                {/* A 1×1 drawing pinned to the header's bottom-left corner; the band spills out of it upward. */}
                <svg aria-hidden="true" width="1" height="1" className="absolute bottom-0 left-0 overflow-visible">
                  <polygon points={bandFill} className={column % 2 === 0 ? 'fill-column-1' : 'fill-column-2'} />
                  <path d={bandOutline(column)} className="fill-none stroke-foreground/25" />
                </svg>
                <span
                  ref={(span) => {
                    nameRefs.current[column] = span
                  }}
                  className="absolute text-sm whitespace-nowrap"
                  style={{ ...dateStyle(columnPx), bottom: TEXT_GAP_PX }}
                >
                  {name}
                </span>
              </th>
            ))}
            {/* Keeps the header lined up with the end grip's column below. */}
            <th aria-hidden="true" className="p-0" style={{ width: GRIP_COLUMN_PX, minWidth: GRIP_COLUMN_PX }} />
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, w) => [
            // The week's date line: each day's date over its column (no year), blank for days outside the plan.
            // The very first one also holds the two grips, which reach down through every row of every week.
            // (The start grip's column and grip are explained just below.)
            // Rows are named by position (first week, second week…), not by date. The grips live in the first
            // row, and a dated name would change when weeks are added at the start, making React rebuild the row
            // (and the grip you're holding) mid-drag.
            <tr key={`week-${w}`}>
              {/* The first week's date row has the gear that starts editing the plan, at the left. */}
              <td className="p-0 pl-1 align-middle">
                {w === 0 && (
                  <button
                    type="button"
                    aria-label="Edit schedule"
                    aria-pressed={editing}
                    onClick={() => (editing ? finishEditing() : startEditing())}
                    className={`rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground ${editing ? 'bg-accent text-foreground' : ''} ${tip === 'save' ? 'ring-2 ring-primary' : ''}`}
                  >
                    {/* Turns 160° when editing starts and stays there; turns back when editing ends. */}
                    <Settings
                      aria-hidden="true"
                      className={`size-5 transition-transform duration-500 ease-in-out motion-reduce:transition-none ${editing ? 'rotate-[160deg]' : 'rotate-0'}`}
                    />
                  </button>
                )}
                {/* The tour's last tip: an arrow at the gear. */}
                {w === 0 && tip === 'save' && (
                  <ArrowLeft
                    aria-hidden="true"
                    className="ml-1 inline size-4 animate-nudge-left align-middle motion-reduce:animate-none"
                  />
                )}
              </td>
              {/* The start grip's column. Every row has its own (empty) cell here, so each goal's stripe runs
                  right through to the grid. The grip itself sits in the first one and is laid on top of the
                  column, reaching down through every row of every week. */}
              <td className="relative p-0">
                {w === 0 && (
                  <div aria-hidden={!gripsShown} className="absolute top-0 left-0 z-10">
                    <GripColumn fade={gripFade}>{grip('start')}</GripColumn>
                  </div>
                )}
              </td>
              {week.map((offset, column) => (
                <td
                  key={offset}
                  // Days in the plan get a box around their date, in their column's colour, joining the
                  // column lines below.
                  className={`px-0.5 py-1 text-center align-middle text-xs leading-tight whitespace-nowrap text-muted-foreground ${inPlan(offset) ? `border border-foreground/25 ${columnTint(column)}` : 'opacity-40'}`}
                  style={{ height: weekLabelPx }}
                >
                  {shortDate(dayAt(offset)).map((part) => (
                    <span key={part} className="block">
                      {part}
                    </span>
                  ))}
                </td>
              ))}
              {w === 0 && (
                <td
                  rowSpan={bodyRows}
                  aria-hidden={!gripsShown}
                  className={`bg-background p-0 align-middle ${gripFade}`}
                >
                  {grip('end')}
                </td>
              )}
            </tr>,
            // Then a row per goal. The row's tint sits behind the whole row; each day lays its column's tint on top.
            ...goals.map((goal, row) => (
              // While a goal is dragged, its rows float (on top, with a shadow) and the others glide out of its
              // way: see "Dragging a goal" above. The goal being moved is framed in every week.
              <tr
                key={`week-${w}-row-${row}`}
                className={`${rowTint(row)} ${rowShift(row).glide ? 'transition-transform duration-150 ease-out motion-reduce:transition-none' : ''} ${movingGoal === goal.id ? 'relative z-20 drop-shadow-lg' : ''}`}
                style={{
                  transform: drag ? `translateY(${rowShift(row).px}px)` : undefined,
                  // The floating goal gets a solid base under its stripe (the stripes are see-through), so it
                  // covers the rows it passes over instead of showing them through.
                  background:
                    movingGoal === goal.id
                      ? `linear-gradient(${stripeColor(row)}, ${stripeColor(row)}), var(--background)`
                      : undefined,
                }}
              >
                <GoalNameCell
                  name={goal.name}
                  tintClass={rowTint(row)}
                  framed={movingGoal === goal.id}
                  reordering={movingGoal !== null}
                  editing={editing}
                  index={row}
                  count={goals.length}
                  revealed={revealed === `${w}-${goal.id}`}
                  onReveal={(shown) => setRevealed(shown ? `${w}-${goal.id}` : null)}
                  onDragStart={() => startDrag(goal.id, row)}
                  onDragMove={moveDrag}
                  onDragEnd={endDrag}
                  onMove={(to) => moveGoal(row, to)}
                  onRemove={() => removeGoal(goal.id)}
                />
                {/* The start grip's column (the grip lies on top of it): takes the row's stripe. */}
                <td className="p-0" style={{ boxShadow: movingGoal === goal.id ? frameEdges({}) : undefined }} />
                {week.map((offset, column) => {
                  const day = dayAt(offset)
                  const frame = movingGoal === goal.id ? frameEdges({ right: column === 6 }) : undefined
                  // The grid's bottom edge: a line under the last goal of the last week (unless empty grid space
                  // follows, which then carries the line instead). Not under days outside the plan's dates.
                  const bottomEdge =
                    w === weeks.length - 1 && row === goals.length - 1 && emptySlots === 0
                      ? 'border-b border-b-foreground/25'
                      : ''
                  // Not in this plan (another plan's day, or just filling out the week): faint diagonal lines (the same as a
                  // removed day), and nothing to tap.
                  if (!inPlan(offset))
                    return (
                      <td
                        key={day}
                        aria-hidden="true"
                        className="bg-background p-0"
                        style={{ height: ROW_PX, boxShadow: frame, backgroundImage: OUTSIDE_PLAN }}
                      />
                    )
                  const key = `${goal.id}|${day}`
                  const removed = removedDays.has(key)
                  return (
                    <DayCell
                      key={day}
                      label={`${goal.name}, ${withWeekday(day)}`}
                      editing={editing}
                      shows={
                        goal.kind === 'number'
                          ? typeof values[key] === 'number'
                            ? shortNumber(values[key])
                            : ''
                          : goal.kind === 'choice'
                            ? String(values[key] ?? '')
                            : ticked.has(key)
                              ? (goal.kind === 'toggle' && goal.mark) || '✓'
                              : ''
                      }
                      future={day > today}
                      removed={removed}
                      widthPx={columnPx}
                      // A removed day gets the same faint diagonal lines as days outside the plan.
                      surface={removed ? `${OUTSIDE_PLAN}, var(--background)` : cellSurface(row, column)}
                      className={`${bottomEdge} ${key === tipDay ? 'animate-pulse outline-2 -outline-offset-2 outline-primary' : ''} ${
                        removed
                          ? 'bg-background'
                          : `${columnTint(column)} ${lines(column, column === 0 || !inPlan(offset - 1) || removedDays.has(`${goal.id}|${dayAt(offset - 1)}`))}`
                      }`}
                      style={{ boxShadow: frame, backgroundImage: removed ? OUTSIDE_PLAN : undefined }}
                      revealed={revealed === `cell-${key}`}
                      onReveal={(shown) => setRevealed(shown ? `cell-${key}` : null)}
                      onTap={() =>
                        goal.kind === 'number'
                          ? setRecording({
                              key,
                              kind: 'number',
                              goalName: goal.name,
                              dayLabel: withWeekday(day),
                              settings: goal.number,
                              value: typeof values[key] === 'number' ? values[key] : undefined,
                            })
                          : goal.kind === 'choice'
                            ? setRecording({
                                key,
                                kind: 'choice',
                                goalName: goal.name,
                                dayLabel: withWeekday(day),
                                settings: goal.choice,
                                value: typeof values[key] === 'string' ? values[key] : undefined,
                              })
                            : toggle(key)
                      }
                      onRemove={() => setDayRemoved(key, true)}
                      onRestore={() => setDayRemoved(key, false)}
                    />
                  )
                })}
              </tr>
            )),
            // Then the empty slots (if this plan has fewer goals than the plan with the most): a blank name and
            // lined days, exactly a goal row's height.
            ...Array.from({ length: emptySlots }, (_, slot) => (
              <tr key={`week-${w}-slot-${slot}`} aria-hidden="true">
                <td className="p-0" />
                <td className="p-0" />
                {week.map((offset) => (
                  <td
                    key={offset}
                    className="bg-background p-0"
                    style={{ height: ROW_PX, backgroundImage: OUTSIDE_PLAN }}
                  />
                ))}
              </tr>
            )),
          ])}
          {/* Right under the grid: the + that adds a goal (under the goal names) and the plan tabs (starting
              under the first day). The + fades in and out with edit mode, like the grips. The tabs (stacked like
              cards) get exactly the width of the day columns plus the end grip, so they never widen the grid. */}
          <tr>
            <td className="p-0 pl-1 align-top">
              <button
                type="button"
                aria-label="Add habit"
                aria-hidden={!editing}
                tabIndex={editing ? 0 : -1}
                onClick={() => setAddingGoal(true)}
                className={`rounded-md p-1.5 text-muted-foreground transition-[opacity,visibility] duration-500 ease-in-out hover:bg-accent hover:text-foreground motion-reduce:transition-none ${editing ? 'visible opacity-100' : 'invisible opacity-0'}`}
              >
                <Plus aria-hidden="true" className="size-5" />
              </button>
              {/* An empty plan in edit mode: a bouncing arrow pointing at the +, to get you started. */}
              {editing && goals.length === 0 && !addingGoal && (
                <p className="flex flex-col items-start gap-0.5 pl-1.5 text-xs font-medium">
                  <ArrowUp aria-hidden="true" className="size-4 animate-bounce motion-reduce:animate-none" />
                  {library.length === 0 ? 'Add your first habit' : 'Add a habit'}
                </p>
              )}
            </td>
            <td />
            <td colSpan={8} className="p-0 align-top">
              {/* (Outlined and pulsing during the tour's tip about plans.) */}
              <div
                style={{ width: 7 * columnPx + GRIP_COLUMN_PX }}
                className={tip === 'tabs' ? 'animate-pulse rounded-md ring-2 ring-primary' : ''}
              >
                <SheetTabs
                  sheets={sheets}
                  activeId={sheet.id}
                  editing={editing}
                  onSelect={switchSheet}
                  onRename={(id, name) => setSheets((all) => all.map((s) => (s.id === id ? { ...s, name } : s)))}
                  onAdd={addSheet}
                  onRemove={removeSheet}
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      {tip && editing && (
        <TipBanner
          tip={tip}
          onNext={() =>
            setTip(tip === 'length' ? 'remove' : tip === 'remove' ? 'tabs' : tip === 'tabs' ? 'save' : null)
          }
          onSkip={() => setTip(null)}
        />
      )}
      <RecordDialog
        recording={recording}
        onSave={(value) => recording && saveValue(recording.key, value)}
        onClear={() => recording && clearValue(recording.key)}
        onClose={() => setRecording(null)}
      />
      <SaveChangesDialog
        open={askingToSave}
        onSave={stopEditing}
        onDiscard={discardChanges}
        onKeepEditing={() => setAskingToSave(false)}
      />
      <GoalDialog
        open={addingGoal}
        onClose={() => setAddingGoal(false)}
        // No Existing tab until you've made a goal; and your very first goal gets walked through.
        available={library.length > 0 ? notInThisPlan : undefined}
        onAddExisting={library.length > 0 ? addExistingGoals : undefined}
        onCreate={createGoal}
        firstGoal={library.length === 0}
      />
    </div>
  )
}

// The start grip's column. Its room is always there, so the grid never moves; only the grip fades in and
// out (`fade`: the same fade the end grip uses). While hidden it can't be clicked or reached with Tab.
function GripColumn({ fade, children }: { fade: string; children?: ReactNode }) {
  return (
    <div className={`flex justify-center ${fade}`} style={{ width: GRIP_COLUMN_PX }}>
      {children}
    </div>
  )
}
