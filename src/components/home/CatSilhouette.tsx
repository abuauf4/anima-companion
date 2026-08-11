'use client'

import { motion } from 'framer-motion'

/**
 * CatSilhouette — simple, friendly sitting cat SVG.
 *
 * Design notes:
 *  - Sitting profile, head turned slightly forward (3/4 view) so both ears
 *    and the face profile are recognizable at a glance.
 *  - Pointed ears with small inner-ear accent (slightly darker tone of the
 *    same hue) — adds the "kucing" cue without being a cartoon eye/face.
 *  - Curled tail wrapping around the body base — animatable separately
 *    on hover via the `tail` variants (subtle rotate, no infinite motion).
 *  - Single solid fill, no gradient, no shadow inside the SVG. Soft
 *    ground shadow is provided by the parent <PetSelectorItem>.
 *  - viewBox 0 0 120 140 — portrait orientation, fits a tall narrow
 *    silhouette column on mobile.
 *
 * Why motion.svg instead of plain <svg>: we need sub-element transforms
 * (tail rotate, body translateY + scale) and `prefers-reduced-motion`
 * handling. Framer Motion respects the user's OS setting automatically
 * when `MotionConfig { reducedMotion: 'user' }` is set at the parent
 * (we set it on <PetSelector>).
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
      {/* Body + head + ears (single solid fill, brand purple) */}
      <motion.g variants={bodyVariants} initial="rest" style={{ transformOrigin: '60px 130px' }}>
        {/* Tail — drawn first so it sits behind the body.
            Curled S-shape wrapping around the right side of the body base.
            transform-origin set near the base of the tail (where it meets
            the body) so the hover rotate feels natural. */}
        <motion.path
          variants={tailVariants}
          style={{ transformOrigin: '88px 118px' }}
          d="M86 118
             C 102 116, 110 104, 106 92
             C 104 84, 96 80, 90 84
             C 86 86, 86 92, 90 94
             C 94 96, 96 100, 94 104
             C 92 108, 86 108, 82 112
             Z"
          fill="currentColor"
        />

        {/* Body — pear silhouette: narrower at top (chest), wider at base */}
        <path
          d="M44 60
             C 44 50, 48 44, 56 42
             L 56 38
             C 52 36, 50 32, 50 28
             C 50 22, 54 18, 60 18
             C 66 18, 70 22, 70 28
             C 70 32, 68 36, 64 38
             L 64 42
             C 72 44, 76 50, 76 60
             L 76 112
             C 76 122, 70 130, 60 130
             C 50 130, 44 122, 44 112
             Z"
          fill="currentColor"
        />

        {/* Left ear (outer) */}
        <path
          d="M48 36 L 44 14 L 60 28 Z"
          fill="currentColor"
        />
        {/* Right ear (outer) */}
        <path
          d="M72 36 L 76 14 L 60 28 Z"
          fill="currentColor"
        />
        {/* Inner ears — slightly deeper tone of the same hue (no gradient) */}
        <path
          d="M50 32 L 48 20 L 56 28 Z"
          fill="oklch(0.40 0.20 295)"
          opacity="0.55"
        />
        <path
          d="M70 32 L 72 20 L 64 28 Z"
          fill="oklch(0.40 0.20 295)"
          opacity="0.55"
        />

        {/* Whisker hint — two thin lines per side, very subtle.
            Drawn with stroke (no fill) so they don't read as cartoon mouth. */}
        <g stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.35">
          <line x1="32" y1="44" x2="46" y2="46" />
          <line x1="32" y1="48" x2="46" y2="48" />
          <line x1="88" y1="44" x2="74" y2="46" />
          <line x1="88" y1="48" x2="74" y2="48" />
        </g>
      </motion.g>
    </motion.svg>
  )
}
