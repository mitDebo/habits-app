import { Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'

// The edit-mode tour after your first goal, in order.
export type Tip = 'length' | 'remove' | 'tabs' | 'save'

const tips: Record<Tip, { step: number; text: string }> = {
  length: {
    step: 1,
    text: 'Nice, your first habit! Schedules can be any length: the − and + buttons on each side move its start and end.',
  },
  remove: {
    step: 2,
    text: 'Skipping a day? Swipe it left (or point at it and click the ×) to take it off this schedule. Swipe right to put it back.',
  },
  tabs: {
    step: 3,
    text: "You can have up to 5 schedules, as tabs along the bottom. Tap + to start another, and tap a schedule's name to rename it.",
  },
  save: {
    step: 4,
    text: "That's it! Tap the gear to save and finish.",
  },
}

// A note under the grid explaining the tip that's showing (the thing it's about is outlined or has an arrow
// at it). Next skips to the next tip; "Skip tips" ends the tour.
export function TipBanner({ tip, onNext, onSkip }: { tip: Tip; onNext: () => void; onSkip: () => void }) {
  const { step, text } = tips[tip]
  return (
    <div
      role="status"
      className="mt-4 flex max-w-sm items-start gap-3 rounded-lg border border-primary/40 bg-popover p-3 text-sm text-popover-foreground shadow-md"
    >
      <Lightbulb aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="flex flex-1 flex-col gap-2">
        <p>{text}</p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">Tip {step} of 4</span>
          <div className="flex gap-2">
            {tip !== 'save' && (
              <>
                <Button size="sm" variant="ghost" className="rounded-[5px]" onClick={onSkip}>
                  Skip tips
                </Button>
                <Button size="sm" variant="outline" className="rounded-[5px]" onClick={onNext}>
                  Next
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
