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
  // Variant support (Phase: Variants).
  // `variantId` is null/undefined for non-variant products (the default and
  // only case for all existing products). For variant products, this is the
  // chosen variant's id — different variants of the same product are
  // separate cart lines.
  // `variantName` is the snapshot of the variant name at add-to-cart time,
  // so the cart UI can display it even if the variant is later renamed.
  variantId?: string | null
  variantName?: string | null
}

interface CartState {
  items: CartItemData[]
  voucherCode: string | null
  addItem: (item: Omit<CartItemData, 'quantity'>, quantity?: number) => void
  removeItem: (productId: string, variantId?: string | null) => void
  updateQuantity: (productId: string, quantity: number, variantId?: string | null) => void
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
          // Merge key is (productId, variantId). Two cart items with the
          // same productId but DIFFERENT variantId are NOT merged — they
          // represent different variants of the same product and must
          // remain separate cart lines (per task brief).
          const variantId = item.variantId ?? null
          const existing = state.items.find(
            (i) => i.productId === item.productId && (i.variantId ?? null) === variantId
          )
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.productId === item.productId && (i.variantId ?? null) === variantId
                  ? { ...i, quantity: i.quantity + quantity }
                  : i
              ),
            }
          }
          return { items: [...state.items, { ...item, quantity }] }
        })
      },
      removeItem: (productId, variantId = null) =>
        set((state) => ({
          items: state.items.filter(
            (i) => !(i.productId === productId && (i.variantId ?? null) === (variantId ?? null))
          ),
        })),
      updateQuantity: (productId, quantity, variantId = null) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter(
                  (i) => !(i.productId === productId && (i.variantId ?? null) === (variantId ?? null))
                )
              : state.items.map((i) =>
                  i.productId === productId && (i.variantId ?? null) === (variantId ?? null)
                    ? { ...i, quantity }
                    : i
                ),
        })),
      clear: () => set({ items: [], voucherCode: null }),
      setVoucher: (code) => set({ voucherCode: code }),
      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    {
      name: 'anima-cart',
      // Version bump (Phase: Variants) — when a customer with an old cart
      // (pre-variants, items have no `variantId` field) loads the new code,
      // zustand persist will migrate the stored state. The migration adds
      // `variantId: null` to each item so the new merge logic works
      // uniformly. No items are dropped — existing carts are preserved.
      version: 2,
      migrate: (persistedState: any, version: number) => {
        if (!persistedState || !Array.isArray(persistedState.items)) {
          return persistedState
        }
        // If the persisted cart is from version 1 (pre-variants), add
        // `variantId: null` and `variantName: null` to each item so the
        // new code can treat them uniformly as "non-variant cart items".
        if (version < 2) {
          persistedState.items = persistedState.items.map((item: any) => ({
            ...item,
            variantId: item.variantId ?? null,
            variantName: item.variantName ?? null,
          }))
        }
        return persistedState
      },
    }
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
