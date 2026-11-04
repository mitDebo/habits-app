import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { frameEdges } from '@/week/frame'

const REVEAL_PX = 64 // how far a goal's name slides left to show Remove
const DECIDE_PX = 8 // how far the pointer moves before we decide: swipe (sideways) or reorder (up/down)

type Props = {
  name: string
  // The row's stripe, so the sliding name looks like part of its row.
  tintClass: string
  // Being dragged up or down: draws its part of the frame around the goal (left, top and bottom edges).
  framed: boolean
  // Some goal is being dragged up or down: hide the hover × so it doesn't get in the way.
  reordering: boolean
  editing: boolean
  // Where this goal is in the list, and how many there are.
  index: number
  count: number
  // Whether Remove is showing on this cell, and a way to show/hide it (only one at a time, across the grid).
  revealed: boolean
  onReveal: (shown: boolean) => void
  // Dragging up or down to reorder: when it starts, as it moves (how far up/down, in pixels), and when you
  // let go. The table does the floating and gap-opening.
  onDragStart: () => void
  onDragMove: (offsetPx: number) => void
  onDragEnd: () => void
  // Moving with the keyboard: straight to spot `to`.
  onMove: (to: number) => void
  onRemove: () => void
}

// A goal's name at the left of its row. Out of edit mode it's just the name. In edit mode it's the goal's
// handle:
// - swipe it left to slide out a red Remove button (tap Remove, or tap anywhere else to slide it back)
// - drag it up or down to move the goal; it moves live as you pass other rows
// - on computers with a mouse, hovering shows an × that removes the goal straight away
// - with the keyboard: Tab to it, ↑ ↓ to move, Delete to remove
export function GoalNameCell(props: Props) {
  const { name, tintClass, framed, reordering, editing, index, count, revealed, onReveal, onDragStart, onDragMove, onDragEnd, onMove, onRemove } =
    props
  const cell = useRef<HTMLTableCellElement>(null)
  // The drag in progress: where it started, and (once decided) whether it's a swipe or a reorder.
  const drag = useRef<{ x: number; y: number; mode: 'undecided' | 'swipe' | 'reorder' } | null>(null)
  const [slide, setSlide] = useState(0) // how far the name is slid left right now (while swiping)
  const [swiping, setSwiping] = useState(false)

  // Remove is showing: tapping anywhere outside this cell slides the name back.
  useEffect(() => {
    if (!revealed) return
    const closeIfOutside = (event: PointerEvent) => {
      if (!cell.current?.contains(event.target as Node)) onReveal(false)
    }
    document.addEventListener('pointerdown', closeIfOutside)
    return () => document.removeEventListener('pointerdown', closeIfOutside)
  }, [revealed, onReveal])

  const offset = swiping ? slide : revealed ? -REVEAL_PX : 0
  const clamp = (n: number) => Math.min(count - 1, Math.max(0, n))

  const endDrag = () => {
    const mode = drag.current?.mode
    drag.current = null
    if (mode === 'swipe') {
      // Let go more than halfway: stay open. Otherwise slide back.
      onReveal(slide < -REVEAL_PX / 2)
      setSwiping(false)
      setSlide(0)
    } else if (mode === 'reorder') onDragEnd()
  }

  return (
    <th
      ref={cell}
      scope="row"
      tabIndex={editing ? 0 : -1}
      aria-label={editing ? `${name}. Swipe left to remove, drag up or down to move.` : undefined}
      className={`group relative overflow-hidden p-0 text-left text-sm font-medium ${editing ? 'cursor-grab touch-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:cursor-grabbing' : ''}`}
      onPointerDown={(event) => {
        if (!editing || (event.target as HTMLElement).closest('button')) return
        event.currentTarget.setPointerCapture(event.pointerId)
        drag.current = { x: event.clientX, y: event.clientY, mode: 'undecided' }
      }}
      onPointerMove={(event) => {
        const d = drag.current
        if (!d) return
        const dx = event.clientX - d.x
        const dy = event.clientY - d.y
        if (d.mode === 'undecided') {
          if (Math.max(Math.abs(dx), Math.abs(dy)) < DECIDE_PX) return
          d.mode = Math.abs(dx) > Math.abs(dy) ? 'swipe' : 'reorder'
          if (d.mode === 'swipe') setSwiping(true)
          else onDragStart()
        }
        if (d.mode === 'swipe') {
          // Starting from wherever it was (open or closed), never further than fully open or closed.
          const from = revealed ? -REVEAL_PX : 0
          setSlide(Math.min(0, Math.max(-REVEAL_PX, from + dx)))
        } else onDragMove(dy)
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={(event) => {
        if (!editing) return
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          const to = clamp(index + (event.key === 'ArrowUp' ? -1 : 1))
          onMove(to)
          // The goal now sits `to - index` rows away: move the keyboard focus there with it.
          requestAnimationFrame(() => {
            let row = cell.current?.closest('tr') ?? null
            for (let step = 0; step < Math.abs(to - index); step++)
              row = (to > index ? row?.nextElementSibling : row?.previousElementSibling) as HTMLTableRowElement | null
            row?.querySelector<HTMLElement>('th[tabindex="0"]')?.focus()
          })
        } else if (event.key === 'Delete' || event.key === 'Backspace') onRemove()
        else return
        event.preventDefault()
      }}
    >
      {/* Behind the name: the red Remove button, uncovered as the name slides left. Fully hidden unless a
          swipe is under way or it's open, so no red edge can peek out. */}
      {editing && (
        <button
          type="button"
          tabIndex={revealed ? 0 : -1}
          aria-hidden={!revealed}
          onClick={onRemove}
          className={`absolute inset-y-0 right-0 bg-destructive px-2 text-xs font-semibold text-white ${swiping || revealed ? 'visible' : 'invisible'}`}
          style={{ width: REVEAL_PX }}
        >
          Remove
        </button>
      )}
      {/* The name, sliding over the Remove button. Solid page colour with the row's stripe on top, so it
          looks like part of its row and fully covers Remove until it slides. On computers with a mouse it
          keeps a strip of room on its right (always, so nothing moves) for the hover ×.
          Fixed width, so every name column is the same size: names wrap onto two lines, and a long single
          word breaks wherever it has to. Wider on computers with a mouse, where there's room. */}
      <div
        className={`relative flex h-11 w-20 items-center max-[399px]:w-16 bg-background px-1.5 leading-tight [overflow-wrap:anywhere] [@media(hover:hover)]:w-32 [@media(hover:hover)]:pr-6 ${swiping ? '' : 'transition-transform duration-200 ease-out motion-reduce:transition-none'}`}
        style={{ transform: `translateX(${offset}px)`, boxShadow: framed ? frameEdges({ left: true }) : undefined }}
      >
        <span aria-hidden="true" className={`absolute inset-0 ${tintClass}`} />
        <span className="relative">{name}</span>
      </div>
      {/* Computers with a mouse: an × on hover that removes the goal. Not shown on touch screens. */}
      {editing && !revealed && !reordering && (
        <button
          type="button"
          aria-label={`Remove ${name}`}
          tabIndex={-1}
          onClick={onRemove}
          className="absolute top-1/2 right-1 hidden -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-white [@media(hover:hover)]:block"
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      )}
    </th>
  )
}
