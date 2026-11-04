import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { authCallbackUrl } from '@/auth/context'
import { devSignInAvailable, startDevSession } from '@/auth/devSession'
import { supabase } from '@/auth/supabase'

// Corners for the box's buttons and email field: a little rounded, less than the app's default.
const corners = 'rounded-[5px]'

const providers = [
  { id: 'google', label: 'Google' },
  { id: 'discord', label: 'Discord' },
  { id: 'twitch', label: 'Twitch' },
] as const

// A box that pops up over the page, which goes dark behind it. Close it with the ×, Esc,
// or by clicking the dark area. It uses the browser's own <dialog>, which also keeps the
// keyboard inside the box while it's open.
export function LoginDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
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
      aria-labelledby="login-title"
      onClose={onClose}
      // The dialog element itself is only "hit" on the dark area around the box (the box is the inner div).
      onClick={(event) => event.target === dialog.current && onClose()}
      className="m-auto w-full max-w-sm rounded-xl border bg-popover p-0 text-popover-foreground shadow-xl backdrop:bg-black/60"
    >
      {/* Only drawn while open, so it starts fresh each time. */}
      {open && <LoginForm onClose={onClose} />}
    </dialog>
  )
}

// The pop-up's contents: a title and close button, then the sign-in options.
function LoginForm({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h2 id="login-title" className="text-2xl font-semibold">
          Login
        </h2>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="rounded-md px-2 text-2xl leading-none text-muted-foreground hover:bg-accent"
        >
          ×
        </button>
      </div>
      <SignInOptions onDone={onClose} autoFocus />
    </div>
  )
}

// The ways to sign in: email first (a magic link: no password), then the three "continue with" buttons.
// Used in the Login pop-up and right on the About page. Signing in the first time also makes the account.
// `onDone`: called after the dev-only "Skip sign-in" (to close the pop-up). `autoFocus`: put the cursor in
// the email box straight away (in the pop-up, not on the About page, where it would jump the page down).
export function SignInOptions({ onDone, autoFocus = false }: { onDone?: () => void; autoFocus?: boolean }) {
  // Its own id, so the About page's form and the pop-up's never clash.
  const emailId = useId()
  const [email, setEmail] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sendMagicLink(event: FormEvent) {
    event.preventDefault()
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: authCallbackUrl() },
    })
    if (error) setError(error.message)
    else setEmailSent(true)
  }

  async function loginWith(provider: (typeof providers)[number]['id']) {
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: authCallbackUrl() },
    })
    if (error) setError(error.message)
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={sendMagicLink} className="flex flex-col gap-2">
        <label htmlFor={emailId} className="text-sm font-medium">
          Email
        </label>
        {/* White in both light and dark mode, with dark text so it's always readable. */}
        <input
          id={emailId}
          type="email"
          required
          autoFocus={autoFocus}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={`${corners} border border-gray-300 bg-white px-3 py-2 text-gray-900 [color-scheme:light]`}
        />
        <Button type="submit" className={corners}>
          Email me a login link
        </Button>
      </form>

      {emailSent && <p>Check your email for a login link.</p>}

      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="flex flex-col gap-2">
        {providers.map((provider) => (
          <Button key={provider.id} variant="outline" className={corners} onClick={() => loginWith(provider.id)}>
            Continue with {provider.label}
          </Button>
        ))}
      </div>

      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}

      {/* Only when running on your own computer with `npm run dev` (never on the live site): skip signing in
          and use a pretend account, for trying the mockup from a phone. */}
      {devSignInAvailable && (
        <Button
          variant="ghost"
          className={`${corners} border border-dashed text-muted-foreground`}
          onClick={() => {
            startDevSession()
            onDone?.()
          }}
        >
          Skip sign-in (dev)
        </Button>
      )}
    </div>
  )
}
