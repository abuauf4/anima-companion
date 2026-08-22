'use client'
import { motion } from 'framer-motion'
import { Shield, Stethoscope, Heart, Award, Star, Quote } from 'lucide-react'
import { SectionHeader } from '@/components/common/SectionHeader'
import { Reveal, Stagger, StaggerItem } from '@/components/common/Reveal'

/**
 * Brand trust section — distribution, BPOM, product lines, customer rating.
 *
 * NOTE: This section previously displayed fabricated veterinarian testimonials
 * implying veterinary endorsement of Anima Companion products. Those claims
 * have been removed. The section layout (stats grid + 3 quote-style cards +
 * institutional badges) is preserved, but the cards now show factual
 * product-line information sourced from existing verified brand data.
 */

const PRODUCT_LINES = [
  {
    name: 'Felcover+',
    role: 'Immune Stimulant',
    specialty: 'Dukungan Imunitas Kucing & Anjing',
    quote: 'Suplemen dengan kolostrum dan prebiotik untuk membantu meningkatkan daya tahan tubuh dan menjaga kesehatan pencernaan anabul.',
    color: 'from-orange-400 to-amber-500',
  },
  {
    name: 'Sioren',
    role: 'Lini Suplemen Harian',
    specialty: 'Nafsu Makan, Skin & Coat, Fish Oil',
    quote: 'Lini suplemen harian untuk dukungan nafsu makan, perawatan kulit & bulu, dan asupan minyak ikan untuk kucing dan anjing.',
    color: 'from-emerald-400 to-teal-500',
  },
  {
    name: 'Forevet',
    role: 'Lini Produk Veteriner',
    specialty: 'Manajemen Stres & Perawatan Khusus',
    quote: 'Lini produk veteriner untuk dukungan kondisi khusus seperti manajemen stres pada hewan peliharaan.',
    color: 'from-violet-400 to-purple-500',
  },
];

const STATS = [
  { value: '400+', label: 'Klinik Resmi', icon: Stethoscope },
  { value: '100%', label: 'BPOM Terdaftar', icon: Heart },
  { value: '8', label: 'Produk Resmi', icon: Award },
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
          eyebrow="Kredibilitas Brand"
          title={<>Dipercaya & <span className="gradient-brand-text">Terdistribusi</span></>}
          subtitle="Suplemen & vitamin hewan peliharaan premium dari Anima Companion — PT Sutan Vet Medika. Tersedia di 400+ klinik hewan seluruh Indonesia sebagai distributor resmi."
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

        {/* Product line cards — equal height on ALL breakpoints */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 lg:gap-6">
          {PRODUCT_LINES.map((line, i) => (
            <motion.div
              key={line.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="group relative flex flex-col rounded-2xl bg-card border border-border/60 p-5 md:p-6 shadow-sm hover:shadow-md transition-all duration-300 h-[280px] md:h-[300px]"
            >
              {/* Quote icon with gradient — top-left corner */}
              <div className={`mb-4 inline-flex size-10 items-center justify-center rounded-xl bg-gradient-to-br ${line.color} text-white shadow-sm`}>
                <Quote className="size-5" fill="currentColor" />
              </div>

              {/* Product line description — clamped to fit fixed card height */}
              <p className="text-sm leading-relaxed text-foreground/80 italic mb-5 flex-1 overflow-hidden line-clamp-4">
                &ldquo;{line.quote}&rdquo;
              </p>

              {/* Divider */}
              <div className="h-px bg-border/60 mb-4" />

              {/* Product line info */}
              <div className="flex items-center gap-3">
                <div className={`flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${line.color} text-white font-bold text-sm shadow-sm`}>
                  {line.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground tracking-tight truncate">
                    {line.name}
                  </h3>
                  <p className="text-xs text-primary font-medium mt-0.5 truncate">
                    {line.specialty}
                  </p>
                </div>
                <div className="inline-flex items-center gap-1 rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] font-medium text-secondary shrink-0">
                  <Shield className="size-2.5" />
                  {line.role}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Institutional badges — full-width cards on mobile, 3-col on desktop */}
        <Reveal delay={0.2}>
          <div className="mt-12 flex flex-col items-center gap-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
              Mitra Distribusi Resmi
            </p>
            <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-3 md:gap-6">
              <div className="flex items-center gap-3 rounded-2xl bg-card border border-border/60 px-4 py-3 shadow-sm md:px-5">
                <div className="size-10 shrink-0 rounded-xl gradient-brand flex items-center justify-center text-white font-bold text-sm">
                  AC
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold">Anima Companion</div>
                  <div className="text-xs text-muted-foreground">Elevating Animal Health</div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-card border border-border/60 px-4 py-3 shadow-sm md:px-5">
                <div className="size-10 shrink-0 rounded-xl gradient-brand flex items-center justify-center">
                  <Shield className="size-5 text-white" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold">BPOM Terdaftar</div>
                  <div className="text-xs text-muted-foreground">Standar Keamanan Pangan</div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-card border border-border/60 px-4 py-3 shadow-sm md:px-5">
                <div className="size-10 shrink-0 rounded-xl gradient-brand flex items-center justify-center">
                  <Stethoscope className="size-5 text-white" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold">400+ Klinik Hewan</div>
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
