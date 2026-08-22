'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'

const DEFAULT_ANNOUNCEMENTS = [
  '🚚 Gratis ongkir min Rp 150.000',
  '⏰ Flash Sale 20% — berakhir segera!',
  '🎁 Subscribe & Save hemat 15% setiap pesanan',
  '🩺 Konsultasi vet gratis 24/7 via WhatsApp',
]

/**
 * Promotional state machine — derived purely from absolute UTC timestamps.
 *
 *   'before'  → now < startAt  (countdown ticks toward startAt)
 *   'during'  → startAt ≤ now ≤ endAt  (countdown ticks toward endAt)
 *   'after'   → now > endAt  (promo is over — caller falls back to rotating
 *                              announcements; we never render in this state)
 *
 * `now` is captured client-side via Date.now() — UTC milliseconds, immune
 * to device timezone. The admin's "23 Aug 2026 00:00 Asia/Jakarta" was
 * converted to a UTC ISO string in the admin UI before being sent to the
 * server, so the server-stored timestamps are already absolute UTC.
 */
type PromoPhase = 'before' | 'during' | 'after'

interface PromoState {
  phase: PromoPhase
  /** Countdown target — the absolute ms timestamp the bar counts down to. */
  targetMs: number | null
  /** Display text (already resolved from promoTextBefore / promoTextDuring). */
  text: string
  /** Optional CTA link from settings.promoLink. */
  link: string | null
}

/**
 * The subset of SiteSetting fields the promo bar needs.
 * Kept explicit so the component doesn't break if new fields are added
 * to SiteSetting later (defensive interface).
 */
interface PromoSettings {
  promoActive: boolean
  promoTitle: string
  promoStartAt: string | null
  promoEndAt: string | null
  promoCountdown: boolean
  promoTextBefore: string
  promoTextDuring: string
  promoLink: string
}

const NO_PROMO: PromoSettings = {
  promoActive: false,
  promoTitle: '',
  promoStartAt: null,
  promoEndAt: null,
  promoCountdown: true,
  promoTextBefore: '',
  promoTextDuring: '',
  promoLink: '',
}

/**
 * Resolve the promo state from settings + the current time.
 *
 * Returns null when:
 *   - promoActive is false, OR
 *   - promoActive is true but startAt/endAt are missing (misconfigured), OR
 *   - phase is 'after' (promo ended — caller falls back to announcements).
 *
 * Pure function — safe to call on every render. The state may flip from
 * 'before' → 'during' → 'after' as time passes; the caller re-runs this
 * on a 1s tick so the transition happens at the exact moment the
 * timestamps cross.
 */
function resolvePromoState(s: PromoSettings, nowMs: number): PromoState | null {
  if (!s.promoActive) return null
  if (!s.promoStartAt || !s.promoEndAt) return null

  const startMs = new Date(s.promoStartAt).getTime()
  const endMs = new Date(s.promoEndAt).getTime()
  if (!isFinite(startMs) || !isFinite(endMs) || startMs >= endMs) return null

  if (nowMs < startMs) {
    return {
      phase: 'before',
      targetMs: startMs,
      // Title takes precedence when before-text is empty — friendly default.
      text: s.promoTextBefore || `${s.promoTitle} mulai dalam`,
      link: s.promoLink || null,
    }
  }
  if (nowMs <= endMs) {
    return {
      phase: 'during',
      targetMs: endMs,
      text: s.promoTextDuring || `🔥 ${s.promoTitle}`,
      link: s.promoLink || null,
    }
  }
  // after — promo ended, suppress rendering (caller falls back to
  // rotating announcements).
  return null
}

/** Decompose a millisecond delta into dd/hh/mm/ss parts. */
function decomposeDelta(ms: number) {
  const diff = Math.max(0, ms)
  const days = Math.floor(diff / 86_400_000)
  const hours = Math.floor((diff % 86_400_000) / 3_600_000)
  const minutes = Math.floor((diff % 3_600_000) / 60_000)
  const seconds = Math.floor((diff % 60_000) / 1_000)
  return { days, hours, minutes, seconds }
}

/**
 * AnnouncementBar — sits ABOVE the navbar.
 *
 * Behavior:
 *   1. If a promo campaign is active AND in 'before' or 'during' phase:
 *      render the campaign text + live countdown (if promoCountdown is on).
 *      This takes priority over the rotating announcements.
 *   2. Otherwise (promo inactive / not configured / ended):
 *      render the rotating announcement1–4 (existing behavior).
 *
 * Countdown is realtime (1s tick) and computed from absolute UTC
 * timestamps — no server or device timezone assumption leaks in.
 *
 * Non-sticky — scrolls away when the user scrolls down.
 */
export function AnnouncementBar() {
  const [announcements, setAnnouncements] = useState<string[]>(DEFAULT_ANNOUNCEMENTS)
  const [announcementIdx, setAnnouncementIdx] = useState(0)
  const [promoSettings, setPromoSettings] = useState<PromoSettings>(NO_PROMO)
  const [now, setNow] = useState(() => Date.now())

  // Fetch home payload once on mount. We only need:
  //   - settings.promo* (campaign fields)
  //   - settings.announcement1..4 (rotating announcements fallback)
  useEffect(() => {
    let cancelled = false
    fetch('/api/home')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        const s = data?.settings
        if (!s) return
        const list = [s.announcement1, s.announcement2, s.announcement3, s.announcement4]
          .filter((a: string) => a && a.trim().length > 0)
        if (list.length > 0) setAnnouncements(list)
        setPromoSettings({
          promoActive: !!s.promoActive,
          promoTitle: s.promoTitle ?? '',
          promoStartAt: s.promoStartAt ?? null,
          promoEndAt: s.promoEndAt ?? null,
          promoCountdown: s.promoCountdown !== false,
          promoTextBefore: s.promoTextBefore ?? '',
          promoTextDuring: s.promoTextDuring ?? '',
          promoLink: s.promoLink ?? '',
        })
      })
      .catch(() => {
        // silent — announcement bar is non-critical
      })
    return () => { cancelled = true }
  }, [])

  // Single 1s tick — drives both the countdown display AND the state-machine
  // transition (before → during → after). Re-evaluating every second ensures
  // the bar flips at the exact moment the timestamps cross, without a reload.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // Resolve the promo state from settings + current time. Memoized — only
  // recomputed when the settings or the 1s `now` tick changes.
  const promo = useMemo(
    () => resolvePromoState(promoSettings, now),
    [promoSettings, now]
  )

  // Announcement rotation — only runs when no promo is showing.
  // Pausing the rotation while a promo is active avoids unnecessary
  // re-renders on top of the 1s countdown tick.
  useEffect(() => {
    if (promo) return
    const t = setInterval(() => {
      setAnnouncementIdx((i) => (i + 1) % Math.max(1, announcements.length))
    }, 4000)
    return () => clearInterval(t)
  }, [announcements.length, promo])

  return (
    <div className="bg-gradient-to-r from-primary via-orange-500 to-amber-500 text-white">
      <div className="container-page flex h-9 items-center justify-center gap-3 text-center text-xs font-medium">
        {promo ? (
          <PromoContent
            text={promo.text}
            link={promo.link}
            showCountdown={promoSettings.promoCountdown}
            targetMs={promo.targetMs}
            now={now}
          />
        ) : (
          <motion.span
            key={announcementIdx}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-2"
          >
            {announcements[announcementIdx]}
          </motion.span>
        )}
      </div>
    </div>
  )
}

/**
 * Renders the active promo content — text + optional countdown + optional
 * CTA link wrapper.
 *
 * The countdown display is derived from `targetMs - now` (passed in from
 * the parent's 1s tick). Keeping `now` in the parent and threading it
 * down via props avoids a second setInterval here.
 */
function PromoContent({
  text,
  link,
  showCountdown,
  targetMs,
  now,
}: {
  text: string
  link: string | null
  showCountdown: boolean
  targetMs: number | null
  now: number
}) {
  // Memoize decomposed parts so children don't re-render unnecessarily
  // on the 1s tick when the visible parts haven't changed.
  const parts = useMemo(() => {
    if (!showCountdown || targetMs === null) return null
    return decomposeDelta(targetMs - now)
  }, [showCountdown, targetMs, now])

  const content = (
    <motion.span
      key={text}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-center gap-2"
    >
      <span>{text}</span>
      {parts && (
        <span className="inline-flex items-center gap-1 rounded-full bg-white/25 px-2 py-0.5 font-mono text-[10px] font-bold">
          {parts.days > 0 && <>{parts.days}d </>}
          {String(parts.hours).padStart(2, '0')}h{' '}
          {String(parts.minutes).padStart(2, '0')}m{' '}
          {String(parts.seconds).padStart(2, '0')}s
        </span>
      )}
      {link && <ChevronRight className="h-3 w-3" />}
    </motion.span>
  )

  if (link) {
    return (
      <a
        href={link}
        className="inline-flex h-9 items-center hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        aria-label={`${text} — buka promo`}
      >
        {content}
      </a>
    )
  }
  return content
}

// Exposed for unit tests (kept private to the module otherwise).
export const __test__ = { resolvePromoState, decomposeDelta, NO_PROMO }
