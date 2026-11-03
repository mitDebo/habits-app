import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import type { Session } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { getProfile, updateProfile, type WeekStart } from '@/profile/api'
import { resetPrototype } from '@/prototype/storage'
import {
  dateFormats,
  formatDate,
  formatShortDate,
  saveDateFormat,
  savedDateFormat,
  saveShortDateFormat,
  savedShortDateFormat,
  shortDateFormats,
  type DateFormatId,
  type ShortDateFormatId,
} from '@/settings/dateFormat'

// Each date format is shown as an example, using today's date.
const exampleDay = new Date().toISOString().slice(0, 10)

const selectClass = 'rounded-md border bg-background px-2 py-1'

type Status = { kind: 'idle' } | { kind: 'saved' } | { kind: 'error'; messages: string[] }

export function SettingsPage({ session }: { session: Session }) {
  const [timeZone, setTimeZone] = useState<string | null>(null)
  const [weekStart, setWeekStart] = useState<WeekStart>('sunday')
  const [dateFormat, setDateFormat] = useState<DateFormatId>(savedDateFormat)
  const [shortDateFormat, setShortDateFormat] = useState<ShortDateFormatId>(savedShortDateFormat)
  const [loadFailed, setLoadFailed] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  useEffect(() => {
    getProfile(session.access_token).then((profile) => {
      if (!profile) return setLoadFailed(true)
      setTimeZone(profile.timeZone)
      setWeekStart(profile.weekStart)
    })
  }, [session.access_token])

  // Every zone the browser knows, plus the saved one in case it isn't listed.
  const zones = useMemo(() => {
    const all = Intl.supportedValuesOf('timeZone')
    return timeZone && !all.includes(timeZone) ? [timeZone, ...all] : all
  }, [timeZone])

  const save = async () => {
    if (!timeZone) return
    saveDateFormat(dateFormat)
    saveShortDateFormat(shortDateFormat)
    const result = await updateProfile(session.access_token, { timeZone, weekStart })
    setStatus(result.ok ? { kind: 'saved' } : { kind: 'error', messages: result.errors })
  }

  if (loadFailed) return <p>Couldn't load your settings.</p>
  if (!timeZone) return <p>Loading…</p>

  return (
    <section className="flex flex-col items-start gap-3">
      <h2 className="text-xl font-semibold">Settings</h2>

      <label className="flex flex-col gap-1">
        Time zone
        <select
          className={selectClass}
          value={timeZone}
          onChange={(e) => {
            setTimeZone(e.target.value)
            setStatus({ kind: 'idle' })
          }}
        >
          {zones.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        Week starts on
        <select
          className={selectClass}
          value={weekStart}
          onChange={(e) => {
            setWeekStart(e.target.value as WeekStart)
            setStatus({ kind: 'idle' })
          }}
        >
          <option value="sunday">Sunday</option>
          <option value="monday">Monday</option>
        </select>
      </label>

      <label className="flex flex-col gap-1">
        Date format
        <select
          className={selectClass}
          value={dateFormat}
          onChange={(e) => {
            setDateFormat(e.target.value as DateFormatId)
            setStatus({ kind: 'idle' })
          }}
        >
          {dateFormats.map((format) => (
            <option key={format.id} value={format.id}>
              {formatDate(exampleDay, format.id)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        Short date format (the dates over each day)
        <select
          className={selectClass}
          value={shortDateFormat}
          onChange={(e) => {
            setShortDateFormat(e.target.value as ShortDateFormatId)
            setStatus({ kind: 'idle' })
          }}
        >
          {shortDateFormats.map((format) => (
            <option key={format.id} value={format.id}>
              {formatShortDate(exampleDay, format.id)}
            </option>
          ))}
        </select>
      </label>

      <Button onClick={save}>Save</Button>

      {status.kind === 'saved' && <p>Settings saved.</p>}
      {status.kind === 'error' && (
        <p role="alert" className="text-destructive">
          {status.messages.join(' ')}
        </p>
      )}

      <ResetPrototypeData />

      <Link to="/" className="underline">
        Back
      </Link>
    </section>
  )
}

// Wipes the prototype's goals and plans in this browser (after a "yes"), back to how a new user starts: no
// goals and one empty plan for this week.
function ResetPrototypeData() {
  const [step, setStep] = useState<'ask' | 'confirm' | 'done'>('ask')
  return (
    <div className="mt-4 flex flex-col items-start gap-2 border-t pt-4">
      <h3 className="font-semibold">Prototype data</h3>
      <p className="text-base text-muted-foreground">
        Your habits and plans are kept in this browser for now. Resetting deletes them all here.
      </p>
      {step === 'ask' && (
        <Button variant="outline" onClick={() => setStep('confirm')}>
          Reset prototype data
        </Button>
      )}
      {step === 'confirm' && (
        <div className="flex items-center gap-2">
          <span className="text-base">Delete all your habits and plans?</span>
          <Button
            variant="destructive"
            onClick={() => {
              resetPrototype()
              setStep('done')
            }}
          >
            Reset
          </Button>
          <Button variant="outline" onClick={() => setStep('ask')}>
            Cancel
          </Button>
        </div>
      )}
      {step === 'done' && <p className="text-base">Done. You're starting fresh.</p>}
    </div>
  )
}
