import { NextResponse } from 'next/server'
import { hashPassword, signToken } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const { email, password, fullName, role, organization } = await request.json()

    if (!email || !password || !fullName) {
      return NextResponse.json({ error: 'Email, password y nombre son requeridos' }, { status: 400 })
    }

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'El email ya está registrado' }, { status: 409 })
    }

    const passwordHash = await hashPassword(password)
    const user = await db.user.create({
      data: {
        email,
        passwordHash,
        fullName,
        role: role || 'analyst',
        organization,
      }
    })

    const token = signToken({ userId: user.id, email: user.email, role: user.role, fullName: user.fullName })

    return NextResponse.json({
      token,
      user: { id: user.id, email: user.email, full_name: user.fullName, role: user.role, organization: user.organization }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
