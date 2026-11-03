import { useEffect, useRef } from 'react'
import { Minus, Plus } from 'lucide-react'

type Step = 'minus' | 'plus'

type Props = {
  // Which end of the plan this pair is for.
  // - start: − on top moves the start a day earlier; + underneath moves it a day later.
  // - end: + on top moves the end a day later (a longer plan); − underneath moves it a day earlier.
  edge: 'start' | 'end'
  // The whole pair's height; each button gets half.
  heightPx: number
  onStep: (step: Step) => void
  canMinus: boolean
  canPlus: boolean
  // Outlined and pulsing (for the tip that shows them off).
  highlight?: boolean
}

// The two buttons at one end of the plan, stacked, each half the grid's height. Tap one to move that end
// by a day; hold it to keep going, faster the longer you hold.
export function RangeButtons({ edge, heightPx, onStep, canMinus, canPlus, highlight = false }: Props) {
  const minus = (
    <HoldButton
      key="minus"
      label={edge === 'start' ? 'Start the plan a day earlier' : 'End the plan a day earlier'}
      disabled={!canMinus}
      onStep={() => onStep('minus')}
      heightPx={heightPx / 2}
    >
      <Minus aria-hidden="true" className="size-3.5" />
    </HoldButton>
  )
  const plus = (
    <HoldButton
      key="plus"
      label={edge === 'start' ? 'Start the plan a day later' : 'End the plan a day later'}
      disabled={!canPlus}
      onStep={() => onStep('plus')}
      heightPx={heightPx / 2}
    >
      <Plus aria-hidden="true" className="size-3.5" />
    </HoldButton>
  )
  return (
    <div
      className={`flex flex-col overflow-hidden rounded-md ${highlight ? 'animate-pulse ring-2 ring-primary' : ''}`}
      style={{ height: heightPx }}
    >
      {edge === 'start' ? [minus, plus] : [plus, minus]}
    </div>
  )
}

// How long a hold waits before it starts repeating, then the gap between repeats: it starts at a few a
// second and speeds up to about 25 a second.
const FIRST_DELAY_MS = 400
const START_GAP_MS = 160
const FASTEST_GAP_MS = 40
const SPEED_UP = 0.88 // each repeat's gap is this much of the last one's

function HoldButton({
  label,
  disabled,
  onStep,
  heightPx,
  children,
}: {
  label: string
  disabled: boolean
  onStep: () => void
  heightPx: number
  children: React.ReactNode
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The latest onStep, so a long hold keeps using the current one.
  const step = useRef(onStep)
  useEffect(() => {
    step.current = onStep
  }, [onStep])

  const stop = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  // Stop repeating when the button can't go any further, or goes away.
  useEffect(() => {
    if (disabled) stop()
  }, [disabled])
  useEffect(() => stop, [])

  const start = () => {
    stop()
    step.current()
    let gap = START_GAP_MS
    const repeat = () => {
      step.current()
      gap = Math.max(FASTEST_GAP_MS, gap * SPEED_UP)
      timer.current = setTimeout(repeat, gap)
    }
    timer.current = setTimeout(repeat, FIRST_DELAY_MS)
  }

  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        // No text selection, long-press menu or focus jump while holding; "capture" keeps the hold going
        // even if the finger slips off the button.
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        start()
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
      onContextMenu={(event) => event.preventDefault()}
      // From the keyboard (Enter or Space), a click is one step. Clicks from a pointer are handled above.
      onClick={(event) => {
        if (event.detail === 0) onStep()
      }}
      className="flex w-full flex-1 touch-none items-center justify-center bg-accent text-muted-foreground select-none [-webkit-touch-callout:none] not-last:border-b not-last:border-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset active:bg-primary active:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:active:bg-accent disabled:active:text-muted-foreground"
      style={{ height: heightPx }}
    >
      {children}
    </button>
  )
}
