'use client'

import { useHashRouter } from '@/lib/router'
import { Logo } from './Logo'
import { whatsappAdminUrl } from '@/lib/config'
import { Mail, Phone, MapPin, Clock, Instagram, MessageCircle, ShoppingBag, Music2, Hash, Building2 } from 'lucide-react'

export function Footer() {
  const { navigate } = useHashRouter()

  return (
    <footer className="mt-auto border-t border-border bg-card">
      {/* Trust badges row */}
      <div className="border-b border-border/60">
        <div className="container-page grid grid-cols-2 gap-4 py-6 sm:grid-cols-4">
          {[
            { icon: '🛡️', title: 'BPOM Terdaftar', desc: 'Produk resmi & aman' },
            { icon: '✅', title: '100% Asli', desc: 'Dijamin original' },
            { icon: '🏥', title: '515+ Klinik', desc: 'Distributor resmi' },
            { icon: '💬', title: 'Fast Response', desc: 'via WhatsApp' },
          ].map((b, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-2xl">{b.icon}</span>
              <div>
                <p className="text-sm font-semibold">{b.title}</p>
                <p className="text-xs text-muted-foreground">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="container-page py-10">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5">
          {/* Brand */}
          <div className="col-span-2 lg:col-span-2">
            <Logo showTagline />
            <p className="mt-4 max-w-sm text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Elevating Animal Health</span> — Suplemen Rekomendasi drh.
              Vitamin & suplemen hewan peliharaan premium dari PT Sutan Vet Medika, tersedia di 515+ klinik seluruh Indonesia.
            </p>
            {/* Company info */}
            <div className="mt-4 space-y-1.5 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <span>PT Sutan Vet Medika</span>
              </p>
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <span>Bogor, Jawa Barat, Indonesia</span>
              </p>
              <p className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-primary" />
                <span className="font-semibold text-secondary">#PawrentHebatAnabulSehat</span>
              </p>
            </div>
            {/* Social links */}
            <div className="mt-4 flex items-center gap-2">
              <a
                href={whatsappAdminUrl('Halo Anima Companion! 🐾')}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-success/10 text-success hover:bg-success hover:text-success-foreground transition-colors"
                aria-label="WhatsApp"
                title="WhatsApp"
              >
                <MessageCircle className="h-4 w-4" />
              </a>
              <a
                href="https://instagram.com/anima.companion"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/10 text-secondary hover:bg-secondary hover:text-secondary-foreground transition-colors"
                aria-label="Instagram @anima.companion"
                title="Instagram @anima.companion"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a
                href="https://shopee.co.id/anima.companion"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                aria-label="Shopee anima.companion"
                title="Shopee anima.companion"
              >
                <ShoppingBag className="h-4 w-4" />
              </a>
              <a
                href="https://www.tokopedia.com/find/felcover"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                aria-label="Tokopedia"
                title="Tokopedia"
              >
                <ShoppingBag className="h-4 w-4" />
              </a>
              <a
                href="#"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                aria-label="TikTok Shop (segera)"
                title="TikTok Shop (segera)"
              >
                <Music2 className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Belanja */}
          <div>
            <h4 className="mb-3 text-sm font-semibold">Belanja</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><button onClick={() => navigate('/shop')} className="hover:text-primary">Semua Produk</button></li>
              <li><button onClick={() => navigate('/shop?category=vitamin')} className="hover:text-primary">Vitamin</button></li>
              <li><button onClick={() => navigate('/shop?category=suplemen')} className="hover:text-primary">Suplemen</button></li>
              <li><button onClick={() => navigate('/shop?category=perawatan')} className="hover:text-primary">Perawatan</button></li>
              <li><button onClick={() => navigate('/shop?category=grooming')} className="hover:text-primary">Grooming</button></li>
              <li><button onClick={() => navigate('/problem')} className="hover:text-primary">Shop by Problem</button></li>
            </ul>
          </div>

          {/* Akun */}
          <div>
            <h4 className="mb-3 text-sm font-semibold">Akun</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><button onClick={() => navigate('/login')} className="hover:text-primary">Masuk</button></li>
              <li><button onClick={() => navigate('/register')} className="hover:text-primary">Daftar</button></li>
              <li><button onClick={() => navigate('/profile')} className="hover:text-primary">Profil Saya</button></li>
              <li><button onClick={() => navigate('/orders')} className="hover:text-primary">Riwayat Pesanan</button></li>
            </ul>
          </div>

          {/* Kontak */}
          <div>
            <h4 className="mb-3 text-sm font-semibold">Kontak</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Mail className="mt-0.5 h-4 w-4 text-primary" />
                <span>hello@animacompanion.id</span>
              </li>
              <li className="flex items-start gap-2">
                <Phone className="mt-0.5 h-4 w-4 text-primary" />
                <span>+62 812-3456-7890</span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                <span>Bogor, Jawa Barat, Indonesia</span>
              </li>
              <li className="flex items-start gap-2">
                <Clock className="mt-0.5 h-4 w-4 text-primary" />
                <span>Senin–Sabtu, 09.00–18.00 WIB</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Marketplace channels row */}
        <div className="mt-8 rounded-2xl border border-border/60 bg-accent/40 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Beli Resmi di Marketplace</p>
              <p className="mt-0.5 text-sm text-foreground">Tersedia di Shopee, Tokopedia, dan TikTok Shop (segera)</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href="https://shopee.co.id/anima.companion"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:border-primary hover:text-primary transition-colors"
              >
                <ShoppingBag className="h-3.5 w-3.5" /> Shopee
              </a>
              <a
                href="https://www.tokopedia.com/find/felcover"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:border-primary hover:text-primary transition-colors"
              >
                <ShoppingBag className="h-3.5 w-3.5" /> Tokopedia
              </a>
              <span
                className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground"
                title="TikTok Shop — segera hadir"
              >
                <Music2 className="h-3.5 w-3.5" /> TikTok Shop (segera)
              </span>
              <a
                href="https://instagram.com/anima.companion"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:border-primary hover:text-primary transition-colors"
              >
                <Instagram className="h-3.5 w-3.5" /> @anima.companion
              </a>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
          <p>© 2026 PT Sutan Vet Medika — Anima Companion. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <button className="hover:text-primary">Kebijakan Privasi</button>
            <button className="hover:text-primary">Syarat & Ketentuan</button>
            <button className="hover:text-primary">FAQ</button>
          </div>
        </div>
      </div>
    </footer>
  )
}
