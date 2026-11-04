import { useState } from 'react'
import type { NewGoal } from '@/week/goalKinds'
import { shortNumber } from '@/week/numbers'
import { RecordDialog, type Recording } from '@/week/RecordDialog'

// A few days of the week, as in the real grid.
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

// An example habit, and what's recorded on some of its days to start with (by day: 0 = Mon … 4 = Fri).
// For a toggle, a day that's in `filled` is ticked.
export type Example = { habit: NewGoal; filled: Record<number, number | string | true> }

// Stripes like the grid's: rows and day columns alternate, and the two tints add up where they cross.
const rowTint = (row: number) => (row % 2 === 0 ? 'bg-row-1' : 'bg-row-2')
const columnTint = (column: number) => (column % 2 === 0 ? 'bg-column-1' : 'bg-column-2')

// A small piece of the week grid with example habits, to try out: tap a toggle's day to tick it, or a number
// or choice habit's day to open the same box the real grid uses. Nothing is saved: a refresh starts over.
export function ExampleRows({ examples }: { examples: Example[] }) {
  // What's recorded, by "row|day".
  const [values, setValues] = useState<Record<string, number | string | true>>(() =>
    Object.fromEntries(
      examples.flatMap((example, row) => Object.entries(example.filled).map(([day, v]) => [`${row}|${day}`, v])),
    ),
  )
  const [recording, setRecording] = useState<(Recording & { key: string }) | null>(null)

  const set = (key: string, value: number | string | true | undefined) =>
    setValues((all) => {
      const next = { ...all }
      if (value === undefined) delete next[key]
      else next[key] = value
      return next
    })

  const tap = (row: number, day: number) => {
    const { habit } = examples[row]
    const key = `${row}|${day}`
    const value = values[key]
    if (habit.kind === 'toggle') return set(key, value ? undefined : true)
    const common = { key, goalName: habit.name, dayLabel: DAYS[day] }
    if (habit.kind === 'number')
      setRecording({
        ...common,
        kind: 'number',
        settings: habit.number,
        value: typeof value === 'number' ? value : undefined,
      })
    else
      setRecording({
        ...common,
        kind: 'choice',
        settings: habit.choice,
        value: typeof value === 'string' ? value : undefined,
      })
  }

  // What a day shows: the mark, the number (shortened), or the emoji.
  const shows = (habit: NewGoal, value: number | string | true | undefined) => {
    if (value === undefined) return ''
    if (habit.kind === 'toggle') return habit.mark ?? '✓'
    return typeof value === 'number' ? shortNumber(value) : String(value)
  }

  return (
    <>
      <table className="border-collapse">
        <thead>
          <tr>
            <td />
            {DAYS.map((day, column) => (
              <th
                key={day}
                scope="col"
                className={`h-7 w-[38px] border border-foreground/25 text-xs font-normal text-muted-foreground ${columnTint(column)}`}
              >
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {examples.map(({ habit }, row) => (
            <tr key={habit.name} className={rowTint(row)}>
              <th scope="row" className="w-28 px-2 text-left text-sm leading-tight font-medium">
                {habit.name}
              </th>
              {DAYS.map((day, column) => {
                const content = shows(habit, values[`${row}|${column}`])
                return (
                  <td
                    key={day}
                    className={`border-r border-foreground/25 p-0 ${column === 0 ? 'border-l' : ''} ${row === examples.length - 1 ? 'border-b' : ''} ${columnTint(column)}`}
                  >
                    <button
                      type="button"
                      aria-label={`${habit.name}, ${day}${content ? `: ${content}` : ''}`}
                      onClick={() => tap(row, column)}
                      className={`flex h-11 w-[38px] cursor-pointer items-center justify-center hover:bg-foreground/10 ${[...new Intl.Segmenter().segment(content)].length <= 2 ? 'text-xl font-bold' : 'text-sm font-semibold'}`}
                    >
                      {content}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <RecordDialog
        recording={recording}
        onSave={(value) => recording && set(recording.key, value)}
        onClear={() => recording && set(recording.key, undefined)}
        onClose={() => setRecording(null)}
      />
    </>
  )
}
