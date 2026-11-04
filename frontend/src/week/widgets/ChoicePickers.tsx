import { useEffect, useRef } from 'react'
import type { ChoiceSettings } from '@/week/goalKinds'

type Picker = {
  id: string
  options: ChoiceSettings['options']
  // The chosen option's emoji ('' when nothing's chosen yet).
  value: string
  onChange: (emoji: string) => void
}

// How an option reads in a list: its emoji, then its name if it has one.
const optionText = (option: ChoiceSettings['options'][number]) => `${option.emoji}${option.name ? ` ${option.name}` : ''}`

// Buttons: one big button per option, stacked in order, with the emoji and name centred. Tap one to choose it.
export function ChoiceButtons({ id, options, value, onChange }: Picker) {
  return (
    <div id={id} role="radiogroup" className="flex flex-col gap-2">
      {options.map((option) => (
        <button
          key={option.emoji}
          type="button"
          role="radio"
          aria-checked={value === option.emoji}
          onClick={() => onChange(option.emoji)}
          className={`flex h-12 items-center justify-center gap-3 rounded-md border px-3 text-center ${value === option.emoji ? 'border-primary bg-accent font-semibold' : 'hover:bg-accent/60'}`}
        >
          <span className="text-2xl" aria-hidden="true">
            {option.emoji}
          </span>
          {/* Only when there's a name, so an emoji on its own sits right in the middle. */}
          {option.name && <span>{option.name}</span>}
          <span className="sr-only">{option.name ? '' : option.emoji}</span>
        </button>
      ))}
    </div>
  )
}

// Dropdown: one list of all the options.
export function ChoiceDropdown({ id, options, value, onChange }: Picker) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-12 w-full rounded-md border border-gray-300 bg-white px-2 text-lg text-gray-900 [color-scheme:light]"
    >
      <option value="" disabled>
        Choose…
      </option>
      {options.map((option) => (
        <option key={option.emoji} value={option.emoji}>
          {optionText(option)}
        </option>
      ))}
    </select>
  )
}

const ROW_PX = 44 // each option on the wheel
const VISIBLE_ROWS = 5 // how many show at once (an odd number); the middle one is the choice

// Wheel: a spinning list, like a phone's date picker. Flick or drag it; whichever option settles in the
// middle band is chosen. Tapping an option spins it to the middle. Up/down arrow keys move one option.
export function ChoiceWheel({ id, options, value, onChange, rows = VISIBLE_ROWS }: Picker & { rows?: number }) {
  const wheel = useRef<HTMLDivElement>(null)
  const index = Math.max(0, options.findIndex((o) => o.emoji === value))

  // Start (and stay) lined up on the chosen option.
  useEffect(() => {
    const el = wheel.current
    if (el && Math.round(el.scrollTop / ROW_PX) !== index) el.scrollTop = index * ROW_PX
  }, [index])

  // As it spins, whichever option is in the middle becomes the choice.
  const onScroll = () => {
    const el = wheel.current
    if (!el) return
    const middle = Math.min(options.length - 1, Math.max(0, Math.round(el.scrollTop / ROW_PX)))
    if (options[middle] && options[middle].emoji !== value) onChange(options[middle].emoji)
  }
  const spinTo = (i: number) => wheel.current?.scrollTo({ top: i * ROW_PX, behavior: 'smooth' })

  return (
    <div className="relative">
      {/* The middle band: whatever's in it is the choice. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 rounded-md border-y bg-accent/60"
        style={{ top: ROW_PX * Math.floor(rows / 2), height: ROW_PX }}
      />
      <div
        id={id}
        ref={wheel}
        role="listbox"
        tabIndex={0}
        aria-activedescendant={`${id}-${index}`}
        onScroll={onScroll}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') spinTo(Math.min(options.length - 1, index + 1))
          else if (event.key === 'ArrowUp') spinTo(Math.max(0, index - 1))
          else return
          event.preventDefault()
        }}
        className="relative snap-y snap-mandatory overflow-y-auto [scrollbar-width:none] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-scrollbar]:hidden"
        style={{
          height: ROW_PX * rows,
          // Empty space above the first option and below the last, so each can reach the middle.
          paddingBlock: ROW_PX * Math.floor(rows / 2),
          // Fades out towards the top and bottom, like a real wheel curving away.
          maskImage: 'linear-gradient(to bottom, transparent, black 30%, black 70%, transparent)',
        }}
      >
        {options.map((option, i) => (
          <div
            key={option.emoji}
            id={`${id}-${i}`}
            role="option"
            aria-selected={i === index}
            onClick={() => spinTo(i)}
            className={`flex snap-center items-center justify-center gap-3 transition-transform ${i === index ? 'scale-110 font-semibold' : 'text-muted-foreground'}`}
            style={{ height: ROW_PX }}
          >
            <span className="text-2xl" aria-hidden="true">
              {option.emoji}
            </span>
            {option.name && <span>{option.name}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
