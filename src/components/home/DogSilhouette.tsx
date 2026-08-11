'use client'

import { motion } from 'framer-motion'

/**
 * DogSilhouette — simple, friendly sitting dog SVG.
 *
 * Design notes:
 *  - Sitting profile, head forward, floppy ears hanging down — the
 *    universal "good boy sitting" pose. Reads as a dog instantly
 *    without needing a face.
 *  - Curled tail over the back hip — animatable separately on hover
 *    via the `tail` variants (subtle rotate, no infinite motion).
 *  - Single solid fill, no gradient, no inner shadow.
 *  - viewBox 0 0 120 140 — matches CatSilhouette so the two icons
 *    visually balance side-by-side at the same height.
 *
 * The body is a single closed path so the silhouette reads as one
 * solid shape (not a stacked composite of separate primitives). Floppy
 * ears are separate paths so we can subtly bounce them on hover if
 * desired (currently they move with the body — kept simple).
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
        {/* Tail — curled up over the right hip.
            Drawn first so it sits behind the body. transform-origin is
            near the tail base so the hover rotate pivots naturally. */}
        <motion.path
          variants={tailVariants}
          style={{ transformOrigin: '84px 96px' }}
          d="M82 96
             C 96 88, 108 78, 102 64
             C 100 58, 94 56, 92 60
             C 90 64, 94 68, 92 72
             C 90 78, 82 84, 76 92
             Z"
          fill="currentColor"
        />

        {/* Body — sitting silhouette:
            broad chest → narrow waist → sits on haunches.
            One closed path includes the back, rump, hind leg base, belly,
            and front leg base. Head is separate (with ears attached). */}
        <path
          d="M40 70
             C 40 60, 44 54, 50 52
             L 50 48
             C 46 44, 44 38, 46 32
             C 48 24, 54 20, 60 20
             C 66 20, 72 24, 74 32
             C 76 38, 74 44, 70 48
             L 70 52
             C 76 54, 80 60, 80 70
             L 80 110
             C 80 122, 74 130, 60 130
             C 46 130, 40 122, 40 110
             Z"
          fill="currentColor"
        />

        {/* Floppy left ear — hangs from the left side of the head */}
        <path
          d="M44 38
             C 38 42, 34 50, 36 58
             C 38 64, 42 64, 46 60
             C 48 56, 48 46, 48 40
             Z"
          fill="currentColor"
        />
        {/* Floppy right ear — hangs from the right side of the head */}
        <path
          d="M76 38
             C 82 42, 86 50, 84 58
             C 82 64, 78 64, 74 60
             C 72 56, 72 46, 72 40
             Z"
          fill="currentColor"
        />

        {/* Inner ears — slightly deeper tone of the same hue (no gradient) */}
        <path
          d="M44 44 C 40 48, 38 54, 40 58 C 41 60, 43 60, 44 58 Z"
          fill="oklch(0.55 0.20 45)"
          opacity="0.55"
        />
        <path
          d="M76 44 C 80 48, 82 54, 80 58 C 79 60, 77 60, 76 58 Z"
          fill="oklch(0.55 0.20 45)"
          opacity="0.55"
        />

        {/* Collar hint — a thin line at the neck, very subtle.
            Just enough to suggest a collar without becoming a feature. */}
        <line
          x1="48" y1="54" x2="72" y2="54"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.30"
        />
      </motion.g>
    </motion.svg>
  )
}
