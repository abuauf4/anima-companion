import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const petProfiles = await db.petProfile.findMany({
      where: { userId: user.id },
      include: { petType: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ petProfiles })
  } catch (e) {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await req.json()
    const { petName, petTypeId, age, weight, notes } = body

    if (!petName || !petTypeId) {
      return NextResponse.json({ error: 'Nama hewan dan jenis wajib diisi' }, { status: 400 })
    }

    const petProfile = await db.petProfile.create({
      data: {
        userId: user.id,
        petName,
        petTypeId,
        age: age || '',
        weight: weight || '',
        notes: notes || null,
      },
      include: { petType: true },
    })
    return NextResponse.json({ petProfile })
  } catch (e) {
    console.error('Create pet profile error:', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
