import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { firstEmoji } from '@/week/emoji'
import { ChoicePreview, NumberPreview, TogglePreview } from '@/week/GoalPreview'
import { EmojiPicker } from '@/week/widgets/EmojiPicker'
import type { ChoiceSettings, NewGoal, NumberSettings, ToggleMark } from '@/week/goalKinds'

// Same corners as the login box's buttons and field.
const corners = 'rounded-[5px]'

// Longest goal name allowed (it has to fit two short lines in the grid on a phone).
export const MAX_GOAL_NAME = 15
const MAX_SHORT_TEXT = 15 // units and end labels
const MAX_OPTION = 20

// Text and number boxes: white in both light and dark mode, like the login box's email field.
const field = `${corners} w-full border border-gray-300 bg-white px-2 py-1.5 text-gray-900 [color-scheme:light]`

export type GoalChoice = { id: number; name: string }

type Props = {
  open: boolean
  onClose: () => void
  // The user's goals that aren't in this plan yet. Leave both out (like on the Goals page) for a box that
  // only makes new goals: no Existing tab.
  available?: GoalChoice[]
  onAddExisting?: (ids: number[]) => void
  onCreate: (goal: NewGoal) => void
  // Your very first goal: the box walks you through it (see GoalPicker).
  firstGoal?: boolean
  // Editing an existing habit instead of making one: its settings are filled in, and only its own kind's
  // tab is there (a habit's kind is set when it's made and can't change). Saving calls onCreate with the
  // new settings.
  edit?: NewGoal
}

// A box that pops up over the page (which goes dark behind it) for adding goals to the plan. Close it
// with Cancel, Esc, or by clicking the dark area. Like the login box, it uses the browser's own <dialog>.
export function GoalDialog({ open, onClose, available, onAddExisting, onCreate, firstGoal, edit }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const box = dialog.current
    if (!box) return
    if (open && !box.open) box.showModal()
    if (!open && box.open) box.close()
  }, [open])

  return (
    <dialog
      ref={dialog}
      aria-labelledby="goal-dialog-title"
      onClose={onClose}
      onClick={(event) => event.target === dialog.current && onClose()}
      className="m-auto w-[calc(100%-1.5rem)] max-w-md overflow-hidden rounded-xl sm:max-w-2xl border bg-popover p-0 text-popover-foreground shadow-xl backdrop:bg-black/60"
    >
      {/* Only drawn while open, so it starts fresh each time. */}
      {open && (
        <GoalPicker
          available={available}
          onClose={onClose}
          onAddExisting={onAddExisting}
          onCreate={onCreate}
          firstGoal={firstGoal}
          edit={edit}
        />
      )}
    </dialog>
  )
}

type Tab = 'existing' | 'toggle' | 'number' | 'choice'
// Plus, for your first goal, a welcome page shown before any tab is picked.
type Page = Tab | 'welcome'
// The tabs, in two groups with a small heading each: "Existing" (Goals) and "New" (Toggle, Number, Choice).
const tabs: { id: Tab; label: string; group: string }[] = [
  { id: 'existing', label: 'Habits', group: 'Existing' },
  { id: 'toggle', label: 'Toggle', group: 'New' },
  { id: 'number', label: 'Number', group: 'New' },
  { id: 'choice', label: 'Choice', group: 'New' },
]

// Tabs down the left; the selected tab's page on the right.
// - Your goals: choose one of your goals that isn't in this plan yet from the dropdown, then Add.
// - New toggle: a yes/no goal; it only needs a name.
// - New number: an amount (pages, km) or a score on a scale (1–10), with optional unit, bounds, end labels
//   and step.
// - New choice: pick one of your own options each day; each option is an emoji, with an optional name.
// The New tabs create the goal (it joins your goals) and add it to the plan.
//
// Your first goal (`firstGoal`) is walked through, one nudge at a time: a welcome page with an arrow at the
// Toggle tab; then, on the Toggle tab, a nudge to type a name; then one at the New button to save it.
function GoalPicker({ available, onClose, onAddExisting, onCreate, firstGoal = false, edit }: Omit<Props, 'open'>) {
  // Start on "Your goals", unless there's nothing left there to add (or on the welcome page, the first time).
  // (Editing: straight to the habit's own kind.)
  const [tab, setTab] = useState<Page>(
    edit ? edit.kind : firstGoal ? 'welcome' : available && available.length > 0 ? 'existing' : 'toggle',
  )
  // Without `available`, only the New tabs. Editing: only the habit's own kind, under a "Type" heading.
  const shownTabs = edit
    ? tabs.filter((t) => t.id === edit.kind).map((t) => ({ ...t, group: 'Type' }))
    : available
      ? tabs
      : tabs.filter((t) => t.group === 'New')
  const submitLabel = edit ? 'Save' : 'New'

  // When a page is shown (and when the box opens), put the cursor in its first box.
  const pages = useRef<Partial<Record<Page, HTMLDivElement | null>>>({})
  // (Waits a frame, so the box has finished opening first; opening it would otherwise put the cursor on
  // the first tab.)
  useEffect(() => {
    const frame = requestAnimationFrame(() => pages.current[tab]?.querySelector<HTMLElement>('input, select')?.focus())
    return () => cancelAnimationFrame(frame)
  }, [tab])

  return (
    <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
      {/* The banner across the top. */}
      <h2 id="goal-dialog-title" className="border-b bg-header px-5 py-3 text-xl font-semibold">
        {edit ? 'Edit habit' : 'Add a habit'}
      </h2>
      <div className="flex min-h-0 flex-1">
        {/* Tabs down the left edge, like an address book's: a shaded column of bordered tabs, flush with
            the box's edge. The selected tab takes the page's colour and covers the column's right-hand line,
            so it runs straight into its page. */}
        <div
          role="tablist"
          aria-orientation="vertical"
          aria-label="Kind of habit"
          className="flex w-28 shrink-0 flex-col border-r bg-muted"
        >
          {shownTabs.map((t, index) => [
            // A small heading above the first tab of each group.
            t.group !== shownTabs[index - 1]?.group && (
              <p
                key={`heading-${t.group}`}
                role="presentation"
                className="border-b bg-foreground/10 px-3 py-1 text-[11px] font-medium tracking-wide text-muted-foreground italic"
              >
                {t.group}
              </p>
            ),
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`goal-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`goal-page-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`-mr-px flex items-center justify-between border-b px-3 py-3 text-left text-sm ${tab === t.id ? 'relative z-10 border-r border-r-popover bg-popover font-semibold text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'} ${tab === 'welcome' && t.id === 'toggle' ? 'font-semibold text-foreground ring-2 ring-primary ring-inset' : ''}`}
            >
              {t.label}
              {/* On the welcome page: an arrow nudging you to pick Toggle. */}
              {tab === 'welcome' && t.id === 'toggle' && (
                <ArrowLeft aria-hidden="true" className="size-4 animate-nudge-left motion-reduce:animate-none" />
              )}
            </button>,
          ])}
        </div>
        {/* Every page is here at once, stacked in the same spot, with only the selected one visible. That
            makes the box as tall as the tallest page, whichever it is, so switching tabs never changes its
            size (and each page keeps what you've typed while the box is open). */}
        <div className="grid min-w-0 flex-1 overflow-y-auto">
          {firstGoal && (
            <div
              ref={(el) => {
                pages.current.welcome = el
              }}
              aria-hidden={tab !== 'welcome'}
              className={`col-start-1 row-start-1 flex flex-col gap-3 p-4 ${tab === 'welcome' ? 'visible' : 'invisible'}`}
            >
              <Welcome onClose={onClose} />
            </div>
          )}
          {shownTabs.map((t) => (
            <div
              key={t.id}
              ref={(el) => {
                pages.current[t.id] = el
              }}
              role="tabpanel"
              id={`goal-page-${t.id}`}
              aria-labelledby={`goal-tab-${t.id}`}
              aria-hidden={tab !== t.id}
              className={`col-start-1 row-start-1 flex flex-col p-4 ${tab === t.id ? 'visible' : 'invisible'}`}
            >
              {t.id === 'existing' && available && onAddExisting && (
                <ExistingGoals available={available} onClose={onClose} onAdd={onAddExisting} />
              )}
              {t.id === 'toggle' && (
                <NewToggle
                  onClose={onClose}
                  onCreate={onCreate}
                  guide={firstGoal}
                  initial={edit?.kind === 'toggle' ? edit : undefined}
                  submitLabel={submitLabel}
                />
              )}
              {t.id === 'number' && (
                <NewNumber
                  onClose={onClose}
                  onCreate={onCreate}
                  initial={edit?.kind === 'number' ? edit : undefined}
                  submitLabel={submitLabel}
                />
              )}
              {t.id === 'choice' && (
                <NewChoice
                  onClose={onClose}
                  onCreate={onCreate}
                  initial={edit?.kind === 'choice' ? edit : undefined}
                  submitLabel={submitLabel}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// The first page of your first goal: what the kinds are, pointing you at Toggle to start.
function Welcome({ onClose }: { onClose: () => void }) {
  return (
    <>
      <p className="text-lg font-semibold">Let's make your first habit.</p>
      <p className="text-sm text-muted-foreground">There are three kinds, down the left:</p>
      <ul className="flex flex-col gap-2 text-sm">
        <li>
          <span className="font-semibold">Toggle</span>: done or not, like "Read" or "No sugar".
        </li>
        <li>
          <span className="font-semibold">Number</span>: an amount or a score, like pages read or mood from 1 to 10.
        </li>
        <li>
          <span className="font-semibold">Choice</span>: pick one of your own emoji each day.
        </li>
      </ul>
      <p className="flex items-center gap-2 text-sm font-medium">
        <ArrowLeft aria-hidden="true" className="size-4 shrink-0 animate-nudge-left motion-reduce:animate-none" />
        Toggle is the simplest. Pick it to start.
      </p>
      <div className="mt-auto flex justify-end">
        <Button type="button" variant="outline" className={corners} onClick={onClose}>
          Cancel
        </Button>
      </div>
    </>
  )
}

function ExistingGoals({
  available,
  onClose,
  onAdd,
}: {
  available: GoalChoice[]
  onClose: () => void
  onAdd: (ids: number[]) => void
}) {
  // The goal chosen in the dropdown ('' until one is picked).
  const [picked, setPicked] = useState('')

  const add = (event: FormEvent) => {
    event.preventDefault()
    if (!picked) return
    onAdd([Number(picked)])
    onClose()
  }

  return (
    <form onSubmit={add} className="flex flex-1 flex-col">
      <WithPreview buttons={<Buttons onClose={onClose} label="Add" disabled={!picked} />}>
        {available.length === 0 ? (
          <p className="text-sm text-muted-foreground">All your habits are already in this schedule.</p>
        ) : (
          <div className="flex flex-col gap-1">
            <label htmlFor="existing-goal" className="text-sm font-medium">
              Habit
            </label>
            {/* White in both light and dark mode, like the name boxes on the New tabs. */}
            <select
              id="existing-goal"
              value={picked}
              onChange={(event) => setPicked(event.target.value)}
              className={field}
            >
              <option value="" disabled>
                Choose a habit…
              </option>
              {available.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </WithPreview>
    </form>
  )
}

// A New tab's page: the name, the "show as" choices and live preview, the rest of the settings, and the Cancel/New buttons.
// - On a phone they're stacked in that order: name, preview, settings, then the buttons at the bottom of the
//   box. The preview pins itself to the top of the page once you scroll past it, so it stays in view while
//   you change the settings below it.
// - On a computer (where the box is wider) the name and settings make the left column, and the preview is a
//   pane down the box's right edge, from the banner to the bottom, with the buttons at its bottom.
// The Goals tab has no name or preview: on a computer its pane is left empty (so every tab looks alike), and
// on a phone there's no pane at all.
function WithPreview({
  name,
  showAs,
  preview,
  buttons,
  children,
}: {
  name?: ReactNode
  showAs?: ReactNode
  preview?: ReactNode
  buttons: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex flex-1 flex-col gap-3 sm:grid sm:grid-cols-[1fr_15rem] sm:grid-rows-[auto_1fr] sm:gap-x-5">
      {name && <div className="sm:col-start-1 sm:row-start-1">{name}</div>}
      <div
        className={`${preview ? '' : 'hidden'} sticky top-0 z-10 -mx-4 border-y bg-pane px-4 py-3 sm:static sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:-my-4 sm:mr-[-1rem] sm:ml-0 sm:flex sm:flex-col sm:gap-3 sm:border-y-0 sm:border-l sm:p-3`}
      >
        {/* The "show as" choices sit on top of the preview they change (no heading: being right above it
            says what they're for). */}
        {showAs && <div className="mb-3 sm:mb-0">{showAs}</div>}
        {preview}
        {/* The buttons, pushed to the bottom of the pane (computer only). */}
        <div className="mt-auto hidden sm:block">{buttons}</div>
      </div>
      <div
        className={`flex min-w-0 flex-1 flex-col gap-3 sm:col-start-1 ${name ? 'sm:row-start-2' : 'sm:row-span-2 sm:row-start-1'}`}
      >
        {children}
        {/* The buttons, at the bottom of the box under the settings (phone only). */}
        <div className="mt-auto sm:hidden">{buttons}</div>
      </div>
    </div>
  )
}

// The name box shared by every New tab, with its character counter.
function NameField({
  id,
  value,
  onChange,
  error,
  hint,
}: {
  id: string
  value: string
  onChange: (name: string) => void
  error?: string
  // A nudge under the box (for your first goal), shown until something's typed.
  hint?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-medium">
          Name
        </label>
        {/* How many characters are used, out of the limit. */}
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {value.length}/{MAX_GOAL_NAME}
        </span>
      </div>
      <input
        id={id}
        maxLength={MAX_GOAL_NAME}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={field}
      />
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
      {hint && !value.trim() && !error && (
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <ArrowUp aria-hidden="true" className="size-4 shrink-0 animate-bounce motion-reduce:animate-none" />
          {hint}
        </p>
      )}
      {/* A bar under the name, setting it apart from the goal's other settings. (Computer only: on a phone the
          preview sits between them instead.) */}
      <hr
        aria-hidden="true"
        className="mx-auto mt-3 hidden w-[90%] rounded-full border-t-2 border-foreground/20 sm:block"
      />
    </div>
  )
}

// A small labelled box (unit, min, labels…), with room for an error underneath.
function SmallField({
  id,
  label,
  error,
  children,
}: {
  id: string
  label: string
  error?: string
  children: (props: { id: string; className: string; 'aria-invalid'?: true; 'aria-describedby'?: string }) => ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children({
        id,
        className: field,
        ...(error ? { 'aria-invalid': true, 'aria-describedby': `${id}-error` } : {}),
      })}
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

// Cancel and the main button, at the bottom of every page.
// `nudge`: an arrow pointing at the main button, for the last step of your first goal.
function Buttons({
  onClose,
  label,
  disabled,
  nudge,
}: {
  onClose: () => void
  label: string
  disabled?: boolean
  nudge?: boolean
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <Button type="button" variant="outline" className={corners} onClick={onClose}>
        Cancel
      </Button>
      {nudge && (
        <ArrowRight aria-hidden="true" className="size-5 shrink-0 animate-nudge-right motion-reduce:animate-none" />
      )}
      <Button
        type="submit"
        className={`${corners} ${nudge ? 'ring-2 ring-primary ring-offset-2 ring-offset-popover' : ''}`}
        disabled={disabled}
      >
        {label}
      </Button>
    </div>
  )
}

// `guide`: your first goal, so it nudges you to name it and then to save it.
// `initial`: an existing toggle habit's settings to start from (editing); `submitLabel`: "New" or "Save".
function NewToggle({
  onClose,
  onCreate,
  guide = false,
  initial,
  submitLabel,
}: {
  onClose: () => void
  onCreate: (goal: NewGoal) => void
  guide?: boolean
  initial?: Extract<NewGoal, { kind: 'toggle' }>
  submitLabel: string
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [mark, setMark] = useState<ToggleMark>(initial?.mark ?? '✓')
  const [error, setError] = useState<string>()

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return setError('Give the habit a name.')
    onCreate({ name: trimmed, kind: 'toggle', mark })
    onClose()
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-1 flex-col">
      <WithPreview
        preview={<TogglePreview name={name} mark={mark} />}
        buttons={<Buttons onClose={onClose} label={submitLabel} nudge={guide && name.trim() !== ''} />}
        name={
          <NameField
            id="goal-name"
            value={name}
            onChange={(value) => {
              setName(value)
              setError(undefined)
            }}
            error={error}
            hint={guide ? 'Give it a name, like "Read".' : undefined}
          />
        }
        // "Show as": the mark a done day gets in the grid.
        showAs={
          <fieldset aria-label="Show as" className="flex flex-col gap-1">
            <div className="flex gap-2">
              {(
                [
                  ['✓', 'Check'],
                  ['✗', 'Cross'],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={`${corners} flex flex-1 cursor-pointer items-center justify-center gap-2 border px-2 py-1.5 text-sm select-none ${mark === value ? 'border-primary bg-accent font-semibold' : 'hover:bg-accent/60'}`}
                >
                  <input
                    type="radio"
                    name="toggle-mark"
                    value={value}
                    checked={mark === value}
                    onChange={() => setMark(value)}
                    className="sr-only"
                  />
                  <span className="text-lg font-bold" aria-hidden="true">
                    {value}
                  </span>
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        }
      ></WithPreview>
    </form>
  )
}

// Empty box = not set; otherwise the number in it (NaN if it isn't one).
// (On the New number and New choice pages, any change clears the error messages until New is pressed again.)
const parse = (text: string) => (text.trim() === '' ? undefined : Number(text))

// `initial`: an existing number habit's settings to start from (editing); `submitLabel`: "New" or "Save".
function NewNumber({
  onClose,
  onCreate,
  initial,
  submitLabel,
}: {
  onClose: () => void
  onCreate: (goal: NewGoal) => void
  initial?: Extract<NewGoal, { kind: 'number' }>
  submitLabel: string
}) {
  const start = initial?.number
  const [name, setName] = useState(initial?.name ?? '')
  const [unit, setUnit] = useState(start?.unit ?? '')
  // A new number habit starts with a min of 0; an existing one shows what it has (blank for none).
  const [min, setMin] = useState(start ? (start.min === undefined ? '' : String(start.min)) : '0')
  const [max, setMax] = useState(start?.max === undefined ? '' : String(start.max))
  const [minLabel, setMinLabel] = useState(start?.minLabel ?? '')
  const [maxLabel, setMaxLabel] = useState(start?.maxLabel ?? '')
  const [step, setStep] = useState<NumberSettings['step']>(start?.step ?? 1)
  const [show, setShow] = useState<NonNullable<NumberSettings['show']>>(start?.show ?? 'entry')
  const [errors, setErrors] = useState<Record<string, string>>({})

  // End labels, and the slider, only make sense once both ends are set.
  const bounded = min.trim() !== '' && max.trim() !== ''
  // The settings so far, for the preview (null while they don't make sense, e.g. max below min).
  const previewSettings: NumberSettings | null = (() => {
    const lo = parse(min)
    const hi = parse(max)
    if ((lo !== undefined && Number.isNaN(lo)) || (hi !== undefined && Number.isNaN(hi))) return null
    if (lo !== undefined && hi !== undefined && lo >= hi) return null
    return {
      unit: unit.trim() || undefined,
      min: lo,
      max: hi,
      minLabel: bounded ? minLabel.trim() || undefined : undefined,
      maxLabel: bounded ? maxLabel.trim() || undefined : undefined,
      step,
      show,
    }
  })()

  // Changing min or max: if that leaves an end empty, a slider falls back to the number box.
  const changeEnd = (which: 'min' | 'max', text: string) => {
    if (which === 'min') setMin(text)
    else setMax(text)
    const stillBounded = (which === 'min' ? text : min).trim() !== '' && (which === 'max' ? text : max).trim() !== ''
    if (!stillBounded && show === 'slider') setShow('entry')
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const found: Record<string, string> = {}
    const lo = parse(min)
    const hi = parse(max)
    if (!name.trim()) found.name = 'Give the habit a name.'
    if (lo !== undefined && Number.isNaN(lo)) found.min = 'Not a number.'
    if (hi !== undefined && Number.isNaN(hi)) found.max = 'Not a number.'
    if (lo !== undefined && hi !== undefined && !found.min && !found.max && lo >= hi)
      found.max = 'Must be more than the min.'
    setErrors(found)
    if (Object.keys(found).length > 0) return

    onCreate({
      name: name.trim(),
      kind: 'number',
      number: {
        unit: unit.trim() || undefined,
        min: lo,
        max: hi,
        minLabel: bounded ? minLabel.trim() || undefined : undefined,
        maxLabel: bounded ? maxLabel.trim() || undefined : undefined,
        step,
        show,
      },
    })
    onClose()
  }

  return (
    <form onSubmit={submit} onChange={() => setErrors({})} noValidate className="flex flex-1 flex-col">
      <WithPreview
        buttons={<Buttons onClose={onClose} label={submitLabel} />}
        preview={
          // Restarts when the bounds, step or style change, so it starts where a new day would.
          <NumberPreview
            key={previewSettings ? `${previewSettings.min}|${previewSettings.max}|${step}|${show}` : 'none'}
            name={name}
            settings={previewSettings}
          />
        }
        name={<NameField id="number-name" value={name} onChange={setName} error={errors.name} />}
        // "Show as": how it's recorded. The slider needs both a min and a max.
        showAs={
          <fieldset aria-label="Show as" className="flex flex-col gap-1">
            <div className="flex gap-2">
              {(
                [
                  ['entry', 'Box'],
                  ['dial', 'Dial'],
                  ['slider', 'Slider'],
                ] as const
              ).map(([value, label]) => {
                const unavailable = value === 'slider' && !bounded
                return (
                  <label
                    key={value}
                    className={`${corners} flex flex-1 flex-col items-center justify-center border px-2 py-1.5 text-center text-sm select-none ${unavailable ? 'group relative cursor-not-allowed' : 'cursor-pointer'} ${show === value ? 'border-primary bg-accent font-semibold' : unavailable ? '' : 'hover:bg-accent/60'}`}
                  >
                    <input
                      type="radio"
                      name="number-show"
                      value={value}
                      checked={show === value}
                      disabled={unavailable}
                      aria-describedby={unavailable ? 'number-slider-why' : undefined}
                      onChange={() => setShow(value)}
                      className="sr-only"
                    />
                    <span className={unavailable ? 'opacity-40' : ''}>{label}</span>
                    {/* Greyed out, with a little bubble explaining why when you point at it (or tap it on a
                        phone). It opens below the button, lined up with its right edge so it stays in the box. */}
                    {unavailable && (
                      <span
                        id="number-slider-why"
                        role="tooltip"
                        className="pointer-events-none absolute top-full right-0 z-20 mt-1 hidden w-44 rounded-md bg-foreground px-2 py-1.5 text-left text-xs font-normal text-background shadow-md group-hover:block"
                      >
                        A slider needs both a min and a max, so it knows where its ends are.
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          </fieldset>
        }
      >
        <SmallField id="number-unit" label="Unit (optional)">
          {(props) => (
            <input
              {...props}
              placeholder="pages, km…"
              maxLength={MAX_SHORT_TEXT}
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            />
          )}
        </SmallField>
        <div className="flex gap-2">
          <SmallField id="number-min" label="Min" error={errors.min}>
            {(props) => (
              <input {...props} inputMode="decimal" value={min} onChange={(e) => changeEnd('min', e.target.value)} />
            )}
          </SmallField>
          <SmallField id="number-max" label="Max" error={errors.max}>
            {(props) => (
              <input
                {...props}
                inputMode="decimal"
                placeholder="none"
                value={max}
                onChange={(e) => changeEnd('max', e.target.value)}
              />
            )}
          </SmallField>
        </div>
        {/* What the two ends mean. Only useful with both a min and a max, so until then it's greyed out (but
            still there, so filling in the max doesn't make the box grow). */}
        <fieldset
          disabled={!bounded}
          title={bounded ? undefined : 'Fill in both a min and a max first.'}
          className={`flex gap-2 ${bounded ? '' : 'cursor-not-allowed opacity-50'}`}
        >
          <SmallField id="number-min-label" label="Min means">
            {(props) => (
              <input
                {...props}
                placeholder="Awful"
                maxLength={MAX_SHORT_TEXT}
                value={minLabel}
                onChange={(e) => setMinLabel(e.target.value)}
              />
            )}
          </SmallField>
          <SmallField id="number-max-label" label="Max means">
            {(props) => (
              <input
                {...props}
                placeholder="Great"
                maxLength={MAX_SHORT_TEXT}
                value={maxLabel}
                onChange={(e) => setMaxLabel(e.target.value)}
              />
            )}
          </SmallField>
        </fieldset>
        <SmallField id="number-step" label="Record in">
          {(props) => (
            <select {...props} value={step} onChange={(e) => setStep(Number(e.target.value) as NumberSettings['step'])}>
              <option value={1}>Whole numbers</option>
              <option value={0.5}>Halves (0.5)</option>
              <option value={0.1}>Tenths (0.1)</option>
            </select>
          )}
        </SmallField>
      </WithPreview>
    </form>
  )
}

type DraftOption = { key: number; emoji: string; name: string }

// `initial`: an existing choice habit's settings to start from (editing); `submitLabel`: "New" or "Save".
function NewChoice({
  onClose,
  onCreate,
  initial,
  submitLabel,
}: {
  onClose: () => void
  onCreate: (goal: NewGoal) => void
  initial?: Extract<NewGoal, { kind: 'choice' }>
  submitLabel: string
}) {
  const [name, setName] = useState(initial?.name ?? '')
  // Two empty options to start with (or the habit's own, when editing); `key` keeps each box tied to its
  // option as they're moved around.
  const [options, setOptions] = useState<DraftOption[]>(
    initial
      ? initial.choice.options.map((o, i) => ({ key: i + 1, emoji: o.emoji, name: o.name ?? '' }))
      : [
          { key: 1, emoji: '', name: '' },
          { key: 2, emoji: '', name: '' },
        ],
  )
  const [show, setShow] = useState<NonNullable<ChoiceSettings['show']>>(initial?.choice.show ?? 'buttons')
  const list = useRef<HTMLDivElement>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const change = (key: number, changes: Partial<DraftOption>) => {
    setOptions((all) => all.map((o) => (o.key === key ? { ...o, ...changes } : o)))
    setErrors({})
  }
  // Typing (or pasting) an emoji into the name box makes it the option's emoji; the rest stays the name.
  const typeName = (key: number, text: string) => {
    const typed = firstEmoji(text)
    if (typed) change(key, { emoji: typed, name: text.replace(typed, '').trimStart() })
    else change(key, { name: text })
  }
  const move = (index: number, step: number) =>
    setOptions((all) => {
      const next = [...all]
      ;[next[index], next[index + step]] = [next[index + step], next[index]]
      return next
    })
  const addOption = () => {
    const key = Math.max(0, ...options.map((o) => o.key)) + 1
    setOptions((all) => [...all, { key, emoji: '', name: '' }])
    // Scroll the list down to the new option once it's there.
    requestAnimationFrame(() => list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' }))
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const found: Record<string, string> = {}
    // Options left completely empty are ignored.
    const filled = options.filter((o) => o.emoji || o.name.trim())
    const emojis = filled.map((o) => o.emoji)
    if (!name.trim()) found.name = 'Give the habit a name.'
    if (filled.length < 2) found.options = 'Give it at least two options.'
    else if (filled.some((o) => !o.emoji)) found.options = 'Pick an emoji for every option.'
    else if (new Set(emojis).size !== emojis.length) found.options = 'Each option needs a different emoji.'
    setErrors(found)
    if (Object.keys(found).length > 0) return

    onCreate({
      name: name.trim(),
      kind: 'choice',
      choice: { options: filled.map((o) => ({ emoji: o.emoji, name: o.name.trim() || undefined })), show },
    })
    onClose()
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-1 flex-col">
      <WithPreview
        buttons={<Buttons onClose={onClose} label={submitLabel} />}
        preview={
          <ChoicePreview
            name={name}
            options={options.filter((o) => o.emoji).map((o) => ({ emoji: o.emoji, name: o.name.trim() || undefined }))}
            show={show}
          />
        }
        name={
          <NameField
            id="choice-name"
            value={name}
            onChange={(value) => {
              setName(value)
              setErrors({})
            }}
            error={errors.name}
          />
        }
        // "Show as": how a day is recorded.
        showAs={
          <fieldset aria-label="Show as" className="flex flex-col gap-1">
            <div className="flex gap-2">
              {(
                [
                  ['buttons', 'Buttons'],
                  ['dropdown', 'Dropdown'],
                  ['wheel', 'Wheel'],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={`${corners} flex flex-1 cursor-pointer items-center justify-center border px-1 py-1.5 text-sm select-none ${show === value ? 'border-primary bg-accent font-semibold' : 'hover:bg-accent/60'}`}
                >
                  <input
                    type="radio"
                    name="choice-show"
                    value={value}
                    checked={show === value}
                    onChange={() => setShow(value)}
                    className="sr-only"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        }
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Options</legend>
          {/* The options scroll inside their own box (about four rows tall), so adding more doesn't make the
              whole add-a-goal box taller. The plus below stays put. */}
          <div ref={list} className="-m-1 flex max-h-[11.25rem] flex-col gap-1.5 overflow-y-auto p-1">
            {options.map((option, index) => (
              <div key={option.key} className="flex flex-col gap-1">
                <div className="flex items-center gap-1">
                  {/* The option's emoji (what the grid will show). Tapping it pops up the emoji picker. */}
                  <EmojiPicker
                    value={option.emoji}
                    onPick={(emoji) => change(option.key, { emoji })}
                    label={
                      option.emoji
                        ? `Option ${index + 1} emoji: ${option.emoji}`
                        : `Pick an emoji for option ${index + 1}`
                    }
                    hint={option.name}
                  />
                  <input
                    aria-label={`Option ${index + 1} name (optional)`}
                    placeholder="name (optional)"
                    maxLength={MAX_OPTION}
                    value={option.name}
                    onChange={(e) => typeName(option.key, e.target.value)}
                    className={`${field} min-w-0 flex-1 py-1!`}
                  />
                  <button
                    type="button"
                    aria-label={`Move option ${index + 1} up`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    className="rounded-sm p-0.5 text-muted-foreground hover:bg-accent disabled:opacity-30"
                  >
                    <ArrowUp aria-hidden="true" className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move option ${index + 1} down`}
                    disabled={index === options.length - 1}
                    onClick={() => move(index, 1)}
                    className="rounded-sm p-0.5 text-muted-foreground hover:bg-accent disabled:opacity-30"
                  >
                    <ArrowDown aria-hidden="true" className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove option ${index + 1}`}
                    disabled={options.length <= 2}
                    onClick={() => setOptions((all) => all.filter((o) => o.key !== option.key))}
                    className="rounded-sm p-0.5 text-muted-foreground hover:bg-destructive hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <X aria-hidden="true" className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {/* A plus, like the one for adding goals to the grid, lined up under the emoji boxes. */}
          <button
            type="button"
            aria-label="Add option"
            onClick={addOption}
            className="flex size-9 items-center justify-center self-start rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Plus aria-hidden="true" className="size-5" />
          </button>
          {errors.options && <p className="text-sm text-destructive">{errors.options}</p>}
        </fieldset>
      </WithPreview>
    </form>
  )
}
