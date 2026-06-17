import { NextResponse } from 'next/server'
import { verifyToken, getTokenFromHeaders } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  const token = getTokenFromHeaders(request.headers)
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const payload = verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

  const user = await db.user.findUnique({ where: { id: payload.userId } })
  if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  return NextResponse.json({
    id: user.id, email: user.email, full_name: user.fullName, role: user.role, organization: user.organization
  })
}
