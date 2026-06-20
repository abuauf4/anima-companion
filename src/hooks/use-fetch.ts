'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'

export interface Seller {
  id: string
  name: string
  slug: string
  tagline: string | null
  description: string | null
  rating: number
  totalSales: number
  location: string | null
  isVerified: boolean
  isActive: boolean
  _count?: { products: number }
}

export interface Product {
  id: string
  name: string
  slug: string
  sku: string
  brand: string
  sellerId: string | null
  price: number
  salePrice: number | null
  subscribePrice: number | null
  isSubscribeEligible: boolean
  stock: number
  weight: string | null
  description: string
  benefit: string
  usage: string
  ingredients: string
  bpomNumber: string | null
  isBestSeller: boolean
  isNew: boolean
  isActive: boolean
  rating: number
  reviewCount: number
  categoryId: string
  createdAt: string
  category: { id: string; name: string; slug: string }
  seller?: { id: string; name: string; slug: string; isVerified: boolean } | null
  images: Array<{ id: string; url: string; alt: string | null; order: number }>
  petTypes?: Array<{ petType: { id: string; name: string; slug: string } }>
  problems?: Array<{ problem: { id: string; name: string; slug: string; color: string | null } }>
  reviews?: Array<{ id: string; userName: string; rating: number; comment: string; petType: string | null; createdAt: string }>
  avgRating?: number
}

export interface Problem {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  color: string | null
  _count?: { products: number }
}

export interface Category {
  id: string
  name: string
  slug: string
  icon: string | null
  _count?: { products: number }
}

export interface PetType {
  id: string
  name: string
  slug: string
  icon: string | null
  _count?: { products: number }
}

export interface Banner {
  id: string
  title: string
  subtitle: string | null
  imageUrl: string
  link: string | null
  position: string
  order: number
  isActive: boolean
}

export interface Testimonial {
  id: string
  name: string
  petName: string
  petType: string
  message: string
  rating: number
}

export interface Faq {
  id: string
  question: string
  answer: string
  order: number
  isActive: boolean
}

export interface Voucher {
  id: string
  code: string
  type: 'PERCENTAGE' | 'FIXED'
  value: number
  minSpend: number
  isActive: boolean
  description: string | null
}

export interface SaleCountdown {
  endsAt: string
}

export interface HomeData {
  banners: Banner[]
  bestSellers: Product[]
  newProducts: Product[]
  subscribeProducts: Product[]
  problems: Problem[]
  testimonials: Testimonial[]
  sellers: Seller[]
  petTypes: PetType[]
  saleCountdown: SaleCountdown
}

/** Generic fetch hook */
export function useFetch<T>(url: string | null, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(!!url)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!url) {
      setData(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch (e: any) {
      setError(e.message || 'Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }, [url])

  useEffect(() => {
    refetch()
  }, deps)

  return { data, loading, error, refetch, setData }
}

/** Add to cart helper with toast */
export async function addToCart(productId: string, quantity: number = 1) {
  try {
    await fetch(`/api/products?slug=`)
    toast.success('Produk ditambahkan ke keranjang')
    return true
  } catch {
    toast.error('Gagal menambahkan ke keranjang')
    return false
  }
}
