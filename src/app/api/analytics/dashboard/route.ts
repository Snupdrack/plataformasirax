import { NextResponse } from 'next/server'
import { verifyToken, getTokenFromHeaders } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  const token = getTokenFromHeaders(request.headers)
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const payload = verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

  const checks = await db.check.findMany({
    where: { userId: payload.userId },
    orderBy: { createdAt: 'desc' },
    take: 500,
  })

  const totalChecks = checks.length
  const avgTrust = totalChecks > 0 ? Math.round(checks.reduce((s, c) => s + c.trustScore, 0) / totalChecks) : 0
  const avgRisk = totalChecks > 0 ? Math.round(checks.reduce((s, c) => s + c.riskScore, 0) / totalChecks) : 0

  const riskDistribution: Record<string, number> = { BAJO: 0, MEDIO: 0, ALTO: 0, CRITICO: 0 }
  const recDistribution: Record<string, number> = { APPROVE: 0, REVIEW: 0, REJECT: 0 }
  let sanctionsMatches = 0
  let pepMatches = 0

  for (const c of checks) {
    riskDistribution[c.riskLevel] = (riskDistribution[c.riskLevel] || 0) + 1
    recDistribution[c.recommendation] = (recDistribution[c.recommendation] || 0) + 1
    const sanc = JSON.parse(c.sanctions || 'null')
    if (sanc?.is_sanctioned) sanctionsMatches++
    if (sanc?.is_pep) pepMatches++
  }

  // Generate trend data for last 14 days
  const now = new Date()
  const trend14Days = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const count = checks.filter(c => c.createdAt.toISOString().split('T')[0] === dateStr).length
    trend14Days.push({ date: dateStr.substring(5), count })
  }

  // Recent checks
  const recentChecks = checks.slice(0, 10).map(c => ({
    id: c.id,
    subject: { full_name: c.subjectName },
    trust_score: c.trustScore,
    risk_level: c.riskLevel,
    recommendation: c.recommendation,
    created_at: c.createdAt.toISOString(),
  }))

  return NextResponse.json({
    total_checks: totalChecks,
    average_trust_score: avgTrust,
    average_risk_score: avgRisk,
    sanctions_matches: sanctionsMatches,
    pep_matches: pepMatches,
    risk_distribution: riskDistribution,
    recommendation_distribution: recDistribution,
    trend_14_days: trend14Days,
    recent_checks: recentChecks,
  })
}
