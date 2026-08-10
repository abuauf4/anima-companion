'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { LoadingScreen, LoginRequiredView, UnauthorizedView } from '@/components/layout/AuthViews'

/**
 * AuthGate — wraps protected customer pages (profile, orders).
 *
 * Behavior:
 * - While auth state is loading → show spinner
 * - If user is not logged in → show LoginRequiredView
 * - Otherwise → render children
 *
 * Mirrors the auth-guard logic previously baked into HashRouter.tsx.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (!user) return <LoginRequiredView />
  return <>{children}</>
}

/**
 * AdminGate — wraps /admin/* pages.
 *
 * - While auth state is loading → spinner
 * - If user is not admin → UnauthorizedView
 * - Otherwise → render children
 */
export function AdminGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (!user || user.role !== 'ADMIN') return <UnauthorizedView />
  return <>{children}</>
}

/**
 * GuestGate — wraps /login and /register pages.
 *
 * - If user is already logged in → redirect to home (`/`)
 * - Otherwise → render children (the login/register form)
 *
 * Uses a useEffect-based redirect to avoid returning a router object
 * during render (which would violate Server Component contract).
 */
export function GuestGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      router.replace('/')
    }
  }, [user, loading, router])

  if (loading) return <LoadingScreen />
  if (user) return <LoadingScreen />
  return <>{children}</>
}
