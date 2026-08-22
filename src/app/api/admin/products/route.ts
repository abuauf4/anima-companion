import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission, handleAuthError } from '@/lib/admin-auth'
import {
  validateAdminVariants,
  deriveParentCacheFromVariants,
} from '@/lib/product-variants'

export async function GET(req: NextRequest) {
  try {
    await requirePermission('products.view')
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = 20

    const where: any = search
      ? {
          OR: [
            { name: { contains: search } },
            { sku: { contains: search } },
            { brand: { contains: search } },
          ],
        }
      : {}

    const [total, products] = await Promise.all([
      db.product.count({ where }),
      db.product.findMany({
        where,
        include: {
          category: true,
          // Return ALL ProductImage rows ordered by their `order` field.
          // The list-table thumbnail reads images[0] (still works — first of
          // a larger array). The edit dialog needs the full array so it can
          // populate the image gallery with every existing image (local
          // /products/<slug>/0N.webp and Cloudinary URLs alike). Previously
          // `take: 1` truncated the array to a single image, which silently
          // hid the rest from the admin edit dialog — that was the bug
          // behind "existing static product images are missing when editing".
          images: { orderBy: { order: 'asc' } },
          // Variants — include ALL variants (active + inactive) so the admin
          // edit dialog can show inactive variants and let the admin
          // re-activate them. Public APIs filter to active only.
          variants: { orderBy: { sortOrder: 'asc' } },
          _count: { select: { orderItems: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    return NextResponse.json({
      products,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (e: any) {
    const authRes = handleAuthError(e)
    if (authRes) return authRes
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requirePermission('products.manage')
    const body = await req.json()
    const {
      name, sku, brand, price, salePrice, stock, weight,
      description, benefit, usage, ingredients, bpomNumber,
      isBestSeller, isNew, isActive, categoryId,
      petTypeIds, problemIds, images,
      // Variant fields (Phase: Variants)
      hasVariants, variants,
    } = body

    if (!name || !sku || !categoryId) {
      return NextResponse.json({ error: 'Field wajib tidak lengkap' }, { status: 400 })
    }

    // ---- Variant validation / normalization (BEFORE creating Product) ----
    // If hasVariants=true, validate the variants array and derive the parent
    // price/salePrice/stock from the active variants. The admin form does
    // NOT send parent price/stock when variants are enabled — we compute them.
    //
    // If hasVariants=false (or omitted), the parent price/salePrice/stock
    // come from the body as before. This is the backward-compatible path.
    let normalizedVariants: import('@/lib/product-variants').NormalizedVariantInput[] | null = null
    let parentPrice: number
    let parentSalePrice: number | null
    let parentStock: number

    if (hasVariants === true) {
      const result = validateAdminVariants(variants)
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
      normalizedVariants = result.variants
      const derived = deriveParentCacheFromVariants(normalizedVariants)
      parentPrice = derived.price
      parentSalePrice = derived.salePrice
      parentStock = derived.stock
    } else {
      // Backward-compatible: parent fields from body
      if (!price) {
        return NextResponse.json({ error: 'Field wajib tidak lengkap' }, { status: 400 })
      }
      parentPrice = parseInt(price)
      parentSalePrice = salePrice ? parseInt(salePrice) : null
      parentStock = parseInt(stock) || 0
    }

    const slug = name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') + '-' + Date.now().toString(36)

    const existingSku = await db.product.findUnique({ where: { sku } })
    if (existingSku) {
      return NextResponse.json({ error: 'SKU sudah digunakan' }, { status: 409 })
    }

    // Product images are now static local assets under /public/products/<slug>/0N.webp.
    // If admin provides images, use them. If not, default to the canonical local
    // path /products/<slug>/01.webp so the DB is always correct & ready — the
    // owner can drop a real image into /public/products/<slug>/ later without
    // any DB update. No remote/Cloudinary fallback.
    const imageUrls: string[] = Array.isArray(images) && images.length > 0
      ? images.filter(Boolean)
      : [`/products/${slug}/01.webp`]

    const product = await db.product.create({
      data: {
        name, slug, sku, brand: brand || 'Anima',
        price: parentPrice,
        salePrice: parentSalePrice,
        stock: parentStock,
        weight: weight || null,
        description, benefit, usage, ingredients,
        bpomNumber: bpomNumber || null,
        isBestSeller: !!isBestSeller,
        isNew: !!isNew,
        isActive: isActive !== false,
        hasVariants: hasVariants === true,
        categoryId,
        images: {
          create: imageUrls.map((url: string, i: number) => ({ url, alt: name, order: i })),
        },
        petTypes: petTypeIds?.length
          ? { create: petTypeIds.map((id: string) => ({ petTypeId: id })) }
          : undefined,
        problems: problemIds?.length
          ? { create: problemIds.map((id: string) => ({ problemId: id })) }
          : undefined,
        // Variants — only create if hasVariants=true and we have validated variants
        variants: normalizedVariants
          ? {
              create: normalizedVariants.map((v, i) => ({
                name: v.name,
                price: v.price,
                salePrice: v.salePrice,
                stock: v.stock,
                isActive: v.isActive,
                sortOrder: v.sortOrder ?? i,
              })),
            }
          : undefined,
      },
      include: {
        category: true,
        images: true,
        petTypes: true,
        problems: true,
        variants: { orderBy: { sortOrder: 'asc' } },
      },
    })

    return NextResponse.json({ product })
  } catch (e: any) {
    console.error('Create product error:', e)
    const authRes = handleAuthError(e)
    if (authRes) return authRes
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
