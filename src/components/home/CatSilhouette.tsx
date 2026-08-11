'use client'

import { motion } from 'framer-motion'

/**
 * CatSilhouette — organic seated domestic cat, compact sphinx pose.
 *
 * Anatomy:
 *  - Two MODERATE pointed triangular ears on top (taller than wide,
 *    but not so tall they read as rabbit ears — cat ears are
 *    roughly half the head height).
 *  - Compact rounded wedge head (not a circle, not a flat triangle).
 *  - NO pronounced muzzle — cats have very short muzzles.
 *  - COMPACT body (slightly wider than tall — NOT a tall slender
 *    column which would read as rabbit/kangaroo).
 *  - Two DISTINCT front legs reaching down to two front paws, with
 *    a clear gap (valley) between them.
 *  - Seated hindquarters with hind paw visible.
 *  - Long curved tail. Base sits INSIDE the rump silhouette.
 *
 *  Single solid fill (currentColor — brand purple set by parent).
 *
 * Microinteraction preserved exactly:
 *  - bodyVariants drives whole-body lift/scale on hover/tap.
 *  - tailVariants drives a subtle tail rotate on hover.
 *  - MotionConfig reducedMotion='user' (set on <PetSelector>) strips
 *    transforms automatically when the user prefers reduced motion.
 */
const bodyVariants = {
  rest: { y: 0, scale: 1 },
  hover: { y: -3, scale: 1.02, transition: { duration: 0.45, ease: 'easeOut' as const } },
  tap: { y: 0, scale: 0.98, transition: { duration: 0.12 } },
} as const

const tailVariants = {
  rest: { rotate: 0 },
  hover: { rotate: -6, transition: { duration: 0.5, ease: 'easeOut' as const } },
  tap: { rotate: 0, transition: { duration: 0.12 } },
} as const

export function CatSilhouette({ className }: { className?: string }) {
  return (
    <motion.svg
      viewBox="0 0 120 140"
      className={className}
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <motion.g variants={bodyVariants} initial="rest" style={{ transformOrigin: '60px 130px' }}>
        {/* Tail — long curved tail. Base at (74, 102) INSIDE the
            rump so the tail visually emerges from the rump. */}
        <motion.path
          variants={tailVariants}
          style={{ transformOrigin: '74px 102px' }}
          d="M 74 102
             C 86 98, 98 90, 102 78
             C 106 66, 102 56, 94 58
             C 86 60, 84 68, 86 74
             C 88 80, 84 88, 80 92
             C 78 96, 76 98, 74 102
             Z"
          fill="currentColor"
        />

        {/* Body — single closed organic path. MODERATE-height ears
            (not rabbit-tall). COMPACT body (wider than tall). Two
            DISTINCT front legs with clear gap (valley) between. */}
        <path
          d="M 58 36
             C 60 28, 64 22, 68 24
             C 72 26, 70 32, 64 36
             C 62 35, 60 35, 58 36
             C 56 35, 54 35, 52 36
             C 46 32, 44 26, 48 24
             C 52 22, 56 28, 58 36
             C 60 40, 62 44, 64 48
             C 72 50, 80 54, 84 64
             C 88 74, 90 86, 88 96
             C 90 100, 90 104, 88 108
             C 90 112, 92 116, 90 122
             C 88 128, 84 130, 80 128
             C 82 124, 84 120, 84 116
             C 84 112, 82 110, 78 110
             C 72 112, 64 112, 58 110
             C 58 114, 58 120, 58 126
             C 58 130, 56 132, 52 130
             C 50 128, 50 124, 50 120
             C 50 116, 50 112, 50 110
             C 50 112, 50 118, 50 124
             C 50 128, 48 130, 44 130
             C 42 130, 40 130, 40 126
             C 40 122, 40 118, 40 112
             C 40 108, 42 104, 44 100
             C 42 92, 40 84, 42 76
             C 42 68, 44 60, 46 54
             C 44 50, 40 50, 38 48
             C 34 46, 34 42, 38 38
             C 40 34, 44 32, 48 32
             C 52 32, 54 32, 58 36
             Z"
          fill="currentColor"
        />
      </motion.g>
    </motion.svg>
  )
}
