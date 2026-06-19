'use client'

import { useEffect, useRef, useState } from 'react'
import { useHashRouter } from '@/lib/router'
import { useSearch } from '@/hooks/use-search'
import { formatRupiah, effectivePrice } from '@/lib/format'
import { Search, Loader2, X, ArrowRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { motion, AnimatePresence } from 'framer-motion'

interface SearchAutocompleteProps {
  /** Controlled value (optional — if omitted, component manages its own state) */
  value?: string
  onChange?: (value: string) => void
  onSubmit?: (value: string) => void
  placeholder?: string
  /** Mobile uses different styling (full width, no rounded) */
  variant?: 'desktop' | 'mobile'
  autoFocus?: boolean
}

/**
 * Search input with real-time autocomplete dropdown.
 *
 * Features:
 * - Debounced search (250ms) triggers /api/products?search=...
 * - Dropdown shows up to 5 product suggestions with image + name + price
 * - Click suggestion → navigate to product detail
 * - Press Enter → navigate to /shop?search=...
 * - Press Escape → close dropdown
 * - Click outside → close dropdown
 * - Loading spinner during fetch
 * - "Lihat semua hasil" link at bottom of dropdown
 */
export function SearchAutocomplete({
  value: controlledValue,
  onChange,
  onSubmit,
  placeholder = 'Cari suplemen, vitamin, perawatan...',
  variant = 'desktop',
  autoFocus = false,
}: SearchAutocompleteProps) {
  const { navigate } = useHashRouter()
  const [internalValue, setInternalValue] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1) // -1 = none, 0..n = suggestion

  const value = controlledValue ?? internalValue
  const setValue = (v: string) => {
    if (onChange) onChange(v)
    else setInternalValue(v)
  }

  const { suggestions, loading } = useSearch(value, { minChars: 1, debounceMs: 250, limit: 5 })
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset active index when suggestions change
  useEffect(() => {
    setActiveIndex(-1)
  }, [suggestions])

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    const q = value.trim()
    if (!q) return
    setIsOpen(false)
    if (onSubmit) onSubmit(q)
    else navigate(`/shop?search=${encodeURIComponent(q)}`)
  }

  const handleSelectSuggestion = (slug: string) => {
    setIsOpen(false)
    setValue('')
    navigate(`/product/${slug}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' && suggestions.length > 0) {
        setIsOpen(true)
        setActiveIndex(0)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, -1))
        break
      case 'Enter':
        e.preventDefault()
        if (activeIndex >= 0 && suggestions[activeIndex]) {
          handleSelectSuggestion(suggestions[activeIndex].slug)
        } else {
          handleSubmit()
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        setActiveIndex(-1)
        inputRef.current?.blur()
        break
    }
  }

  const showDropdown = isOpen && value.trim().length >= 1

  return (
    <div ref={containerRef} className="relative w-full">
      <form onSubmit={handleSubmit} className="relative w-full">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="search"
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => {
            if (value.trim().length >= 1) setIsOpen(true)
          }}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
          className={`pl-9 ${variant === 'mobile' ? '' : 'bg-card'} ${
            variant === 'mobile' ? 'h-11' : ''
          } pr-8`}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="search-suggestions"
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `suggestion-${activeIndex}` : undefined
          }
        />
        {/* Clear button */}
        {value && (
          <button
            type="button"
            onClick={() => {
              setValue('')
              inputRef.current?.focus()
              setIsOpen(false)
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Hapus pencarian"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>

      {/* Loading spinner */}
      {loading && showDropdown && (
        <div className="absolute right-10 top-1/2 -translate-y-1/2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Dropdown suggestions */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            id="search-suggestions"
            role="listbox"
            className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
          >
            {suggestions.length === 0 && !loading ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                Tidak ada produk untuk &ldquo;{value}&rdquo;
              </div>
            ) : (
              <>
                {suggestions.map((s, i) => {
                  const price = effectivePrice(s.price, s.salePrice)
                  const isActive = i === activeIndex
                  return (
                    <button
                      key={s.id}
                      id={`suggestion-${i}`}
                      role="option"
                      aria-selected={isActive}
                      onClick={() => handleSelectSuggestion(s.slug)}
                      onMouseEnter={() => setActiveIndex(i)}
                      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                        isActive ? 'bg-accent' : 'hover:bg-accent/50'
                      }`}
                    >
                      {/* Product image (or color block fallback) */}
                      <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                        {s.image ? (
                          <img
                            src={s.image}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">AC</span>
                        )}
                      </div>

                      {/* Product info */}
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-sm font-medium text-foreground">
                          {s.name}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {s.brand && <span>{s.brand}</span>}
                          {s.category && (
                            <>
                              <span className="text-muted-foreground/40">•</span>
                              <span>{s.category}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Price */}
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-bold text-primary">
                          {formatRupiah(price)}
                        </div>
                        {s.salePrice && (
                          <div className="text-[10px] text-muted-foreground line-through">
                            {formatRupiah(s.price)}
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}

                {/* "See all results" link */}
                <button
                  onClick={() => handleSubmit()}
                  className="flex w-full items-center justify-center gap-1.5 border-t border-border bg-muted/30 px-3 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-accent"
                >
                  Lihat semua hasil untuk &ldquo;{value}&rdquo;
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
