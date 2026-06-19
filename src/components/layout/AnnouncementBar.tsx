'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

const ANNOUNCEMENTS = [
  '🚚 Gratis ongkir min Rp 150.000',
  '⏰ Flash Sale 20% — berakhir segera!',
  '🎁 Subscribe & Save hemat 15% setiap pesanan',
  '🩺 Konsultasi vet gratis 24/7 via WhatsApp',
]

/**
 * AnnouncementBar — sits ABOVE the navbar.
 *
 * Shows rotating announcements (4s interval).
 * When the Flash Sale announcement is active, shows a live countdown
 * timer fetched from /api/home → saleCountdown.endsAt.
 *
 * Non-sticky — scrolls away when the user scrolls down.
 */
export function AnnouncementBar() {
  const [announcementIdx, setAnnouncementIdx] = useState(0)
  const [saleEndsAt, setSaleEndsAt] = useState<string | null>(null)
  const [countdown, setCountdown] = useState({ days: 3, hours: 0, minutes: 0, seconds: 0 })

  // Fetch sale countdown once
  useEffect(() => {
    fetch('/api/home')
      .then((r) => r.json())
      .then((data) => {
        setSaleEndsAt(data.saleCountdown?.endsAt || null)
      })
      .catch(() => {
        // silent — announcement bar is non-critical
      })
  }, [])

  // Announcement rotation
  useEffect(() => {
    const t = setInterval(() => {
      setAnnouncementIdx((i) => (i + 1) % ANNOUNCEMENTS.length)
    }, 4000)
    return () => clearInterval(t)
  }, [])

  // Sale countdown tick
  useEffect(() => {
    if (!saleEndsAt) return
    const tick = () => {
      const diff = Math.max(0, new Date(saleEndsAt).getTime() - Date.now())
      const days = Math.floor(diff / 86400000)
      const hours = Math.floor((diff % 86400000) / 3600000)
      const minutes = Math.floor((diff % 3600000) / 60000)
      const seconds = Math.floor((diff % 60000) / 1000)
      setCountdown({ days, hours, minutes, seconds })
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [saleEndsAt])

  return (
    <div className="bg-gradient-to-r from-primary via-orange-500 to-amber-500 text-white">
      <div className="container-page flex h-9 items-center justify-center gap-3 text-center text-xs font-medium">
        <motion.span
          key={announcementIdx}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.3 }}
          className="flex items-center gap-2"
        >
          {ANNOUNCEMENTS[announcementIdx]}
          {announcementIdx === 1 && saleEndsAt && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/25 px-2 py-0.5 font-mono text-[10px] font-bold">
              {countdown.days}d {String(countdown.hours).padStart(2, '0')}h {String(countdown.minutes).padStart(2, '0')}m {String(countdown.seconds).padStart(2, '0')}s
            </span>
          )}
        </motion.span>
      </div>
    </div>
  )
}
