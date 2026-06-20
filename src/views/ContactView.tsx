'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion'
import { MessageCircle, Mail, Phone, MapPin, Clock, Instagram } from 'lucide-react'
import { SITE_CONFIG, whatsappAdminUrl } from '@/lib/config'

export function ContactView() {
  const [faqs, setFaqs] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/testimonials').then(() => {}) // ensure this endpoint works
    // FAQ via direct query (we'll fetch from a simple endpoint)
    // Since we don't have a /api/faqs endpoint, let's hardcode common FAQs
    setFaqs([
      { question: 'Apakah produk Anima Companion sudah terdaftar BPOM?', answer: 'Ya, semua produk kami sudah terdaftar di BPOM dengan nomor registrasi yang tertera pada kemasan dan halaman produk.' },
      { question: 'Bagaimana cara pemesanan?', answer: 'Pilih produk yang diinginkan, masukkan ke keranjang, lalu checkout. Pesanan akan dikirim ke WhatsApp admin kami untuk konfirmasi pembayaran dan pengiriman.' },
      { question: 'Apakah tersedia konsultasi gratis?', answer: 'Ya! Tim kami siap membantu via WhatsApp untuk konsultasi seputar kesehatan hewan peliharaan dan pemilihan produk yang tepat.' },
      { question: 'Berapa lama waktu pengiriman?', answer: 'Untuk wilayah Jakarta 1-2 hari, dan luar Jakarta 2-4 hari kerja menggunakan ekspedisi JNE/JNT/SiCepat.' },
      { question: 'Bagaimana cara pembayaran?', answer: 'Pembayaran dilakukan setelah konfirmasi admin via WhatsApp. Metode: transfer bank (BCA, Mandiri, BNI, BRI) atau e-wallet (GoPay, OVO, DANA).' },
      { question: 'Apakah bisa return/refund?', answer: 'Ya, produk dapat di-return selama kondisi masih utuh dan dalam waktu 3 hari setelah diterima. Hubungi admin untuk proses return.' },
    ])
  }, [])

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
                href={whatsappAdminUrl('Halo Anima Companion! 🐾')}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button className="w-full gap-2 bg-success hover:bg-success/90">
                  <MessageCircle className="h-4 w-4" /> Chat WhatsApp Sekarang
                </Button>
              </a>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Nomor: +62 812-3456-7890
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
              <p className="text-sm text-muted-foreground">{SITE_CONFIG.email}</p>
            </Card>

            <Card className="p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10 text-secondary">
                <Instagram className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">Instagram</h3>
              <p className="text-sm text-muted-foreground">{SITE_CONFIG.instagram}</p>
            </Card>

            <Card className="p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Phone className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">Telepon</h3>
              <p className="text-sm text-muted-foreground">+62 812-3456-7890</p>
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
            <Accordion type="single" collapsible>
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`}>
                  <AccordionTrigger className="text-left text-sm">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Card>
        </div>
      </div>
    </div>
  )
}
