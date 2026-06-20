import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
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
          images: { take: 1, orderBy: { order: 'asc' } },
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
    if (e.message === 'UNAUTHORIZED' || e.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const body = await req.json()
    const {
      name, sku, brand, price, salePrice, stock, weight,
      description, benefit, usage, ingredients, bpomNumber,
      isBestSeller, isNew, isActive, categoryId,
      petTypeIds, problemIds, images,
    } = body

    if (!name || !sku || !price || !categoryId) {
      return NextResponse.json({ error: 'Field wajib tidak lengkap' }, { status: 400 })
    }

    const slug = name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') + '-' + Date.now().toString(36)

    const existingSku = await db.product.findUnique({ where: { sku } })
    if (existingSku) {
      return NextResponse.json({ error: 'SKU sudah digunakan' }, { status: 409 })
    }

    const product = await db.product.create({
      data: {
        name, slug, sku, brand: brand || 'Anima',
        price: parseInt(price),
        salePrice: salePrice ? parseInt(salePrice) : null,
        stock: parseInt(stock) || 0,
        weight: weight || null,
        description, benefit, usage, ingredients,
        bpomNumber: bpomNumber || null,
        isBestSeller: !!isBestSeller,
        isNew: !!isNew,
        isActive: isActive !== false,
        categoryId,
        images: images?.length
          ? { create: images.map((url: string, i: number) => ({ url, alt: name, order: i })) }
          : {
              create: [
                { url: `https://placehold.co/600x600/F97316/ffffff?text=${encodeURIComponent(name)}`, alt: name, order: 0 },
              ],
            },
        petTypes: petTypeIds?.length
          ? { create: petTypeIds.map((id: string) => ({ petTypeId: id })) }
          : undefined,
        problems: problemIds?.length
          ? { create: problemIds.map((id: string) => ({ problemId: id })) }
          : undefined,
      },
      include: { category: true, images: true, petTypes: true, problems: true },
    })

    return NextResponse.json({ product })
  } catch (e: any) {
    console.error('Create product error:', e)
    if (e.message === 'UNAUTHORIZED' || e.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
