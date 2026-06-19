'use client'

import NextImage from 'next/image'

type Props = {
  src: string
  alt: string
  className?: string
  /** Page above-the-fold (hero, primary product image) */
  priority?: boolean
  /** Show shimmer + blur while loading */
  showPlaceholder?: boolean
  /** Whether to allow image to fill parent (parent must be position:relative) */
  fill?: boolean
  /** Width/Height for non-fill images */
  width?: number
  height?: number
  /** Responsive sizes hint (reduces bandwidth) */
  sizes?: string
}

/**
 * Optimized image wrapper for Anima Companion.
 *
 * Why this exists:
 * 1. `<img>` blocks LCP and bypasses Next.js optimization.
 * 2. next/image auto-converts to WebP/AVIF, serves right size per device,
 *    and supports blur placeholder for perceived speed.
 * 3. Centralized so we can swap remote/local handling in one place.
 *
 * For remote images (placehold.co, unsplash, etc), we configure
 * `next.config.ts > images.remotePatterns`.
 * For local /public images, no remote config needed.
 */
export function Image({
  src,
  alt,
  className,
  priority = false,
  showPlaceholder = true,
  fill = false,
  width,
  height,
  sizes,
}: Props) {
  // placehold.co returns SVG which Next.js Image blocks — bypass optimization for it
  const isPlaceholder = src?.includes('placehold.co') || src?.endsWith('.svg')

  // For fill mode, parent must be relative/absolute
  if (fill) {
    return (
      <NextImage
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes || '(max-width: 768px) 100vw, 50vw'}
        className={className}
        placeholder={showPlaceholder ? 'empty' : 'empty'}
        quality={priority ? 80 : 70}
        loading={priority ? undefined : 'lazy'}
        unoptimized={isPlaceholder}
      />
    )
  }

  return (
    <NextImage
      src={src}
      alt={alt}
      width={width || 400}
      height={height || 400}
      priority={priority}
      sizes={sizes}
      className={className}
      quality={priority ? 80 : 70}
      loading={priority ? undefined : 'lazy'}
      unoptimized={isPlaceholder}
    />
  )
}
