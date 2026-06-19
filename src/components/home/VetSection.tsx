'use client'
import { motion } from 'framer-motion'
import { Shield, Stethoscope, Microscope, Heart, Award, ChevronRight } from 'lucide-react'
import { SectionHeader } from '@/components/common/SectionHeader'
import { Reveal } from '@/components/common/Reveal'

const VETS = [
  {
    name: 'drh. Sarah Wijaya, M.Vet',
    role: 'Internal Medicine',
    specialty: 'Spesialis Penyakit Dalam & Imunologi',
    avatar: '/team/drh-1.webp',
    quote: 'Pendekatan berbasis riset IPB membuat Anima Companion jadi pilihan utama saya untuk rekomendasi klien.',
  },
  {
    name: 'drh. Bayu Pratama',
    role: 'Clinical Nutrition',
    specialty: 'Spesialis Nutrisi & Gizi Hewan',
    avatar: '/team/drh-2.webp',
    quote: 'Formula Anima sudah melalui uji klinis. Bukan sekedar vitamin, tapi terapi pendukung nyata.',
  },
  {
    name: 'drh. Rina Kusuma, Ph.D',
    role: 'Research & Development',
    specialty: 'Peneliti BRIN, Spesialis Formulasi',
    avatar: '/team/drh-3.webp',
    quote: 'Setiap batch kami uji di lab BRIN. Konsistensi kualitas adalah prioritas utama kami.',
  },
];

const STATS = [
  { value: '2,100+', label: 'Dokter Hewan Mempercayai', icon: Stethoscope },
  { value: '500+', label: 'Klinik Hewan Mitra Reseller', icon: Heart },
  { value: '100%', label: 'Riset IPB\n& BRIN', icon: Microscope },
  { value: '8+', label: 'Produk Teruji\nKlinis', icon: Award },
];

export function VetSection() {
  return (
    <section className="relative py-20 md:py-24 overflow-hidden bg-gradient-mesh">
      {/* Decorative blurred orbs */}
      <div className="absolute top-20 -left-20 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 -right-20 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />

      <div className="container-page relative">
        <SectionHeader
          eyebrow="Kredibilitas & Riset"
          title={<>Didukung <span className="gradient-brand-text">Riset IPB & BRIN</span></>}
          subtitle="Bukan sekedar brand supplement — setiap formula Anima Companion lahir dari laboratorium riset dan diuji klinis oleh dokter hewan bersertifikat."
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
              Riset & Validasi Bersama
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8">
              <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-card border border-border/60 shadow-sm">
                <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center text-white font-bold text-sm">
                  IPB
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold">IPB University</div>
                  <div className="text-xs text-muted-foreground">Faculty of Veterinary Medicine</div>
                </div>
              </div>
              <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-card border border-border/60 shadow-sm">
                <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center text-white font-bold text-sm">
                  BRIN
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold">Badan Riset & Inovasi Nasional</div>
                  <div className="text-xs text-muted-foreground">Laboratorium Uji Klinis</div>
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
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
