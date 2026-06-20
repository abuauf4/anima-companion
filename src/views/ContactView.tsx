'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion'
import { MessageCircle, Mail, Phone, MapPin, Clock, Instagram, HelpCircle } from 'lucide-react'
import { SITE_CONFIG, whatsappAdminUrl } from '@/lib/config'
import { Skeleton } from '@/components/ui/skeleton'
import type { SiteSetting } from '@/hooks/use-home-data'
import type { Faq } from '@/hooks/use-fetch'

export function ContactView() {
  const [faqs, setFaqs] = useState<Faq[]>([])
  const [faqsLoading, setFaqsLoading] = useState(true)
  const [settings, setSettings] = useState<SiteSetting | null>(null)

  useEffect(() => {
    fetch('/api/faqs')
      .then((r) => r.json())
      .then((data) => {
        setFaqs(data.faqs || [])
      })
      .catch(() => {
        // silent — FAQ section will show empty
      })
      .finally(() => setFaqsLoading(false))

    // Fetch site settings (contact info)
    fetch('/api/home')
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) setSettings(data.settings)
      })
      .catch(() => {
        // silent — fall back to SITE_CONFIG defaults
      })
  }, [])

  // Use settings values if available, else fall back to SITE_CONFIG
  const whatsappNumber = settings?.whatsappNumber || SITE_CONFIG.whatsappNumber
  const email = settings?.email || SITE_CONFIG.email
  const instagramHandle = settings?.instagram || SITE_CONFIG.instagram

  // Format WA number for display: "6281234567890" → "+62 812-3456-7890"
  const formattedWa = whatsappNumber.startsWith('62')
    ? `+${whatsappNumber.slice(0, 2)} ${whatsappNumber.slice(2, 5)}-${whatsappNumber.slice(5, 9)}-${whatsappNumber.slice(9)}`
    : `+${whatsappNumber}`

  // Custom WA message with brand name
  const waMessage = `Halo Anima Companion! 🐾`

  return (
    <div className="container-page py-6">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold md:text-3xl">Hubungi Kami</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          Punya pertanyaan atau butuh bantuan? Tim kami siap membantu Anda.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Contact methods */}
        <div className="space-y-4 lg:col-span-2">
          {/* WhatsApp - primary */}
          <Card className="overflow-hidden border-success/30 p-0">
            <div className="bg-success p-6 text-white">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20">
                  <MessageCircle className="h-7 w-7" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">WhatsApp (Recommended)</h2>
                  <p className="text-sm text-white/90">Respons paling cepat di jam kerja</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <p className="mb-3 text-sm text-muted-foreground">
                Chat langsung dengan tim kami untuk pemesanan, konsultasi produk,
                atau pertanyaan lainnya. Kami siap membantu!
              </p>
              <a
                href={whatsappAdminUrl(waMessage)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button className="w-full gap-2 bg-success hover:bg-success/90">
                  <MessageCircle className="h-4 w-4" /> Chat WhatsApp Sekarang
                </Button>
              </a>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Nomor: {formattedWa}
              </p>
            </div>
          </Card>

          {/* Other channels */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Mail className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">Email</h3>
              <p className="break-words text-sm text-muted-foreground">{email}</p>
            </Card>

            <Card className="p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10 text-secondary">
                <Instagram className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">Instagram</h3>
              <p className="text-sm text-muted-foreground">{instagramHandle}</p>
            </Card>

            <Card className="p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Phone className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">Telepon</h3>
              <p className="text-sm text-muted-foreground">{formattedWa}</p>
            </Card>

            <Card className="p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10 text-secondary">
                <MapPin className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">Alamat</h3>
              <p className="text-sm text-muted-foreground">{SITE_CONFIG.address}</p>
            </Card>
          </div>

          {/* Hours */}
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">Jam Operasional</h3>
                <p className="text-sm text-muted-foreground">{SITE_CONFIG.hours}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* FAQ */}
        <div>
          <Card className="p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              ❓ FAQ
            </h2>
            {faqsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}
              </div>
            ) : faqs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <HelpCircle className="mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">FAQ belum tersedia.</p>
              </div>
            ) : (
              <Accordion type="single" collapsible>
                {faqs.map((faq, i) => (
                  <AccordionItem key={faq.id} value={`faq-${i}`}>
                    <AccordionTrigger className="text-left text-sm">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
            {faqs.length > 0 && (
              <div className="mt-4 pt-3 border-t border-border">
                <Badge variant="outline" className="text-[10px]">{faqs.length} pertanyaan</Badge>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
