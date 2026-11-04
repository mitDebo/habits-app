import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ExampleRows, type Example } from '@/about/ExampleRows'
import { useAuth } from '@/auth/context'
import { SignInOptions } from '@/auth/LoginDialog'

// Example habits for each kind, spread across the different ways of recording them. Only for trying out on
// this page: nothing is saved.
const toggles: Example[] = [
  { habit: { name: 'Read 20 min', kind: 'toggle', mark: '✓' }, filled: { 0: true, 1: true, 3: true } },
  { habit: { name: 'Work out', kind: 'toggle', mark: '✓' }, filled: { 0: true, 2: true } },
  { habit: { name: 'No sugar', kind: 'toggle', mark: '✗' }, filled: { 1: true, 2: true } },
]
const numbers: Example[] = [
  {
    habit: { name: 'Pages read', kind: 'number', number: { unit: 'pages', min: 0, step: 1, show: 'entry' } },
    filled: { 0: 12, 1: 30, 3: 8 },
  },
  {
    habit: {
      name: 'Water',
      kind: 'number',
      number: { unit: 'glasses', min: 0, max: 12, step: 1, show: 'slider' },
    },
    filled: { 0: 8, 2: 6 },
  },
  {
    habit: {
      name: 'Mood',
      kind: 'number',
      number: { min: 1, max: 10, minLabel: 'Awful', maxLabel: 'Great', step: 1, show: 'dial' },
    },
    filled: { 0: 7, 1: 5, 2: 8 },
  },
]
const choices: Example[] = [
  {
    habit: {
      name: 'Lunch',
      kind: 'choice',
      choice: {
        options: [
          { emoji: '🥗', name: 'Salad' },
          { emoji: '🍕', name: 'Pizza' },
          { emoji: '🍔', name: 'Burger' },
        ],
        show: 'buttons',
      },
    },
    filled: { 0: '🥗', 1: '🍕' },
  },
  {
    habit: {
      name: 'Workout type',
      kind: 'choice',
      choice: {
        options: [
          { emoji: '🏃', name: 'Run' },
          { emoji: '🏋️', name: 'Weights' },
          { emoji: '🧘', name: 'Yoga' },
        ],
        show: 'dropdown',
      },
    },
    filled: { 0: '🏃', 2: '🧘' },
  },
  {
    habit: {
      name: 'Sleep',
      kind: 'choice',
      choice: {
        options: [
          { emoji: '😴', name: 'Great' },
          { emoji: '🙂', name: 'OK' },
          { emoji: '😫', name: 'Rough' },
        ],
        show: 'wheel',
      },
    },
    filled: { 0: '🙂', 1: '😴', 3: '😫' },
  },
]

// (Headings start at h2: the header's app name is the page's h1.)
// What the app is for and how it works, with habits to try out, ending with sign-in. It's the front page
// for anyone not signed in, and in the menu (About) for everyone.
export function AboutPage() {
  const { session } = useAuth()
  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-10 pb-10 text-base leading-relaxed">
      <header className="flex flex-col gap-2">
        <h2 className="text-3xl font-semibold">Build habits that stick</h2>
        <p className="text-lg text-muted-foreground">
          HabitTracker is a simple weekly tracker for the small things you want to do every day.
        </p>
      </header>

      <Section title="How it works">
        <p>
          Your habits run down the side and the days run across the top, so a whole week fits on your phone at a glance.
          Each day, tap a habit's square to record it.
        </p>
        <p>Tap the gear to edit: add habits, change a schedule's dates, or take a day off.</p>
      </Section>

      <Section title="Schedules">
        <p>
          Your habits live in a schedule: a stretch of days with its own set of habits. It doesn't have to be a week. It
          can be a weekend, a two-week challenge, a month, or whatever fits what you're working on. In edit mode, the −
          and + buttons on either side move its start and end a day at a time.
        </p>
        <p>
          You can keep up to five schedules at once, each in its own tab along the bottom, and each with its own dates.
          A daily routine can run all month next to a one-week reading sprint. On each tab, the days that aren't part of
          that schedule are shaded, so you always know which squares count.
        </p>
      </Section>

      <Section title="Three kinds of habit">
        <KindTabs />
      </Section>

      {session ? (
        <p>
          You're signed in.{' '}
          <Link to="/" className="font-medium underline">
            Go to your habits
          </Link>
        </p>
      ) : (
        // The heading on the left like the other sections; the form and its note centred on the page.
        <Section title="Ready to start?">
          <div className="mx-auto flex w-full max-w-sm flex-col gap-3">
            <SignInOptions />
            <p className="text-center text-sm text-muted-foreground">
              New here? Signing in for the first time creates your account.
            </p>
          </div>
        </Section>
      )}
    </article>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xl font-semibold">{title}</h3>
      {children}
    </section>
  )
}

const kinds = [
  {
    id: 'toggle',
    name: 'Toggle',
    blurb:
      'Done or not done. Tap a day to tick it off, and tap again to undo. Mark it with a check, or a cross if crossing things off feels better.',
    examples: toggles,
  },
  {
    id: 'number',
    name: 'Number',
    blurb:
      'An amount or a score, like pages read, glasses of water, or your mood from 1 to 10. Give it a unit and a range, and record it with a number box, a slider or a dial.',
    examples: numbers,
  },
  {
    id: 'choice',
    name: 'Choice',
    blurb:
      'Pick one of your own options each day. Each option is an emoji, so a week of them reads at a glance. Choose with buttons, a dropdown or a spinning wheel.',
    examples: choices,
  },
]

// The three kinds of habit in a panel with a tab for each across the top. Each tab has what the kind is for
// and example rows to try (nothing saved). Every tab's page is drawn in the same spot with only the chosen
// one showing, so the panel is always as tall as the tallest and never jumps when you switch.
function KindTabs() {
  const [shown, setShown] = useState(kinds[0].id)
  return (
    <div className="overflow-hidden rounded-lg border">
      <div role="tablist" aria-label="Kinds of habit" className="flex bg-muted">
        {kinds.map((kind, index) => (
          <button
            key={kind.id}
            type="button"
            role="tab"
            id={`kind-tab-${kind.id}`}
            aria-selected={shown === kind.id}
            aria-controls={`kind-page-${kind.id}`}
            onClick={() => setShown(kind.id)}
            className={`flex-1 border-b px-3 py-2.5 text-sm ${index > 0 ? 'border-l' : ''} ${shown === kind.id ? 'border-b-transparent bg-popover font-semibold text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'}`}
          >
            {kind.name}
          </button>
        ))}
      </div>
      <div className="grid bg-popover">
        {kinds.map((kind) => (
          <div
            key={kind.id}
            role="tabpanel"
            id={`kind-page-${kind.id}`}
            aria-labelledby={`kind-tab-${kind.id}`}
            aria-hidden={shown !== kind.id}
            className={`col-start-1 row-start-1 flex flex-col gap-3 p-4 ${shown === kind.id ? 'visible' : 'invisible'}`}
          >
            <p>{kind.blurb}</p>
            <p className="text-sm text-muted-foreground italic">Try it out: tap a day. Nothing here is saved.</p>
            {/* The example grid, centred in the panel. */}
            <div className="mx-auto max-w-full overflow-x-auto">
              <ExampleRows examples={kind.examples} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
