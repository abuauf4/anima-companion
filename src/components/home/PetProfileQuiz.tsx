'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useHashRouter } from '@/lib/router'
import {
  X, ArrowRight, ArrowLeft, Check, Cat, Dog, Bird, Rabbit, PawPrint,
} from 'lucide-react'

const PET_TYPES = [
  { id: 'kucing', label: 'Kucing', icon: Cat, emoji: '🐱' },
  { id: 'anjing', label: 'Anjing', icon: Dog, emoji: '🐕' },
  { id: 'kelinci', label: 'Kelinci', icon: Rabbit, emoji: '🐰' },
  { id: 'burung', label: 'Burung', icon: Bird, emoji: '🐦' },
]

const PROBLEMS = [
  { id: 'nafsu-makan', label: 'Susah Makan', emoji: '🍖' },
  { id: 'imunitas', label: 'Daya Tahan Tubuh', emoji: '🛡️' },
  { id: 'bulu-dan-kulit', label: 'Bulu & Kulit', emoji: '✨' },
  { id: 'pencernaan', label: 'Pencernaan', emoji: '🌿' },
  { id: 'tulang-dan-sendi', label: 'Tulang & Sendi', emoji: '🦴' },
  { id: 'mata', label: 'Mata', emoji: '👁️' },
  { id: 'recovery', label: 'Recovery', emoji: '💖' },
  { id: 'harian', label: 'Vitamin Harian', emoji: '☀️' },
]

const STORAGE_KEY = 'anima-pet-profile-completed'

export function PetProfileQuiz() {
  const { navigate } = useHashRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [petType, setPetType] = useState<string | null>(null)
  const [selectedProblems, setSelectedProblems] = useState<string[]>([])

  // Show modal after 6 seconds on first visit
  useEffect(() => {
    if (typeof window === 'undefined') return
    const completed = localStorage.getItem(STORAGE_KEY)
    if (completed) return

    const timer = setTimeout(() => setOpen(true), 6000)
    return () => clearTimeout(timer)
  }, [])

  const handleClose = () => {
    setOpen(false)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString())
    }
  }

  const toggleProblem = (id: string) => {
    setSelectedProblems((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }

  const handleFinish = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString())
    }
    setOpen(false)

    if (selectedProblems.length >= 1) {
      navigate(`/problem/${selectedProblems[0]}`)
    } else {
      navigate('/shop')
    }
  }

  const canProceed = step === 0 ? !!petType : selectedProblems.length > 0

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md overflow-hidden rounded-t-3xl bg-background shadow-2xl sm:rounded-3xl"
          >
            {/* Header */}
            <div className="relative bg-gradient-to-br from-primary via-orange-500 to-amber-500 p-5 text-white">
              <div className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-white/15 blur-2xl" />
              <button
                onClick={handleClose}
                aria-label="Tutup"
                className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition hover:bg-white/25"
              >
                <X className="size-4" />
              </button>
              <div className="relative flex items-center gap-2.5">
                <div className="flex size-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
                  <PawPrint className="size-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">
                    Personalisasi
                  </p>
                  <h2 className="text-lg font-extrabold leading-tight">
                    Anabul kamu siapa?
                  </h2>
                </div>
              </div>
              {/* Progress dots */}
              <div className="relative mt-3 flex items-center gap-1.5">
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-all ${
                      i <= step ? 'bg-white' : 'bg-white/30'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Body */}
            <div className="p-5">
              {step === 0 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-3"
                >
                  <p className="text-sm font-semibold text-foreground">
                    Pilih jenis hewan peliharaanmu:
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {PET_TYPES.map((pt) => {
                      const Icon = pt.icon
                      const active = petType === pt.id
                      return (
                        <button
                          key={pt.id}
                          onClick={() => setPetType(pt.id)}
                          className={`relative flex flex-col items-center gap-1.5 rounded-2xl border-2 p-3.5 transition-all ${
                            active
                              ? 'border-primary bg-primary/5 shadow-sm'
                              : 'border-border hover:border-primary/40 hover:bg-muted/50'
                          }`}
                        >
                          <span className="text-3xl">{pt.emoji}</span>
                          <span className={`text-sm font-bold ${active ? 'text-primary' : 'text-foreground'}`}>
                            {pt.label}
                          </span>
                          {active && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
                            >
                              <Check className="size-3" />
                            </motion.div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </motion.div>
              )}

              {step === 1 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-3"
                >
                  <p className="text-sm font-semibold text-foreground">
                    Masalah apa yang dialami anabulmu?{' '}
                    <span className="font-normal text-muted-foreground">
                      (boleh pilih lebih dari satu)
                    </span>
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {PROBLEMS.map((p) => {
                      const active = selectedProblems.includes(p.id)
                      return (
                        <button
                          key={p.id}
                          onClick={() => toggleProblem(p.id)}
                          className={`flex items-center gap-2 rounded-xl border-2 p-2.5 text-left transition-all ${
                            active
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/40 hover:bg-muted/50'
                          }`}
                        >
                          <span className="text-xl">{p.emoji}</span>
                          <span className={`text-xs font-semibold ${active ? 'text-primary' : 'text-foreground'}`}>
                            {p.label}
                          </span>
                          {active && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="ml-auto flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                            >
                              <Check className="size-2.5" />
                            </motion.div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                  <p className="pt-1 text-[10px] text-muted-foreground">
                    💡 Kami akan rekomendasikan produk yang tepat berdasarkan pilihanmu.
                  </p>
                </motion.div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-2 border-t border-border p-4">
              {step > 0 && (
                <Button
                  variant="ghost"
                  onClick={() => setStep(step - 1)}
                  className="gap-1.5"
                  size="sm"
                >
                  <ArrowLeft className="size-4" /> Kembali
                </Button>
              )}
              <div className="flex-1" />
              {step < 1 ? (
                <Button
                  onClick={() => setStep(step + 1)}
                  disabled={!canProceed}
                  className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Lanjut <ArrowRight className="size-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleFinish}
                  disabled={!canProceed}
                  className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Lihat Rekomendasi <ArrowRight className="size-4" />
                </Button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
