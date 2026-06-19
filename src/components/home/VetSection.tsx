'use client'
import { motion } from 'framer-motion'
import { Shield, Stethoscope, Heart, Award, Star } from 'lucide-react'
import { SectionHeader } from '@/components/common/SectionHeader'
import { Reveal } from '@/components/common/Reveal'

const VETS = [
  {
    name: 'drh. Sarah Wijaya, M.Vet',
    role: 'Internal Medicine',
    specialty: 'Spesialis Penyakit Dalam & Imunologi',
    avatar: '/team/drh-1.webp',
    quote: 'Saya merekomendasikan Felcover+ dan Sioren Booster+ untuk klien dengan anabul yang butuh dukungan imunitas. Formulasi terstandar dan terdaftar BPOM.',
  },
  {
    name: 'drh. Bayu Pratama',
    role: 'Clinical Nutrition',
    specialty: 'Spesialis Nutrisi & Gizi Hewan',
    avatar: '/team/drh-2.webp',
    quote: 'Untuk anabul yang susah makan, Sioren Nafsu Makan jadi pilihan pertama saya. Aman untuk pemakaian harian dan terbukti meningkatkan nafsu makan.',
  },
  {
    name: 'drh. Rina Kusuma',
    role: 'Dermatology & Coat',
    specialty: 'Spesialis Kulit & Bulu Hewan',
    avatar: '/team/drh-3.webp',
    quote: 'Sioren Skin & Coat dan Sioren Fish Oil adalah kombinasi favorit saya untuk pasien dengan masalah bulu kusam dan kulit gatal.',
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
    <section className="relative py-20 md:py-24 overflow-hidden bg-gradient-mesh">
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mt-14 mb-16">
          {STATS.map((stat, i) => {
            const Icon = stat.icon
            return (
              <Reveal key={stat.label} delay={i * 0.1}>
                <div className="relative p-6 md:p-8 rounded-2xl bg-card border border-border/60 shadow-sm hover:shadow-card-hover transition-all duration-300 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-xl gradient-brand-soft mb-4">
                    <Icon className="w-6 h-6 md:w-7 md:h-7 text-primary" />
                  </div>
                  <div className="text-3xl md:text-4xl font-bold gradient-brand-text tracking-tight">
                    {stat.value}
                  </div>
                  <div className="text-xs md:text-sm text-muted-foreground mt-2 whitespace-pre-line">
                    {stat.label}
                  </div>
                </div>
              </Reveal>
            )
          })}
        </div>

        {/* Vet cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {VETS.map((vet, i) => (
            <motion.div
              key={vet.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              className="group relative bg-card rounded-3xl overflow-hidden border border-border/60 shadow-sm hover:shadow-xl transition-all duration-500"
            >
              {/* Avatar with gradient frame */}
              <div className="relative aspect-[4/5] overflow-hidden bg-muted">
                <div className="absolute inset-0 gradient-brand opacity-20 group-hover:opacity-30 transition-opacity" />
                <img
                  src={vet.avatar}
                  alt={vet.name}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-md text-[11px] font-medium mb-2">
                    <Shield className="w-3 h-3" />
                    {vet.role}
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-5 md:p-6">
                <h3 className="text-lg font-semibold text-foreground tracking-tight">{vet.name}</h3>
                <p className="text-sm text-primary font-medium mt-0.5">{vet.specialty}</p>
                <p className="text-sm text-muted-foreground italic mt-3 leading-relaxed">
                  &ldquo;{vet.quote}&rdquo;
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Institutional badges */}
        <Reveal delay={0.3}>
          <div className="mt-14 flex flex-col items-center gap-6">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
              Dipercaya & Direkomendasikan Oleh
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8">
              <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-card border border-border/60 shadow-sm">
                <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center text-white font-bold text-sm">
                  AC
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold">Anima Companion</div>
                  <div className="text-xs text-muted-foreground">Elevating Animal Health</div>
                </div>
              </div>
              <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-card border border-border/60 shadow-sm">
                <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold">BPOM Terdaftar</div>
                  <div className="text-xs text-muted-foreground">Standar Keamanan Pangan</div>
                </div>
              </div>
              <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-card border border-border/60 shadow-sm">
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
