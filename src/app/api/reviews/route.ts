import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const body = await req.json()
    const { productId, userName, rating, comment, petType } = body

    if (!productId || !rating || !comment || !userName) {
      return NextResponse.json({ error: 'Data review tidak lengkap' }, { status: 400 })
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating harus 1-5' }, { status: 400 })
    }

    const review = await db.review.create({
      data: {
        productId,
        userId: user?.id || null,
        userName,
        rating: parseInt(rating),
        comment,
        petType: petType || null,
      },
    })
    return NextResponse.json({ review })
  } catch (e) {
    console.error('Create review error:', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
