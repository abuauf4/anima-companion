'use client'

import { AnnouncementBar } from '@/components/layout/AnnouncementBar'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { HashRouter } from '@/components/layout/HashRouter'
import { WhatsAppFloatingButton } from '@/components/layout/WhatsAppFloatingButton'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <AnnouncementBar />
      <Navbar />
      <main className="flex-1">
        <HashRouter />
      </main>
      <Footer />
      <WhatsAppFloatingButton />
    </div>
  )
}
