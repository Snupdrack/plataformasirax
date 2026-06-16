import { NextResponse } from 'next/server'
import { validateRfc } from '@/lib/synkdata'
import { verifyToken, getTokenFromHeaders } from '@/lib/auth'

export async function POST(request: Request) {
  const token = getTokenFromHeaders(request.headers)
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const payload = verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

  const { rfc } = await request.json()
  const result = validateRfc(rfc)
  return NextResponse.json(result)
}
