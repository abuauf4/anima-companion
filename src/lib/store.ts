'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartItemData {
  productId: string
  slug: string
  name: string
  brand?: string
  price: number
  salePrice?: number | null
  image: string
  weight?: string | null
  quantity: number
}

interface CartState {
  items: CartItemData[]
  voucherCode: string | null
  addItem: (item: Omit<CartItemData, 'quantity'>, quantity?: number) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clear: () => void
  setVoucher: (code: string | null) => void
  totalItems: () => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      voucherCode: null,
      addItem: (item, quantity = 1) => {
        set((state) => {
          const existing = state.items.find((i) => i.productId === item.productId)
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.productId === item.productId
                  ? { ...i, quantity: i.quantity + quantity }
                  : i
              ),
            }
          }
          return { items: [...state.items, { ...item, quantity }] }
        })
      },
      removeItem: (productId) =>
        set((state) => ({
          items: state.items.filter((i) => i.productId !== productId),
        })),
      updateQuantity: (productId, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((i) => i.productId !== productId)
              : state.items.map((i) =>
                  i.productId === productId ? { ...i, quantity } : i
                ),
        })),
      clear: () => set({ items: [], voucherCode: null }),
      setVoucher: (code) => set({ voucherCode: code }),
      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    { name: 'anima-cart' }
  )
)

// ===================== UI Store =====================
interface UIState {
  mobileMenuOpen: boolean
  setMobileMenuOpen: (open: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  mobileMenuOpen: false,
  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
}))

// ===================== Home Hero Visibility Store =====================
// Redesign Phase 1.2 — Mobile nav hide/reveal driven by hero visibility.
// Set to true while the homepage hero is intersecting the viewport; consumers
// (MobileBottomBar) read this to know when to slide off-screen. Only ever set
// on the homepage by the IntersectionObserver in <HomeView />.
interface HomeHeroState {
  isVisible: boolean
  setVisible: (v: boolean) => void
}
export const useHomeHeroStore = create<HomeHeroState>((set) => ({
  isVisible: false,
  setVisible: (v) => set({ isVisible: v }),
}))

// ===================== Wishlist Store (no login required) =====================
export interface WishlistItemData {
  productId: string
  slug: string
  name: string
  brand?: string
  price: number
  salePrice?: number | null
  image: string
  weight?: string | null
  addedAt: number // timestamp
}

interface WishlistState {
  items: WishlistItemData[]
  toggleItem: (item: Omit<WishlistItemData, 'addedAt'>) => void
  removeItem: (productId: string) => void
  hasItem: (productId: string) => boolean
  clear: () => void
  totalItems: () => number
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      toggleItem: (item) => {
        set((state) => {
          const exists = state.items.find((i) => i.productId === item.productId)
          if (exists) {
            // Remove if already in wishlist
            return {
              items: state.items.filter((i) => i.productId !== item.productId),
            }
          }
          // Add new item
          return {
            items: [...state.items, { ...item, addedAt: Date.now() }],
          }
        })
      },
      removeItem: (productId) =>
        set((state) => ({
          items: state.items.filter((i) => i.productId !== productId),
        })),
      hasItem: (productId) => get().items.some((i) => i.productId === productId),
      clear: () => set({ items: [] }),
      totalItems: () => get().items.length,
    }),
    { name: 'anima-wishlist' }
  )
)
