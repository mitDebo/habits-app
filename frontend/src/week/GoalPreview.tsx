import { useState, type ReactNode } from 'react'
import type { ChoiceSettings, NumberSettings, ToggleMark } from '@/week/goalKinds'
import { problemWith, shortNumber, startingValue } from '@/week/numbers'
import { ChoiceButtons, ChoiceDropdown, ChoiceWheel } from '@/week/widgets/ChoicePickers'
import { NumberDial } from '@/week/widgets/NumberDial'
import { NumberEntry } from '@/week/widgets/NumberEntry'
import { NumberSlider } from '@/week/widgets/NumberSlider'

// One of the preview's inner boxes: a small heading, then its contents, on the box's lighter colour.
function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border bg-popover p-3">
      <p className="self-start text-xs font-medium text-muted-foreground italic select-none">{title}</p>
      {children}
    </div>
  )
}

// The preview: an "Input Preview" box with the widget (if the goal has one) above a "Grid Preview" box.
function Preview({ input, grid }: { input?: ReactNode; grid: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      {input && <Panel title="Input Preview">{input}</Panel>}
      <Panel title="Grid Preview">{grid}</Panel>
    </div>
  )
}

// A mini grid row, like the real grid's: the goal's name, then three days. The first day shows what's
// recorded (tap it to tick, for a toggle); the other two are greyed out like days that haven't happened yet.
function SampleRow({ name, shows, onTap }: { name: string; shows: string; onTap?: () => void }) {
  const size = [...new Intl.Segmenter().segment(shows)].length <= 2 ? 'text-xl font-bold' : 'text-sm font-semibold'
  const day = 'flex h-11 w-[38px] items-center justify-center border-r border-foreground/25'
  const future = (shade: string) => (
    <div aria-hidden="true" className={`${day} ${shade}`}>
      <div className="size-full bg-foreground/10" />
    </div>
  )
  return (
    <div className="flex w-full items-stretch bg-row-1 select-none" aria-label={`${name || 'Your habit'} in the grid`}>
      <div className="flex min-w-0 flex-1 items-center px-2 text-sm leading-tight font-medium [overflow-wrap:anywhere]">
        {name.trim() || <span className="text-muted-foreground italic">Your habit</span>}
      </div>
      {onTap ? (
        <button
          type="button"
          aria-label="Sample day"
          onClick={onTap}
          className={`${day} ${size} border-l bg-column-1 hover:bg-foreground/10`}
        >
          {shows}
        </button>
      ) : (
        <div className={`${day} ${size} border-l bg-column-1`}>{shows}</div>
      )}
      {future('bg-column-2')}
      {future('bg-column-1')}
    </div>
  )
}

// Toggle: no input widget (you tap the day itself); tap the first day to see the mark come and go.
export function TogglePreview({ name, mark }: { name: string; mark: ToggleMark }) {
  const [done, setDone] = useState(true)
  return (
    <Preview
      grid={
        <>
          <SampleRow name={name} shows={done ? mark : ''} onTap={() => setDone(!done)} />
          <p className="text-xs text-muted-foreground">Tap the first day to try it.</p>
        </>
      }
    />
  )
}

// The number widgets aren't all the same height (the dial is the tallest), so the Input Preview always makes
// room for a dial with its min/max labels: an invisible one sits underneath the real widget. That way
// switching Box/Dial/Slider, or filling in a min or max, never changes the box's height.
function DialSizedSpace({ children }: { children: ReactNode }) {
  return (
    <div className="grid w-full place-items-center">
      <div aria-hidden="true" inert className="invisible col-start-1 row-start-1 w-full">
        <NumberDial id="preview-space" value={0} onChange={() => {}} settings={{ step: 1, min: 0, max: 10 }} compact />
      </div>
      <div className="col-start-1 row-start-1 w-full">{children}</div>
    </div>
  )
}

// Number: the real widget, using the settings so far (null while they don't make sense yet). It starts
// where a new day would; the parent restarts it when the bounds, step or style change.
export function NumberPreview({ name, settings }: { name: string; settings: NumberSettings | null }) {
  if (!settings)
    return (
      <Preview
        input={
          <DialSizedSpace>
            <p className="text-center text-sm text-muted-foreground">Fix the settings to see a preview.</p>
          </DialSizedSpace>
        }
        grid={<SampleRow name={name} shows="" />}
      />
    )
  return <NumberPreviewWidget name={name} settings={settings} />
}

function NumberPreviewWidget({ name, settings }: { name: string; settings: NumberSettings }) {
  const [text, setText] = useState(String(startingValue(settings)))
  const value = text.trim() === '' ? NaN : Number(text)
  const ok = !problemWith(value, settings)
  const { min, max } = settings
  return (
    <Preview
      input={
        <DialSizedSpace>
          {settings.show === 'dial' ? (
            <NumberDial
              id="preview-value"
              value={value}
              onChange={(v) => setText(String(v))}
              settings={settings}
              compact
            />
          ) : settings.show === 'slider' && min !== undefined && max !== undefined ? (
            <div className="w-full">
              <NumberSlider
                id="preview-value"
                value={value}
                onChange={(v) => setText(String(v))}
                settings={{ ...settings, min, max }}
              />
            </div>
          ) : (
            <NumberEntry id="preview-value" text={text} onChange={setText} settings={settings} />
          )}
        </DialSizedSpace>
      }
      grid={<SampleRow name={name} shows={ok ? shortNumber(value) : '?'} />}
    />
  )
}

// The choice pickers come in different heights (and the buttons get taller with every option), so the Input
// Preview gives them one fixed-height space: switching Buttons/Dropdown/Wheel or adding options never
// changes the box's height. It's about two and a half buttons tall, so a cut-off button hints you can scroll.
function ChoiceSpace({ children }: { children: ReactNode }) {
  return <div className="flex h-32 w-full flex-col justify-center">{children}</div>
}

// Choice: the real picker with the options so far (those with an emoji).
export function ChoicePreview({
  name,
  options,
  show,
}: {
  name: string
  options: ChoiceSettings['options']
  show: ChoiceSettings['show']
}) {
  if (options.length === 0)
    return (
      <Preview
        input={
          <ChoiceSpace>
            <p className="text-center text-sm text-muted-foreground">Give an option an emoji to see a preview.</p>
          </ChoiceSpace>
        }
        grid={<SampleRow name={name} shows="" />}
      />
    )
  return (
    <ChoicePreviewWidget
      key={`${show}|${options.map((o) => o.emoji).join('')}`}
      name={name}
      options={options}
      show={show}
    />
  )
}

function ChoicePreviewWidget({
  name,
  options,
  show,
}: {
  name: string
  options: ChoiceSettings['options']
  show: ChoiceSettings['show']
}) {
  const [chosen, setChosen] = useState(show === 'wheel' ? options[0].emoji : '')
  const picker = { id: 'preview-choice', options, value: chosen, onChange: setChosen }
  return (
    <Preview
      input={
        <ChoiceSpace>
          {show === 'dropdown' ? (
            <ChoiceDropdown {...picker} />
          ) : show === 'wheel' ? (
            <ChoiceWheel {...picker} rows={3} />
          ) : (
            // However many options there are, the buttons scroll inside the space instead of stretching it.
            <div className="max-h-full overflow-y-auto p-0.5">
              <ChoiceButtons {...picker} />
            </div>
          )}
        </ChoiceSpace>
      }
      grid={<SampleRow name={name} shows={chosen} />}
    />
  )
}
