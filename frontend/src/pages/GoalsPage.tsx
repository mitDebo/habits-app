import { useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { describeGoal, loadPrototype, savePrototype, type MockGoal, type PrototypeData } from '@/prototype/storage'
import { GoalDialog } from '@/week/GoalDialog'
import type { NewGoal } from '@/week/goalKinds'

const corners = 'rounded-[5px]'

// Your goals (prototype: saved in this browser, shared with the week grid). Each shows its kind and settings
// and which plans it's in. New goal opens the same Add a goal box as the grid (just the New tabs); a goal
// made here isn't in any plan until you add it to one from the grid's edit mode.
export function GoalsPage() {
  const [data, setData] = useState<PrototypeData>(() => loadPrototype() ?? { goals: [], sheets: [] })
  const [adding, setAdding] = useState(false)
  // The habit open in the Edit habit box (null when none is).
  const [editing, setEditing] = useState<MockGoal | null>(null)
  // The goal whose Delete is waiting for a "yes" (null when none is).
  const [confirming, setConfirming] = useState<number | null>(null)

  // Every change is saved straight away.
  useEffect(() => savePrototype(data), [data])

  const create = (newGoal: NewGoal) =>
    setData((d) => ({ ...d, goals: [...d.goals, { id: Math.max(0, ...d.goals.map((g) => g.id)) + 1, ...newGoal }] }))

  // Saving an edit: the habit keeps its id (so its schedules and records stay with it) and its kind (the box
  // only offers that kind); everything else is replaced by what was saved.
  const saveEdit = (changed: NewGoal) => {
    if (!editing || changed.kind !== editing.kind) return
    setData((d) => ({ ...d, goals: d.goals.map((g) => (g.id === editing.id ? { ...changed, id: g.id } : g)) }))
  }

  // Deleting a goal takes it out of every plan too, along with everything recorded for it.
  const remove = (id: number) => {
    const notThisGoal = (key: string) => !key.startsWith(`${id}|`)
    setData((d) => ({
      goals: d.goals.filter((g) => g.id !== id),
      sheets: d.sheets.map((s) => ({
        ...s,
        goalIds: s.goalIds.filter((g) => g !== id),
        ticked: s.ticked.filter(notThisGoal),
        removedDays: s.removedDays.filter(notThisGoal),
        values: Object.fromEntries(Object.entries(s.values).filter(([key]) => notThisGoal(key))),
      })),
    }))
    setConfirming(null)
  }

  const plansWith = (goal: MockGoal) => data.sheets.filter((s) => s.goalIds.includes(goal.id)).map((s) => s.name)

  return (
    <section className="flex max-w-xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Your habits</h2>
        <Button className={corners} onClick={() => setAdding(true)}>
          <Plus aria-hidden="true" className="size-4" />
          New habit
        </Button>
      </div>

      {data.goals.length === 0 ? (
        <p className="text-base text-muted-foreground">
          No habits yet. Make one here with New habit, or from the week grid's edit mode (the gear, then +).
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-md border">
          {data.goals.map((goal) => {
            const plans = plansWith(goal)
            return (
              <li key={goal.id} className="flex items-center gap-3 px-3 py-2">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium [overflow-wrap:anywhere]">{goal.name}</span>
                  <span className="text-sm text-muted-foreground">{describeGoal(goal)}</span>
                  <span className="text-xs text-muted-foreground italic">
                    {plans.length > 0 ? `In ${plans.join(', ')}` : 'Not in any schedule'}
                  </span>
                </div>
                {confirming === goal.id ? (
                  // Asks first: deleting also takes it out of its plans, with everything recorded for it.
                  <div className="flex items-center gap-2 text-sm">
                    <span>{plans.length > 0 ? 'Delete it and its records?' : 'Delete?'}</span>
                    <Button size="sm" variant="destructive" className={corners} onClick={() => remove(goal.id)}>
                      Delete
                    </Button>
                    <Button size="sm" variant="outline" className={corners} onClick={() => setConfirming(null)}>
                      Keep
                    </Button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      aria-label={`Edit ${goal.name}`}
                      onClick={() => setEditing(goal)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <Pencil aria-hidden="true" className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${goal.name}`}
                      onClick={() => setConfirming(goal.id)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive hover:text-white"
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                    </button>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <GoalDialog open={adding} onClose={() => setAdding(false)} onCreate={create} />
      {/* Keyed by the habit, so it starts fresh with that habit's settings each time. */}
      <GoalDialog
        key={editing?.id ?? 'none'}
        open={editing !== null}
        onClose={() => setEditing(null)}
        onCreate={saveEdit}
        edit={editing ?? undefined}
      />
    </section>
  )
}
