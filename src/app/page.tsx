'use client'

import { AnnouncementBar } from '@/components/layout/AnnouncementBar'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { HashRouter } from '@/components/layout/HashRouter'
import { WhatsAppFloatingButton } from '@/components/layout/WhatsAppFloatingButton'
import { MobileBottomBar } from '@/components/layout/MobileBottomBar'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <AnnouncementBar />
      <Navbar />
      <main className="flex-1 pb-[72px] md:pb-0">
        <HashRouter />
      </main>
      <Footer />
      <WhatsAppFloatingButton />
      <MobileBottomBar />
    </div>
  )
}
