import { Link } from 'react-router'
import { useAuth } from '@/auth/context'
import { AccountMenu } from '@/components/AccountMenu'

// The bar across the top of every page. It stays put while the page scrolls underneath (sticky).
// Left: the site name (which goes home) and its tagline. Right: your picture, which opens the menu.
export function Header() {
  const { session, loading } = useAuth()

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-header/95 px-3 py-3 sm:px-6 backdrop-blur">
      {/* Name and tagline side by side on wider screens; the tagline drops underneath on phones. */}
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-3">
        <h1 className="text-2xl font-bold">
          <Link to="/">HabitTracker</Link>
        </h1>
        <p className="text-sm text-muted-foreground italic">Making progress, one day at a time</p>
      </div>
      {!loading && <AccountMenu user={session?.user} />}
    </header>
  )
}
