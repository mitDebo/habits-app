import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'

const corners = 'rounded-[5px]'

// Asked when leaving edit mode with unsaved changes: Save, Discard (put everything back), or Keep editing.
// Esc or clicking the dark area counts as Keep editing, so nothing is lost by accident.
export function SaveChangesDialog({
  open,
  onSave,
  onDiscard,
  onKeepEditing,
}: {
  open: boolean
  onSave: () => void
  onDiscard: () => void
  onKeepEditing: () => void
}) {
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
      aria-labelledby="save-changes-title"
      onClose={onKeepEditing}
      onClick={(event) => event.target === dialog.current && onKeepEditing()}
      className="m-auto w-[calc(100%-1.5rem)] max-w-sm rounded-xl border bg-popover p-0 text-popover-foreground shadow-xl backdrop:bg-black/60"
    >
      {open && (
        <div className="flex flex-col gap-4 p-5">
          <h2 id="save-changes-title" className="text-xl font-semibold">
            Save your changes?
          </h2>
          <p className="text-sm text-muted-foreground">
            Discard puts your schedules back the way they were before you started editing.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" className={corners} onClick={onKeepEditing}>
              Keep editing
            </Button>
            <Button type="button" variant="outline" className={corners} onClick={onDiscard}>
              Discard
            </Button>
            <Button type="button" className={corners} onClick={onSave} autoFocus>
              Save
            </Button>
          </div>
        </div>
      )}
    </dialog>
  )
}
