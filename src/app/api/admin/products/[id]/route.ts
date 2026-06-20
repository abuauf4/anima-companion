import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const body = await req.json()
    const {
      name, sku, brand, price, salePrice, stock, weight,
      description, benefit, usage, ingredients, bpomNumber,
      isBestSeller, isNew, isActive, categoryId,
      petTypeIds, problemIds, images,
    } = body

    // Update product
    const updated = await db.product.update({
      where: { id },
      data: {
        name, sku, brand: brand || 'Anima',
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
      },
    })

    // Sync petTypes and problems relations
    if (petTypeIds !== undefined) {
      await db.productPetType.deleteMany({ where: { productId: id } })
      if (petTypeIds.length) {
        await db.productPetType.createMany({
          data: petTypeIds.map((pid: string) => ({ productId: id, petTypeId: pid })),
        })
      }
    }
    if (problemIds !== undefined) {
      await db.productProblem.deleteMany({ where: { productId: id } })
      if (problemIds.length) {
        await db.productProblem.createMany({
          data: problemIds.map((pid: string) => ({ productId: id, problemId: pid })),
        })
      }
    }
    if (images !== undefined) {
      await db.productImage.deleteMany({ where: { productId: id } })
      if (images.length) {
        await db.productImage.createMany({
          data: images.map((url: string, i: number) => ({ productId: id, url, alt: name, order: i })),
        })
      }
    }

    return NextResponse.json({ product: updated })
  } catch (e: any) {
    console.error('Update product error:', e)
    if (e.message === 'UNAUTHORIZED' || e.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    await db.product.update({
      where: { id },
      data: { isActive: false },
    })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED' || e.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
