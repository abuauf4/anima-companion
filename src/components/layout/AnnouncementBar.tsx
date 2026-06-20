'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

const DEFAULT_ANNOUNCEMENTS = [
  '🚚 Gratis ongkir min Rp 150.000',
  '⏰ Flash Sale 20% — berakhir segera!',
  '🎁 Subscribe & Save hemat 15% setiap pesanan',
  '🩺 Konsultasi vet gratis 24/7 via WhatsApp',
]

/**
 * AnnouncementBar — sits ABOVE the navbar.
 *
 * Shows rotating announcements (4s interval) fetched from /api/home → settings.
 * When the Flash Sale announcement is active, shows a live countdown
 * timer fetched from /api/home → saleCountdown.endsAt.
 *
 * Non-sticky — scrolls away when the user scrolls down.
 */
export function AnnouncementBar() {
  const [announcements, setAnnouncements] = useState<string[]>(DEFAULT_ANNOUNCEMENTS)
  const [announcementIdx, setAnnouncementIdx] = useState(0)
  const [saleEndsAt, setSaleEndsAt] = useState<string | null>(null)
  const [countdown, setCountdown] = useState({ days: 3, hours: 0, minutes: 0, seconds: 0 })

  // Fetch sale countdown + announcements once
  useEffect(() => {
    fetch('/api/home')
      .then((r) => r.json())
      .then((data) => {
        setSaleEndsAt(data.saleCountdown?.endsAt || null)
        const s = data.settings
        if (s) {
          const list = [
            s.announcement1,
            s.announcement2,
            s.announcement3,
            s.announcement4,
          ].filter((a: string) => a && a.trim().length > 0)
          if (list.length > 0) setAnnouncements(list)
        }
      })
      .catch(() => {
        // silent — announcement bar is non-critical
      })
  }, [])

  // Announcement rotation
  useEffect(() => {
    const t = setInterval(() => {
      setAnnouncementIdx((i) => (i + 1) % Math.max(1, announcements.length))
    }, 4000)
    return () => clearInterval(t)
  }, [announcements.length])

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

  // announcementIdx === 1 maps to "Flash Sale" announcement (the 2nd one).
  // If announcements were customized, this is still the Flash Sale slot
  // (the admin labels announcement2 as Flash Sale).
  const isFlashSaleSlot = announcementIdx === 1

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
          {announcements[announcementIdx]}
          {isFlashSaleSlot && saleEndsAt && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/25 px-2 py-0.5 font-mono text-[10px] font-bold">
              {countdown.days}d {String(countdown.hours).padStart(2, '0')}h {String(countdown.minutes).padStart(2, '0')}m {String(countdown.seconds).padStart(2, '0')}s
            </span>
          )}
        </motion.span>
      </div>
    </div>
  )
}
