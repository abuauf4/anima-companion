'use client'

import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface SectionHeaderProps {
  eyebrow?: string
  eyebrowIcon?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  align?: 'left' | 'center'
  action?: ReactNode
  className?: string
}

/**
 * Editorial-style section header.
 *
 * Visual upgrades:
 * - Small horizontal line BEFORE the eyebrow icon (editorial mark)
 * - Title uses font-extrabold + tracking-tight + leading-[1.05]
 * - Subtitle uses text-balance + text-pretty
 * - Action gets a subtle translate-x hover effect (handled via group on parent
 *   and a peer/group class on the action wrapper)
 * - Decorative blurred gradient blob in top-left corner (absolute, primary/5)
 */
export function SectionHeader({
  eyebrow,
  eyebrowIcon,
  title,
  subtitle,
  align = 'left',
  action,
  className = '',
}: SectionHeaderProps) {
  const isCenter = align === 'center'
  return (
    <div
      className={`relative ${isCenter ? 'flex flex-col items-center text-center' : 'flex flex-col items-start text-left md:flex-row md:items-end md:justify-between'} gap-3 ${className}`}
    >
      {/* Decorative gradient blob — top-left corner, faint, blurred */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-10 -top-10 -z-10 size-40 rounded-full bg-primary/5 blur-3xl"
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ type: 'spring', stiffness: 100, damping: 20, duration: 0.6 }}
        className={isCenter ? 'max-w-2xl' : 'max-w-2xl'}
      >
        {eyebrow && (
          <span className="eyebrow mb-3 gap-2">
            {/* Editorial horizontal line — small, primary color, before icon */}
            <span
              aria-hidden="true"
              className="inline-block h-px w-4 bg-primary"
            />
            {eyebrowIcon}
            {eyebrow}
          </span>
        )}
        <h2 className="text-balance text-2xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-3xl md:text-4xl">
          {title}
        </h2>
        {subtitle && (
          <p className={`mt-3 text-pretty text-sm text-muted-foreground sm:text-base ${isCenter ? 'mx-auto' : ''}`}>
            {subtitle}
          </p>
        )}
      </motion.div>

      {action && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ type: 'spring', stiffness: 100, damping: 20, delay: 0.05 }}
          className="group/action shrink-0 transition-transform duration-300 hover:translate-x-1"
        >
          {action}
        </motion.div>
      )}
    </div>
  )
}
