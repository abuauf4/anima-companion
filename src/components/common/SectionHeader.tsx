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
      className={`flex ${isCenter ? 'flex-col items-center text-center' : 'flex-col items-start text-left md:flex-row md:items-end md:justify-between'} gap-3 ${className}`}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        className={isCenter ? 'max-w-2xl' : 'max-w-2xl'}
      >
        {eyebrow && (
          <span className="eyebrow mb-3">
            {eyebrowIcon}
            {eyebrow}
          </span>
        )}
        <h2 className="text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
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
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="shrink-0"
        >
          {action}
        </motion.div>
      )}
    </div>
  )
}
