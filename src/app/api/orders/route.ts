import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { generateOrderNumber } from '@/lib/format'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const orders = await db.order.findMany({
      where: { userId: user.id },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ orders })
  } catch (e) {
    console.error('Get orders error:', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const body = await req.json()
    const { items, customerName, customerPhone, address, notes, voucherCode } = body

    if (!items?.length || !customerName || !customerPhone || !address) {
      return NextResponse.json(
        { error: 'Data pesanan tidak lengkap' },
        { status: 400 }
      )
    }

    // Verify products and compute totals
    const productIds = items.map((i: any) => i.productId)
    const products = await db.product.findMany({
      where: { id: { in: productIds } },
    })

    let subtotal = 0
    const orderItems: {
      productId: string
      productName: string
      productSku: string
      price: number
      quantity: number
      subtotal: number
    }[] = []
    for (const item of items as Array<{ productId: string; quantity: number }>) {
      const product = products.find((p) => p.id === item.productId)
      if (!product) continue
      const price = product.salePrice ?? product.price
      const lineSubtotal = price * item.quantity
      subtotal += lineSubtotal
      orderItems.push({
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        price,
        quantity: item.quantity,
        subtotal: lineSubtotal,
      })
    }

    if (!orderItems.length) {
      return NextResponse.json({ error: 'Tidak ada item valid' }, { status: 400 })
    }

    // Validate voucher if provided
    let discount = 0
    let appliedVoucherCode: string | null = null
    if (voucherCode) {
      const voucher = await db.voucher.findUnique({
        where: { code: voucherCode.toUpperCase().trim() },
      })
      if (voucher && voucher.isActive && subtotal >= voucher.minSpend) {
        if (!voucher.validUntil || new Date(voucher.validUntil) > new Date()) {
          discount =
            voucher.type === 'PERCENTAGE'
              ? Math.round((subtotal * voucher.value) / 100)
              : voucher.value
          appliedVoucherCode = voucher.code
        }
      }
    }

    const total = Math.max(0, subtotal - discount)

    // Generate order number
    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const todayCount = await db.order.count({
      where: { createdAt: { gte: todayStart } },
    })
    const orderNumber = generateOrderNumber(todayCount + 1)

    const order = await db.order.create({
      data: {
        orderNumber,
        userId: user?.id || null,
        status: 'PENDING',
        customerName,
        customerPhone,
        address,
        notes: notes || null,
        subtotal,
        discount,
        total,
        voucherCode: appliedVoucherCode,
        items: { create: orderItems },
      },
      include: { items: true },
    })

    // Reduce stock
    for (const item of orderItems) {
      await db.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      })
    }

    return NextResponse.json({ order })
  } catch (e) {
    console.error('Create order error:', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
