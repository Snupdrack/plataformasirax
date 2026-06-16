import { NextResponse } from 'next/server'
import { verifyToken, getTokenFromHeaders } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = getTokenFromHeaders(request.headers)
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const payload = verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

  const { id } = await params
  const check = await db.check.findUnique({ where: { id } })
  if (!check) return NextResponse.json({ error: 'Check no encontrado' }, { status: 404 })
  if (check.userId !== payload.userId && payload.role !== 'admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  return NextResponse.json({
    id: check.id,
    subject: {
      full_name: check.subjectName,
      curp: check.subjectCurp,
      rfc: check.subjectRfc,
      email: check.subjectEmail,
      phone: check.subjectPhone,
      username: check.subjectUsername,
      address: check.subjectAddress,
    },
    curp_validation: JSON.parse(check.curpValidation || 'null'),
    rfc_validation: JSON.parse(check.rfcValidation || 'null'),
    government: JSON.parse(check.government || 'null'),
    sanctions: JSON.parse(check.sanctions || 'null'),
    digital_identity: JSON.parse(check.digitalIdentity || 'null'),
    digital_footprint: JSON.parse(check.digitalFootprint || 'null'),
    relationship_graph: JSON.parse(check.relationshipGraph || 'null'),
    trust_score: check.trustScore,
    risk_score: check.riskScore,
    identity_confidence: check.identityConfidence,
    risk_level: check.riskLevel,
    recommendation: check.recommendation,
    flags: JSON.parse(check.flags || '[]'),
    breakdown: JSON.parse(check.breakdown || 'null'),
    ai_report: check.aiReport,
    sources_consulted: JSON.parse(check.sourcesConsulted || '[]'),
    created_at: check.createdAt.toISOString(),
  })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = getTokenFromHeaders(request.headers)
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const payload = verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

  if (!['admin', 'analyst'].includes(payload.role)) {
    return NextResponse.json({ error: 'Sin permisos suficientes' }, { status: 403 })
  }

  const { id } = await params
  await db.check.delete({ where: { id } })
  return NextResponse.json({ message: 'Check eliminado' })
}
