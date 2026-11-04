import { BrowserRouter, Route, Routes } from 'react-router'
import { AuthProvider } from '@/auth/AuthProvider'
import { useAuth } from '@/auth/context'
import { Header } from '@/components/Header'
import { AboutPage } from '@/pages/AboutPage'
import { AuthCallbackPage } from '@/pages/AuthCallbackPage'
import { GoalsPage } from '@/pages/GoalsPage'
import { HomePage } from '@/pages/HomePage'
import { SettingsPage } from '@/pages/SettingsPage'

// Signed in: the app. Signed out: the About page, whatever the address.
function Guarded() {
  const { session, loading } = useAuth()
  if (loading) return <p>Loading…</p>
  if (!session) return <AboutPage />
  return (
    <Routes>
      <Route path="/habits" element={<GoalsPage />} />
      <Route path="/settings" element={<SettingsPage session={session} />} />
      <Route path="*" element={<HomePage session={session} />} />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Header />
        <main className="p-3 text-lg max-[399px]:px-1 sm:p-6">
          <Routes>
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="*" element={<Guarded />} />
          </Routes>
        </main>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
