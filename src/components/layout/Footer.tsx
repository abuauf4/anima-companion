'use client'

import { useHashRouter } from '@/lib/router'
import { Logo } from './Logo'
import { SITE_CONFIG, whatsappAdminUrl } from '@/lib/config'
import { Mail, Phone, MapPin, Clock, Instagram, MessageCircle } from 'lucide-react'

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
            { icon: '🚚', title: 'Pengiriman Cepat', desc: '1-4 hari kerja' },
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
              Platform e-commerce vitamin, suplemen, dan kebutuhan kesehatan hewan
              peliharaan. Belanja mudah, cepat, dan terpercaya.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <a
                href={whatsappAdminUrl('Halo Anima Companion! 🐾')}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-success/10 text-success hover:bg-success hover:text-success-foreground transition-colors"
                aria-label="WhatsApp"
              >
                <MessageCircle className="h-4 w-4" />
              </a>
              <a
                href={`https://instagram.com/${SITE_CONFIG.instagram.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/10 text-secondary hover:bg-secondary hover:text-secondary-foreground transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="h-4 w-4" />
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
                <span>{SITE_CONFIG.email}</span>
              </li>
              <li className="flex items-start gap-2">
                <Phone className="mt-0.5 h-4 w-4 text-primary" />
                <span>+62 812-3456-7890</span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                <span>{SITE_CONFIG.address}</span>
              </li>
              <li className="flex items-start gap-2">
                <Clock className="mt-0.5 h-4 w-4 text-primary" />
                <span>{SITE_CONFIG.hours}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
          <p>© 2026 Anima Companion. Semua hak dilindungi.</p>
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
