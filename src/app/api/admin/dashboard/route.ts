import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export async function GET() {
  try {
    await requireAdmin()
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    const [
      totalRevenue,
      totalOrders,
      totalCustomers,
      totalProducts,
      monthlyRevenue,
      prevMonthRevenue,
      pendingOrders,
      recentOrders,
      topProducts,
      salesByProblem,
    ] = await Promise.all([
      db.order.aggregate({ _sum: { total: true }, where: { status: 'COMPLETED' } }),
      db.order.count(),
      db.user.count({ where: { role: 'CUSTOMER' } }),
      db.product.count({ where: { isActive: true } }),
      db.order.aggregate({
        _sum: { total: true },
        where: { createdAt: { gte: startOfMonth } },
      }),
      db.order.aggregate({
        _sum: { total: true },
        where: {
          createdAt: { gte: startOfPrevMonth, lt: startOfMonth },
        },
      }),
      db.order.count({ where: { status: 'PENDING' } }),
      db.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { items: true },
      }),
      db.orderItem.groupBy({
        by: ['productId'],
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
      // Sales by problem category
      db.problem.findMany({
        include: {
          products: {
            include: {
              product: {
                include: {
                  orderItems: { select: { quantity: true, subtotal: true } },
                },
              },
            },
          },
        },
      }),
    ])

    const topProductIds = topProducts.map((t) => t.productId)
    const topProductDetails = await db.product.findMany({
      where: { id: { in: topProductIds } },
      include: { images: { take: 1 } },
    })

    const topProductsWithSales = topProducts.map((t) => {
      const p = topProductDetails.find((pd) => pd.id === t.productId)
      return p ? { ...p, sold: t._sum.quantity } : null
    }).filter(Boolean)

    const salesByProblemData = salesByProblem.map((p) => {
      const revenue = p.products.reduce((sum, pp) => {
        return sum + pp.product.orderItems.reduce((s, oi) => s + oi.subtotal, 0)
      }, 0)
      const sold = p.products.reduce((sum, pp) => {
        return sum + pp.product.orderItems.reduce((s, oi) => s + oi.quantity, 0)
      }, 0)
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        color: p.color,
        revenue,
        sold,
      }
    }).sort((a, b) => b.revenue - a.revenue)

    const revenueGrowth = prevMonthRevenue._sum.total
      ? ((monthlyRevenue._sum.total - prevMonthRevenue._sum.total) / prevMonthRevenue._sum.total) * 100
      : 0

    return NextResponse.json({
      stats: {
        totalRevenue: totalRevenue._sum.total || 0,
        totalOrders,
        totalCustomers,
        totalProducts,
        monthlyRevenue: monthlyRevenue._sum.total || 0,
        revenueGrowth: Math.round(revenueGrowth * 10) / 10,
        pendingOrders,
      },
      recentOrders,
      topProducts: topProductsWithSales,
      salesByProblem: salesByProblemData,
    })
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED' || e.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 403 })
    }
    console.error('Dashboard error:', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
