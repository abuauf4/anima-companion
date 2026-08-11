'use client'

import { motion } from 'framer-motion'

/**
 * DogSilhouette — organic seated friendly dog in side profile.
 *
 * Anatomy (side profile, facing left):
 *  - Recognizable muzzle jutting forward from the head.
 *  - SUBSTANTIAL floppy ear hanging DOWN from the back of the head.
 *    The ear flap extends DOWN PAST the head into the neck region
 *    (y=28-58), creating a clearly visible hanging flap that reads
 *    as "floppy ear" at a glance.
 *  - Compact body (similar proportions to the cat — not a wide blob).
 *  - Two DISTINCT front legs with clear gap (valley) between them.
 *  - Seated hindquarters with hind paw visible.
 *  - Long natural tail curving up behind the body.
 *
 *  Single solid fill (currentColor — brand orange set by parent).
 *  No inner ear accents, no collar, no gradient.
 *
 * Microinteraction preserved exactly:
 *  - bodyVariants drives whole-body lift/scale on hover/tap.
 *  - tailVariants drives a subtle tail rotate on hover.
 *  - MotionConfig reducedMotion='user' (set on <PetSelector>) strips
 *    transforms automatically when the user prefers reduced motion.
 */
const bodyVariants = {
  rest: { y: 0, scale: 1 },
  hover: { y: -3, scale: 1.02, transition: { duration: 0.5, ease: 'easeOut' as const } },
  tap: { y: 0, scale: 0.98, transition: { duration: 0.12 } },
} as const

const tailVariants = {
  rest: { rotate: 0 },
  hover: { rotate: -8, transition: { duration: 0.55, ease: 'easeOut' as const } },
  tap: { rotate: 0, transition: { duration: 0.12 } },
} as const

export function DogSilhouette({ className }: { className?: string }) {
  return (
    <motion.svg
      viewBox="0 0 120 140"
      className={className}
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <motion.g variants={bodyVariants} initial="rest" style={{ transformOrigin: '60px 130px' }}>
        {/* Tail — long natural tail curving up behind the body. Base
            sits at (78, 100) which is INSIDE the rump silhouette so
            the tail visually emerges from the rump. */}
        <motion.path
          variants={tailVariants}
          style={{ transformOrigin: '78px 100px' }}
          d="M 78 100
             C 90 96, 102 88, 106 76
             C 110 64, 106 54, 98 56
             C 90 58, 88 66, 90 72
             C 94 78, 90 86, 86 90
             C 84 94, 82 96, 78 100
             Z"
          fill="currentColor"
        />

        {/* Body — single closed organic path. COMPACT body (not a
            wide blob). SUBSTANTIAL floppy ear extending DOWN past
            the head into the neck region (clearly visible hanging
            flap, not upright). Pronounced muzzle juts forward. */}
        <path
          d="M 50 8
             C 54 6, 60 8, 64 14
             C 68 18, 72 22, 72 28
             C 80 32, 86 42, 84 54
             C 82 62, 76 62, 72 56
             C 70 52, 68 48, 68 44
             C 72 48, 76 52, 78 58
             C 80 66, 82 74, 82 84
             C 82 92, 80 100, 78 106
             C 80 110, 82 114, 80 120
             C 78 126, 74 128, 70 126
             C 72 122, 74 118, 74 114
             C 74 110, 72 108, 68 108
             C 64 110, 60 110, 54 108
             C 54 112, 54 118, 54 124
             C 54 128, 52 130, 48 128
             C 46 126, 46 122, 46 118
             C 46 114, 46 110, 46 108
             C 46 110, 46 116, 46 122
             C 46 126, 44 128, 40 128
             C 38 128, 36 128, 36 124
             C 36 120, 36 116, 36 110
             C 36 106, 38 102, 40 98
             C 38 90, 36 82, 38 74
             C 38 66, 40 58, 42 52
             C 40 48, 34 46, 28 44
             C 22 42, 22 36, 26 32
             C 30 28, 36 28, 40 30
             C 44 26, 48 18, 50 12
             C 50 10, 50 8, 50 8
             Z"
          fill="currentColor"
        />
      </motion.g>
    </motion.svg>
  )
}
