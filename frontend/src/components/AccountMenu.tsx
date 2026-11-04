import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import type { User } from '@supabase/supabase-js'
import { LoginDialog } from '@/auth/LoginDialog'
import { endDevSession } from '@/auth/devSession'
import { supabase } from '@/auth/supabase'
import { useTheme, type Theme } from '@/theme/theme'

// Google, Discord and Twitch hand Supabase a picture; email sign-ins don't, so those get a letter.
const pictureOf = (user: User): string | undefined => user.user_metadata?.avatar_url ?? user.user_metadata?.picture

const initialOf = (user: User) =>
  String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? '?')
    .charAt(0)
    .toUpperCase()

// Plans are made and changed right on the home page's week grid (edit mode), so the menu only needs these.
const links = [
  { to: '/habits', label: 'Habits' },
  { to: '/settings', label: 'Settings' },
]

// A plain grey head-and-shoulders, for visitors who aren't signed in.
function Silhouette() {
  return (
    <svg
      viewBox="0 0 40 40"
      aria-hidden="true"
      className="size-full bg-gray-300 text-gray-500 dark:bg-slate-600 dark:text-slate-400"
    >
      <circle cx="20" cy="15" r="7" fill="currentColor" />
      <path d="M6 38c0-8 6.3-13 14-13s14 5 14 13z" fill="currentColor" />
    </svg>
  )
}

// Two side-by-side buttons; the current one is filled in.
function ThemePicker() {
  const { theme, setTheme } = useTheme()
  const option = (value: Theme, label: string) => (
    <button
      type="button"
      aria-pressed={theme === value}
      onClick={() => setTheme(value)}
      className={`flex-1 rounded-md px-2 py-1 text-sm ${theme === value ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
    >
      {label}
    </button>
  )
  return (
    <div role="group" aria-label="Theme" className="flex gap-1 border-t px-3 py-2">
      {option('light', 'Light')}
      {option('dark', 'Dark')}
    </div>
  )
}

// The picture in the corner. Tap it and a little list drops down; tap anywhere else (or Esc) to close it.
// Signed in: your picture and the app pages. Signed out (no user): a grey silhouette and "Login", which pops up the login box.
export function AccountMenu({ user }: { user?: User }) {
  const [open, setOpen] = useState(false)
  const [loggingIn, setLoggingIn] = useState(false)
  const [pictureFailed, setPictureFailed] = useState(false)
  const menu = useRef<HTMLDivElement>(null)
  const picture = user && !pictureFailed ? pictureOf(user) : undefined

  useEffect(() => {
    if (!open) return
    const closeIfOutside = (event: MouseEvent) => {
      if (!menu.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', closeIfOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeIfOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <div ref={menu} className="relative">
      <button
        type="button"
        aria-label="Account menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex size-10 items-center justify-center overflow-hidden rounded-full bg-primary text-primary-foreground ring-offset-2 hover:ring-2 hover:ring-ring"
      >
        {!user ? (
          <Silhouette />
        ) : picture ? (
          // no-referrer: Google's picture links refuse requests that say which site they came from.
          <img
            src={picture}
            alt=""
            referrerPolicy="no-referrer"
            className="size-full object-cover"
            onError={() => setPictureFailed(true)}
          />
        ) : (
          <span className="text-lg font-semibold">{initialOf(user)}</span>
        )}
      </button>

      {open && (
        <nav
          aria-label="Account"
          className="absolute right-0 mt-2 flex w-48 flex-col rounded-md border bg-popover py-1 text-base text-popover-foreground shadow-md"
        >
          {!user && (
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setLoggingIn(true)
              }}
              className="px-3 py-2 text-left hover:bg-accent"
            >
              Login
            </button>
          )}
          {user?.email && <p className="truncate px-3 py-2 text-sm text-muted-foreground">{user.email}</p>}
          {/* Signed in: Habits and Settings. Everyone gets About, last. */}
          {[...(user ? links : []), { to: '/about', label: 'About' }].map((link) => (
            <Link key={link.to} to={link.to} onClick={() => setOpen(false)} className="px-3 py-2 hover:bg-accent">
              {link.label}
            </Link>
          ))}
          <ThemePicker />
          {user && (
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                endDevSession()
                supabase.auth.signOut()
              }}
              className="border-t px-3 py-2 text-left hover:bg-accent"
            >
              Sign out
            </button>
          )}
        </nav>
      )}
      {!user && <LoginDialog open={loggingIn} onClose={() => setLoggingIn(false)} />}
    </div>
  )
}
