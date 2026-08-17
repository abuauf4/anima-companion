'use client'

import { AnnouncementBar } from '@/components/layout/AnnouncementBar'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { WhatsAppFloatingButton } from '@/components/layout/WhatsAppFloatingButton'
import { MobileBottomBar } from '@/components/layout/MobileBottomBar'

export function SiteShell({ children, admin = false }: { children: React.ReactNode; admin?: boolean }) {
  if (admin) {
    return <div className="admin-root min-h-screen bg-muted/40">{children}</div>
  }

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
