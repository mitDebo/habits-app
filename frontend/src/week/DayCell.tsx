import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Plus, Trash2, X } from 'lucide-react'

const DECIDE_PX = 8 // how far the pointer moves before we decide: a sideways swipe, or a scroll/tap

type Props = {
  // For screen readers: "Goal 1, Mon, 19 Oct 2026".
  label: string
  editing: boolean
  // What the day shows: a toggle's ✓ or ✗, a recorded number… ('' when nothing's recorded).
  shows: string
  future: boolean
  // Taken off the plan for this goal: blank, and can't be ticked.
  removed: boolean
  // How wide the cell is (how far it slides to show its button).
  widthPx: number
  // What the sliding layer looks like: the cell's stripes over a solid base, so it covers the button.
  surface: string
  // The cell's own classes and style (column stripe, lines, drag frame).
  className: string
  style?: CSSProperties
  // Whether the hidden button is showing on this cell, and a way to show/hide it (one at a time).
  revealed: boolean
  onReveal: (shown: boolean) => void
  // Tapping the day (outside edit mode): ticks a toggle, or opens the box for recording a number.
  onTap: () => void
  onRemove: () => void
  onRestore: () => void
}

// One goal on one day. Tap it to record: a toggle ticks or unticks, a number opens a box to enter it (not in
// edit mode: that's for setting up the plan, so there what's recorded shows but can't be changed).
// In edit mode it can be taken off the plan (or put back):
// - a normal day: swipe it left to slide out a red trash button
// - a removed (lined) day: swipe it right to slide out a green + button (the mirror image)
// - on computers with a mouse, hovering shows a tiny × (or +) in the corner that does it in one click
// A removed day is lined (like days outside the plan) and can't be ticked.
export function DayCell(props: Props) {
  const { label, editing, shows, future, removed, widthPx, surface, className, style, revealed, onReveal } = props
  const cell = useRef<HTMLTableCellElement>(null)
  const drag = useRef<{ x: number; y: number; mode: 'undecided' | 'swipe' | 'other' } | null>(null)
  // A swipe ends with a "click" as you let go; this stops that click from ticking the day.
  const justSwiped = useRef(false)
  const [slide, setSlide] = useState(0)
  const [swiping, setSwiping] = useState(false)

  // The button is showing: tapping anywhere outside this cell slides it back.
  useEffect(() => {
    if (!revealed) return
    const closeIfOutside = (event: PointerEvent) => {
      if (!cell.current?.contains(event.target as Node)) onReveal(false)
    }
    document.addEventListener('pointerdown', closeIfOutside)
    return () => document.removeEventListener('pointerdown', closeIfOutside)
  }, [revealed, onReveal])

  // A mark, an emoji or a short number is big and bold; 3–4 characters ("120", "1.2k") a bit smaller, to fit.
  // (Counted as characters you see: an emoji like 🏋️ is several code units but one character.)
  const seen = [...new Intl.Segmenter().segment(shows)].length
  const size = seen <= 2 ? 'text-xl font-bold' : 'text-sm font-semibold'

  // Which way the cell slides open: left to remove, right to put back.
  const opens = removed ? 1 : -1
  const offset = swiping ? slide : revealed ? opens * widthPx : 0
  const action = removed ? props.onRestore : props.onRemove
  const actionLabel = removed ? `Put back ${label}` : `Remove ${label} from the plan`

  const endDrag = () => {
    if (drag.current?.mode === 'swipe') {
      justSwiped.current = true
      // Let go more than halfway open: stay open. Otherwise slide back.
      onReveal(slide * opens > widthPx / 2)
      setSwiping(false)
      setSlide(0)
    }
    drag.current = null
  }

  return (
    <td
      ref={cell}
      className={`group relative overflow-hidden p-0 ${className} ${editing ? 'touch-pan-y' : ''}`}
      style={style}
      onPointerDown={(event) => {
        if (!editing) return
        drag.current = { x: event.clientX, y: event.clientY, mode: 'undecided' }
      }}
      onPointerMove={(event) => {
        const d = drag.current
        if (!d || d.mode === 'other') return
        const dx = event.clientX - d.x
        const dy = event.clientY - d.y
        if (d.mode === 'undecided') {
          if (Math.max(Math.abs(dx), Math.abs(dy)) < DECIDE_PX) return
          // Sideways: a swipe (keep hold of the pointer). Up/down: leave it alone (the page scrolls).
          d.mode = Math.abs(dx) > Math.abs(dy) ? 'swipe' : 'other'
          if (d.mode === 'other') return
          event.currentTarget.setPointerCapture(event.pointerId)
          setSwiping(true)
        }
        // Starting from wherever it was (open or closed); only between closed and fully open.
        const from = revealed ? opens * widthPx : 0
        setSlide(opens * Math.min(widthPx, Math.max(0, (from + dx) * opens)))
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClickCapture={(event) => {
        if (!justSwiped.current) return
        justSwiped.current = false
        event.stopPropagation()
        event.preventDefault()
      }}
    >
      {/* Behind the cell: the button that the swipe uncovers. Hidden unless a swipe is under way or it's open. */}
      {editing && (
        <button
          type="button"
          aria-label={actionLabel}
          tabIndex={revealed ? 0 : -1}
          onClick={() => {
            onReveal(false)
            action()
          }}
          className={`absolute inset-0 flex items-center justify-center text-white ${removed ? 'bg-emerald-600' : 'bg-destructive'} ${swiping || revealed ? 'visible' : 'invisible'}`}
        >
          {removed ? <Plus aria-hidden="true" className="size-5" /> : <Trash2 aria-hidden="true" className="size-4" />}
        </button>
      )}

      {/* The cell itself, sliding over that button. */}
      <div
        className={`relative ${swiping ? '' : 'transition-transform duration-200 ease-out motion-reduce:transition-none'}`}
        style={{ transform: `translateX(${offset}px)`, background: swiping || revealed ? surface : undefined }}
      >
        {removed ? (
          // Off the plan: nothing to tick. See-through, so the cell's faint diagonal lines show.
          <div aria-label={`${label}: not part of the plan`} role="img" className="h-11" />
        ) : editing ? (
          // Edit mode: what's recorded shows but can't be changed. Days after today stay greyed out.
          <div
            aria-label={`${label}${shows ? `: ${shows}` : ''}`}
            role="img"
            className={`flex h-11 w-full items-center justify-center ${size} ${future ? 'bg-foreground/10' : ''}`}
          >
            {shows}
          </div>
        ) : (
          // Tap to record. Days after today are greyed out and can't be tapped.
          <button
            type="button"
            aria-label={`${label}${shows ? `: ${shows}` : ''}`}
            disabled={future}
            onClick={props.onTap}
            className={`flex h-11 w-full cursor-pointer items-center justify-center ${size} hover:bg-foreground/10 disabled:cursor-not-allowed disabled:bg-foreground/10 disabled:hover:bg-foreground/10`}
          >
            {shows}
          </button>
        )}
      </div>

      {/* Computers with a mouse: a tiny × (or +) in the corner on hover. Not on touch screens. */}
      {editing && !revealed && !swiping && (
        <button
          type="button"
          aria-label={actionLabel}
          tabIndex={-1}
          onClick={action}
          className={`absolute top-0.5 right-0.5 hidden rounded-sm p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-white [@media(hover:hover)]:block ${removed ? 'hover:bg-emerald-600' : 'hover:bg-destructive'}`}
        >
          {removed ? <Plus aria-hidden="true" className="size-3" /> : <X aria-hidden="true" className="size-3" />}
        </button>
      )}
    </td>
  )
}
