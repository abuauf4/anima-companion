'use client'

import { AnnouncementBar } from '@/components/layout/AnnouncementBar'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { WhatsAppFloatingButton } from '@/components/layout/WhatsAppFloatingButton'
import { MobileBottomBar } from '@/components/layout/MobileBottomBar'

/**
 * SiteShell — the public site chrome (AnnouncementBar + Navbar + main + Footer
 * + WhatsApp button + MobileBottomBar).
 *
 * Extracted from the original `src/app/page.tsx` so each App Router page file
 * can wrap its view in the same shared layout.
 *
 * Children are the page-specific view (e.g. <HomeView />).
 */
export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <AnnouncementBar />
      <Navbar />
      <main className="flex-1 pb-[72px] md:pb-0">{children}</main>
      <Footer />
      <WhatsAppFloatingButton />
      <MobileBottomBar />
    </div>
  )
}
