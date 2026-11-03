import { useEffect, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'

export const MAX_SHEETS = 5
const MAX_NAME = 20
const CARD_PX = 140 // every tab ("card") is this wide; the one in front shows its full name
const SLIVER_PX = 24 // how much of each card behind peeks out
const SWIPE_PX = 40 // how far a swipe on the front card must go to flip to the next plan

type Props = {
  sheets: { id: number; name: string }[]
  activeId: number
  editing: boolean
  onSelect: (id: number) => void
  onRename: (id: number, name: string) => void
  onAdd: () => void
  onRemove: (id: number) => void
}

// A short label for a card's sliver: the first letter of each word, plus any number ("Plan 2" → "P2",
// "Morning run" → "MR", "Gym" → "G"). At most two characters.
const shortLabel = (name: string) =>
  name
    .split(/\s+/)
    .map((word) => (/^\d+$/.test(word) ? word : word.charAt(0).toUpperCase()))
    .join('')
    .slice(0, 2)

// The plan tabs, stacked like cards along the bottom of the grid, one per plan.
// - The selected plan's card is in front, with its full name. Plans before it are stacked behind its left
//   edge and plans after it behind its right edge; each shows a sliver with a short label.
// - Tap a sliver to bring that plan to the front (the cards slide), or swipe the front card left or right
//   to flip to the next or previous plan. With the keyboard: ← and →.
// - Shown when there's more than one plan, or in edit mode (their space always stays, so nothing moves).
// - In edit mode: tap the front card's name to rename it (Enter or tapping away saves, Esc cancels); its ×
//   deletes the plan after a second tap on "Delete?" (tap anywhere else to cancel; the last plan can't be
//   deleted); the + adds a plan, up to five.
export function SheetTabs({ sheets, activeId, editing, onSelect, onRename, onAdd, onRemove }: Props) {
  const shown = editing || sheets.length > 1
  const canAdd = editing && sheets.length < MAX_SHEETS
  const canRemove = editing && sheets.length > 1
  const [renaming, setRenaming] = useState<{ id: number; name: string } | null>(null)
  const [confirmingId, setConfirming] = useState<number | null>(null)
  // "Delete?" only ever shows in edit mode (leaving edit mode cancels it).
  const confirming = editing ? confirmingId : null
  const confirmCard = useRef<HTMLButtonElement>(null)
  const swipe = useRef<{ x: number; swiped: boolean } | null>(null)

  useEffect(() => {
    if (confirming === null) return
    const cancelIfOutside = (event: PointerEvent) => {
      if (!confirmCard.current?.contains(event.target as Node)) setConfirming(null)
    }
    document.addEventListener('pointerdown', cancelIfOutside)
    return () => document.removeEventListener('pointerdown', cancelIfOutside)
  }, [confirming])

  const front = Math.max(0, sheets.findIndex((s) => s.id === activeId))
  const flip = (step: number) => {
    const next = sheets[front + step]
    if (next) onSelect(next.id)
  }

  // Where each card sits and how it stacks: the front card is on top of everything; cards before it step
  // right one sliver at a time, each on top of the last; cards after it are tucked under its right edge,
  // each one sliver further out and further underneath.
  const place = (index: number) => ({
    left: index * SLIVER_PX,
    zIndex: index === front ? sheets.length + 1 : index < front ? index + 1 : sheets.length - (index - front),
  })
  const stackPx = (sheets.length - 1) * SLIVER_PX + CARD_PX

  const fade = (visible: boolean) =>
    `transition-[opacity,visibility] duration-500 ease-in-out motion-reduce:transition-none ${visible ? 'visible opacity-100' : 'invisible opacity-0'}`
  const cardShape =
    'absolute top-0 rounded-b-md border border-t-0 text-sm whitespace-nowrap transition-[left] duration-300 ease-out motion-reduce:transition-none'

  const finishRename = () => {
    if (renaming) {
      const name = renaming.name.trim()
      if (name) onRename(renaming.id, name)
    }
    setRenaming(null)
  }

  return (
    <div
      role="tablist"
      aria-label="Plans"
      aria-hidden={!shown}
      className={`relative h-8 ${fade(shown)}`}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') flip(-1)
        else if (event.key === 'ArrowRight') flip(1)
      }}
    >
      {sheets.map((sheet, index) => {
        const style = { ...place(index), width: CARD_PX }

        // A card behind: only its sliver shows, with the short label at the visible end.
        if (index !== front)
          return (
            <button
              key={sheet.id}
              type="button"
              role="tab"
              aria-selected={false}
              aria-label={sheet.name}
              title={sheet.name}
              tabIndex={-1}
              onClick={() => onSelect(sheet.id)}
              className={`${cardShape} flex h-7 items-center bg-muted px-1 text-xs text-muted-foreground hover:text-foreground ${index < front ? 'justify-start' : 'justify-end'}`}
              style={style}
            >
              <span className="w-[18px] text-center">{shortLabel(sheet.name)}</span>
            </button>
          )

        if (renaming?.id === sheet.id)
          return (
            <input
              key={sheet.id}
              aria-label="Plan name"
              autoFocus
              maxLength={MAX_NAME}
              value={renaming.name}
              onChange={(event) => setRenaming({ id: sheet.id, name: event.target.value })}
              onBlur={finishRename}
              onKeyDown={(event) => {
                event.stopPropagation()
                if (event.key === 'Enter') finishRename()
                if (event.key === 'Escape') setRenaming(null)
              }}
              className={`${cardShape} h-8 bg-white px-2 text-gray-900 [color-scheme:light]`}
              style={style}
            />
          )

        if (confirming === sheet.id)
          return (
            <button
              key={sheet.id}
              ref={confirmCard}
              type="button"
              aria-label={`Delete ${sheet.name} and all its habits and ticks`}
              onClick={() => {
                setConfirming(null)
                onRemove(sheet.id)
              }}
              className={`${cardShape} h-8 border-destructive bg-destructive font-semibold text-white`}
              style={style}
            >
              Delete?
            </button>
          )

        // The front card: the selected plan. Swipe it to flip plans; in edit mode, tap its name to rename it.
        return (
          <div
            key={sheet.id}
            role="tab"
            aria-selected
            tabIndex={shown ? 0 : -1}
            className={`${cardShape} flex h-8 touch-pan-y items-center gap-1 bg-tab-front px-2 font-semibold text-foreground shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none`}
            style={style}
            onPointerDown={(event) => (swipe.current = { x: event.clientX, swiped: false })}
            onPointerUp={(event) => {
              const start = swipe.current
              if (!start) return
              const dx = event.clientX - start.x
              if (Math.abs(dx) >= SWIPE_PX) {
                start.swiped = true
                // Swipe left: the next plan (the one to the right) comes forward; swipe right: the previous.
                flip(dx < 0 ? 1 : -1)
              }
            }}
            onClickCapture={(event) => {
              if (swipe.current?.swiped) {
                event.stopPropagation()
                event.preventDefault()
              }
              swipe.current = null
            }}
          >
            <button
              type="button"
              tabIndex={-1}
              disabled={!editing}
              title={editing ? 'Tap to rename' : undefined}
              onClick={() => setRenaming({ id: sheet.id, name: sheet.name })}
              className="min-w-0 flex-1 truncate text-left disabled:cursor-default"
            >
              {sheet.name}
            </button>
            {canRemove && (
              <button
                type="button"
                aria-label={`Delete ${sheet.name}`}
                onClick={() => setConfirming(sheet.id)}
                className="rounded-sm p-0.5 text-muted-foreground hover:bg-destructive hover:text-white"
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
            )}
          </div>
        )
      })}
      {/* Adds a plan, just past the stack. Only in edit mode, and only while there are fewer than five. */}
      <button
        type="button"
        aria-label="Add plan"
        aria-hidden={!canAdd}
        tabIndex={canAdd ? 0 : -1}
        onClick={onAdd}
        className={`absolute top-0 flex h-8 items-center rounded-b-md border border-t-0 bg-muted px-2 text-muted-foreground transition-[left,opacity,visibility] duration-300 ease-out hover:text-foreground motion-reduce:transition-none ${fade(canAdd)}`}
        style={{ left: stackPx + 4 }}
      >
        <Plus aria-hidden="true" className="size-4" />
      </button>
    </div>
  )
}
