'use client'

import { useEffect, useState, useCallback } from 'react'
import { create } from 'zustand'

export interface User {
  id: string
  email: string
  name: string
  phone: string | null
  role: 'CUSTOMER' | 'ADMIN'
}

/**
 * Global auth store (Zustand) — shared state across ALL components that call useAuth().
 *
 * Previously useAuth used local useState, which meant each component had its own
 * auth state. LoginView could refresh its state but HashRouter's state stayed null,
 * causing 'Akses Ditolak' immediately after login.
 *
 * With Zustand, all components see the same user state — when LoginView refreshes,
 * HashRouter immediately sees the updated user too.
 */
interface AuthState {
  user: User | null
  loading: boolean
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
}))

export function useAuth() {
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  const setUser = useAuthStore((s) => s.setUser)
  const setLoading = useAuthStore((s) => s.setLoading)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me')
      const data = await res.json()
      setUser(data.user || null)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [setUser, setLoading])

  useEffect(() => {
    refresh()
  }, [refresh])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    window.location.hash = '/'
  }, [setUser])

  return { user, loading, logout, refresh }
}
