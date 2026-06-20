'use client'

import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface RevealProps {
  children: ReactNode
  delay?: number
  y?: number
  className?: string
  once?: boolean
}

/**
 * Scroll-triggered reveal — single element.
 * Uses a spring transition for a more distinctive, premium entrance.
 */
export function Reveal({ children, delay = 0, y = 24, className = '', once = true }: RevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: '-100px' }}
      transition={{
        type: 'spring',
        stiffness: 100,
        damping: 20,
        delay,
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

interface StaggerProps {
  children: ReactNode
  className?: string
}

/**
 * Stagger container — wraps a list of <StaggerItem> children and reveals them
 * one-by-one as the container scrolls into view.
 *
 * - 50ms delay between children (tighter than the previous 80ms)
 * - Spring transition on each child for a more premium feel
 * - Triggers when 100px into the viewport
 * - Triggers only once (no re-running on scroll-back)
 */
export function Stagger({ children, className = '' }: StaggerProps) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-100px' }}
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: 0.05,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

interface StaggerItemProps {
  children: ReactNode
  className?: string
}

export function StaggerItem({ children, className = '' }: StaggerItemProps) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 24 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { type: 'spring', stiffness: 100, damping: 20 },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
