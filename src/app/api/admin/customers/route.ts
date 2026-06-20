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

    const where: any = { role: 'CUSTOMER' }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ]
    }

    const [total, customers] = await Promise.all([
      db.user.count({ where }),
      db.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, name: true, email: true, phone: true, createdAt: true,
          orders: {
            select: { id: true, total: true, status: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
          },
          petProfiles: { include: { petType: true } },
        },
      }),
    ])

    const customersWithStats = customers.map((c) => ({
      ...c,
      totalOrders: c.orders.length,
      totalSpent: c.orders.reduce((s, o) => s + o.total, 0),
    }))

    return NextResponse.json({
      customers: customersWithStats,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED' || e.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
