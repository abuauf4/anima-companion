'use client'
import { motion } from 'framer-motion'
import { Shield, Stethoscope, Heart, Award, Star, Quote } from 'lucide-react'
import { SectionHeader } from '@/components/common/SectionHeader'
import { Reveal, Stagger, StaggerItem } from '@/components/common/Reveal'

/**
 * Vet testimonials — NO PHOTOS (per user request).
 * Clean quote-card design with vet name, role, specialty, and quote.
 */

const VETS = [
  {
    name: 'drh. Sarah Wijaya, M.Vet',
    role: 'Internal Medicine',
    specialty: 'Spesialis Penyakit Dalam & Imunologi',
    quote: 'Saya merekomendasikan Felcover+ dan Sioren Booster+ untuk klien dengan anabul yang butuh dukungan imunitas. Formulasi terstandar dan terdaftar BPOM.',
    color: 'from-orange-400 to-amber-500',
  },
  {
    name: 'drh. Bayu Pratama',
    role: 'Clinical Nutrition',
    specialty: 'Spesialis Nutrisi & Gizi Hewan',
    quote: 'Untuk anabul yang susah makan, Sioren Nafsu Makan jadi pilihan pertama saya. Aman untuk pemakaian harian dan terbukti meningkatkan nafsu makan.',
    color: 'from-emerald-400 to-teal-500',
  },
  {
    name: 'drh. Rina Kusuma',
    role: 'Dermatology & Coat',
    specialty: 'Spesialis Kulit & Bulu Hewan',
    quote: 'Sioren Skin & Coat dan Sioren Fish Oil adalah kombinasi favorit saya untuk pasien dengan masalah bulu kusam dan kulit gatal.',
    color: 'from-violet-400 to-purple-500',
  },
];

const STATS = [
  { value: '515+', label: 'Klinik Resmi', icon: Stethoscope },
  { value: '100%', label: 'Rekomendasi drh.', icon: Heart },
  { value: '8', label: 'Produk Tervalidasi', icon: Award },
  { value: '4.9★', label: 'Rating Pelanggan', icon: Star },
];

export function VetSection() {
  return (
    <section className="relative py-16 md:py-20 overflow-hidden bg-gradient-mesh">
      {/* Decorative blurred orbs */}
      <div className="absolute top-20 -left-20 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 -right-20 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />

      <div className="container-page relative">
        <SectionHeader
          eyebrow="Kredibilitas & Rekomendasi"
          title={<>Rekomendasi <span className="gradient-brand-text">Dokter Hewan</span></>}
          subtitle="Setiap produk Anima Companion direkomendasikan oleh dokter hewan bersertifikat. Tersedia di 515+ klinik hewan seluruh Indonesia sebagai bagian dari standar perawatan anabul."
          align="center"
        />

        {/* Stats grid */}
        <Stagger className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mt-12 mb-14">
          {STATS.map((stat) => {
            const Icon = stat.icon
            return (
              <StaggerItem key={stat.label}>
                <div className="relative p-5 md:p-7 rounded-2xl bg-card border border-border/60 shadow-sm hover:shadow-card-hover transition-all duration-300 text-center">
                  <div className="inline-flex items-center justify-center w-11 h-11 md:w-12 md:h-12 rounded-xl gradient-brand-soft mb-3">
                    <Icon className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                  </div>
                  <div className="text-2xl md:text-3xl font-bold gradient-brand-text tracking-tight">
                    {stat.value}
                  </div>
                  <div className="text-xs md:text-sm text-muted-foreground mt-1.5 whitespace-pre-line">
                    {stat.label}
                  </div>
                </div>
              </StaggerItem>
            )
          })}
        </Stagger>

        {/* Vet testimonial cards — equal height, clean quote-card design */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6 items-stretch">
          {VETS.map((vet, i) => (
            <motion.div
              key={vet.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="group relative flex flex-col rounded-2xl bg-card border border-border/60 p-6 shadow-sm hover:shadow-md transition-all duration-300 min-h-[260px]"
            >
              {/* Quote icon with gradient — top-left corner */}
              <div className={`mb-4 inline-flex size-10 items-center justify-center rounded-xl bg-gradient-to-br ${vet.color} text-white shadow-sm`}>
                <Quote className="size-5" fill="currentColor" />
              </div>

              {/* Quote text */}
              <p className="text-sm leading-relaxed text-foreground/80 italic mb-5 flex-1">
                &ldquo;{vet.quote}&rdquo;
              </p>

              {/* Divider */}
              <div className="h-px bg-border/60 mb-4" />

              {/* Vet info */}
              <div className="flex items-center gap-3">
                <div className={`flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${vet.color} text-white font-bold text-sm shadow-sm`}>
                  {vet.name.replace('drh. ', '').charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground tracking-tight truncate">
                    {vet.name}
                  </h3>
                  <p className="text-xs text-primary font-medium mt-0.5 truncate">
                    {vet.specialty}
                  </p>
                </div>
                <div className="inline-flex items-center gap-1 rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] font-medium text-secondary shrink-0">
                  <Shield className="size-2.5" />
                  {vet.role}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Institutional badges */}
        <Reveal delay={0.2}>
          <div className="mt-12 flex flex-col items-center gap-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
              Dipercaya & Direkomendasikan Oleh
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 md:gap-6">
              <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-card border border-border/60 shadow-sm">
                <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center text-white font-bold text-sm">
                  AC
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold">Anima Companion</div>
                  <div className="text-xs text-muted-foreground">Elevating Animal Health</div>
                </div>
              </div>
              <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-card border border-border/60 shadow-sm">
                <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold">BPOM Terdaftar</div>
                  <div className="text-xs text-muted-foreground">Standar Keamanan Pangan</div>
                </div>
              </div>
              <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-card border border-border/60 shadow-sm">
                <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center">
                  <Stethoscope className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold">515+ Klinik Hewan</div>
                  <div className="text-xs text-muted-foreground">Distributor resmi seluruh Indonesia</div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
