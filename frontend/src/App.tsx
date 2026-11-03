import { BrowserRouter, Route, Routes } from 'react-router'
import { AuthProvider } from '@/auth/AuthProvider'
import { useAuth } from '@/auth/context'
import { Header } from '@/components/Header'
import { AuthCallbackPage } from '@/pages/AuthCallbackPage'
import { GoalsPage } from '@/pages/GoalsPage'
import { HomePage } from '@/pages/HomePage'
import { LoggedOutPage } from '@/pages/LoggedOutPage'
import { SettingsPage } from '@/pages/SettingsPage'

// Signed in: the app. Signed out: the placeholder front page, whatever the address.
function Guarded() {
  const { session, loading } = useAuth()
  if (loading) return <p>Loading…</p>
  if (!session) return <LoggedOutPage />
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
        <main className="p-3 text-lg sm:p-6">
          <Routes>
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="*" element={<Guarded />} />
          </Routes>
        </main>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
