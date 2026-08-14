'use client'

import { useEffect, useState } from 'react'
import { useHashRouter } from '@/lib/router'
import { safeInternalPath } from '@/lib/redirect'
import { Button } from '@/components/ui/button'

/**
 * GoogleSignInButton — renders a "Masuk dengan Google" button that
 * redirects to /api/auth/google when clicked.
 *
 * The button only renders if /api/auth/google-config returns
 * `{ enabled: true }`. If Google OAuth env vars are NOT configured,
 * the button is hidden — we do NOT fake a Google login when it's
 * unconfigured.
 *
 * The `next` path is taken from the current URL's `?next=` query param
 * (so the user lands back on the page they were trying to reach after
 * Google redirects), validated via safeInternalPath() — the same
 * open-redirect defense used by the password login flow.
 *
 * `next` is passed as `?next=<safePath>` to /api/auth/google, which
 * re-validates it and signs it into the OAuth state token.
 */
export function GoogleSignInButton({ label = 'Masuk dengan Google' }: { label?: string }) {
  const { route } = useHashRouter()
  const [enabled, setEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/google-config')
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setEnabled(!!data.enabled)
      })
      .catch(() => {
        if (!cancelled) setEnabled(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (enabled === null) {
    // Still loading — render a placeholder button (disabled) to prevent
    // layout shift while the config check is in flight.
    return (
      <Button variant="outline" className="w-full gap-2" disabled>
        <GoogleIcon />
        {label}
      </Button>
    )
  }

  if (!enabled) {
    // Google OAuth not configured — render nothing. This is the "no fake
    // behavior" path: we do not show a button that can't actually do
    // anything.
    return null
  }

  const nextPath = safeInternalPath(route.query.get('next'))
  const href = nextPath
    ? `/api/auth/google?next=${encodeURIComponent(nextPath)}`
    : '/api/auth/google'

  return (
    <a href={href} className="block">
      <Button variant="outline" className="w-full gap-2">
        <GoogleIcon />
        {label}
      </Button>
    </a>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.455 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58z"
      />
    </svg>
  )
}
