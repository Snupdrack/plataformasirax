import { NextResponse } from 'next/server'
import { verifyToken, getTokenFromHeaders } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  validateCurp, validateRfc, queryRenapo, querySat, queryImss, queryRnd,
  screenSanctions, enrichEmail, enrichPhone, discoverUsername,
  calculateDigitalFootprint, buildRelationshipGraph, calculateScores,
} from '@/lib/synkdata'

export async function POST(request: Request) {
  const token = getTokenFromHeaders(request.headers)
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const payload = verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

  try {
    const body = await request.json()
    const {
      full_name, curp, rfc, email, phone, username, address,
      include_government = true, include_sanctions = true,
      include_digital = true, include_relationship = true,
      include_ai_report = true,
    } = body

    if (!full_name) {
      return NextResponse.json({ error: 'full_name es requerido' }, { status: 400 })
    }

    const sourcesConsulted: string[] = []
    const modules: any = {}

    // 1. Identity Verification
    if (curp) {
      modules.curp_validation = validateCurp(curp, full_name)
      sourcesConsulted.push('RENAPO (algoritmo CURP)')
    }
    if (rfc) {
      modules.rfc_validation = validateRfc(rfc)
      sourcesConsulted.push('SAT (algoritmo RFC)')
    }

    // 2. Government Intelligence
    if (include_government) {
      const gov: any = {}
      if (curp) {
        gov.renapo = queryRenapo(curp, full_name)
        sourcesConsulted.push('RENAPO')
      }
      if (rfc) {
        gov.sat = querySat(rfc)
        sourcesConsulted.push('SAT')
      }
      if (body.nss || curp) {
        gov.imss = queryImss(body.nss, curp)
        sourcesConsulted.push('IMSS')
      }
      const nameParts = full_name.split(' ')
      gov.rnd = queryRnd(nameParts[0], nameParts[1] || '', nameParts[2], body.estado)
      sourcesConsulted.push('RND (SSPC)')
      modules.government = gov
    }

    // 3. Sanctions Screening
    if (include_sanctions) {
      modules.sanctions = screenSanctions(full_name)
      sourcesConsulted.push('OFAC SDN', 'ONU', 'OpenSanctions', 'PEP', 'SAT 69-B', 'Interpol')
    }

    // 4. Digital Identity Intelligence
    if (include_digital) {
      const di: any = {}
      if (email) {
        di.email = enrichEmail(email)
        sourcesConsulted.push('HaveIBeenPwned', 'Hunter.io', 'DNS MX Records')
      }
      if (phone) {
        di.phone = enrichPhone(phone)
        sourcesConsulted.push('NumVerify', 'Truecaller')
      }
      if (username) {
        di.username = discoverUsername(username)
        sourcesConsulted.push('Sherlock', 'Maigret', 'WhatsMyName')
      }
      modules.digital_identity = di

      // 5. Digital Footprint
      modules.digital_footprint = calculateDigitalFootprint(di.email, di.username)
    }

    // 6. Scoring
    const scores = calculateScores(modules)

    // 7. Relationship Graph
    if (include_relationship) {
      const digitalProfiles = modules.digital_footprint?.profiles
      const sanctionsMatches = modules.sanctions?.matches
      modules.relationship_graph = buildRelationshipGraph(
        full_name, email, phone, curp, rfc, address, username,
        digitalProfiles, sanctionsMatches, scores.risk_score, scores.risk_level
      )
    }

    // 8. AI Report (simplified - generates structured report without external LLM)
    let aiReport = ''
    if (include_ai_report) {
      aiReport = generateReport(full_name, modules, scores)
    }

    // Save to database
    const check = await db.check.create({
      data: {
        userId: payload.userId,
        subjectName: full_name,
        subjectCurp: curp || null,
        subjectRfc: rfc || null,
        subjectEmail: email || null,
        subjectPhone: phone || null,
        subjectUsername: username || null,
        subjectAddress: address || null,
        includeGovernment: include_government,
        includeSanctions: include_sanctions,
        includeDigital: include_digital,
        includeRelationship: include_relationship,
        includeAiReport: include_ai_report,
        curpValidation: JSON.stringify(modules.curp_validation || null),
        rfcValidation: JSON.stringify(modules.rfc_validation || null),
        government: JSON.stringify(modules.government || null),
        sanctions: JSON.stringify(modules.sanctions || null),
        digitalIdentity: JSON.stringify(modules.digital_identity || null),
        digitalFootprint: JSON.stringify(modules.digital_footprint || null),
        relationshipGraph: JSON.stringify(modules.relationship_graph || null),
        trustScore: scores.trust_score,
        riskScore: scores.risk_score,
        identityConfidence: scores.identity_confidence,
        riskLevel: scores.risk_level,
        recommendation: scores.recommendation,
        flags: JSON.stringify(scores.flags),
        breakdown: JSON.stringify(scores.breakdown),
        aiReport: aiReport,
        sourcesConsulted: JSON.stringify(sourcesConsulted),
      }
    })

    return NextResponse.json({
      id: check.id,
      subject: {
        full_name,
        curp: curp || null,
        rfc: rfc || null,
        email: email || null,
        phone: phone || null,
        username: username || null,
      },
      ...modules,
      trust_score: scores.trust_score,
      risk_score: scores.risk_score,
      identity_confidence: scores.identity_confidence,
      risk_level: scores.risk_level,
      recommendation: scores.recommendation,
      flags: scores.flags,
      breakdown: scores.breakdown,
      ai_report: aiReport,
      sources_consulted: sourcesConsulted,
      created_at: check.createdAt.toISOString(),
    })
  } catch (error: any) {
    console.error('Check error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

function generateReport(name: string, modules: any, scores: any): string {
  const lines: string[] = []

  lines.push('## Resumen Ejecutivo')
  if (scores.risk_level === 'BAJO') {
    lines.push(`La identidad de ${name} presenta un nivel de confianza alto. La verificación de identidad fue exitosa y no se identificaron señales de riesgo significativas.`)
  } else if (scores.risk_level === 'MEDIO') {
    lines.push(`La identidad de ${name} presenta un nivel de riesgo moderado. Se identificaron algunos factores que requieren revisión adicional antes de aprobar.`)
  } else if (scores.risk_level === 'ALTO') {
    lines.push(`La identidad de ${name} presenta un nivel de riesgo alto. Se detectaron múltiples señales de alerta que requieren investigación detallada.`)
  } else {
    lines.push(`La identidad de ${name} presenta un nivel de riesgo CRÍTICO. Se detectaron coincidencias en listas restringidas o señales graves de inconsistencia.`)
  }
  lines.push('')

  lines.push('## Hallazgos de Identidad')
  if (modules.curp_validation?.is_valid) {
    lines.push(`La CURP fue validada exitosamente contra el algoritmo oficial. Dígito verificador correcto.`)
  } else if (modules.curp_validation) {
    lines.push(`La CURP presenta inconsistencias: ${modules.curp_validation.message}.`)
  }
  if (modules.rfc_validation?.is_valid) {
    lines.push(`El RFC es válido y presenta estatus "${modules.rfc_validation.sat_status}" en SAT.`)
  } else if (modules.rfc_validation) {
    lines.push(`El RFC presenta inconsistencias: ${modules.rfc_validation.message}.`)
  }
  lines.push('')

  lines.push('## Cumplimiento y Sanciones')
  if (modules.sanctions?.is_sanctioned) {
    lines.push('Se detectaron coincidencias en listas de sanciones internacionales. Se requiere investigación inmediata.')
  } else if (modules.sanctions?.is_pep) {
    lines.push('La persona es clasificada como Persona Expuesta Políticamente (PEP). Se requiere debida diligencia aumentada.')
  } else if (modules.sanctions) {
    lines.push('No se encontraron coincidencias en listas de sanciones nacionales o internacionales.')
  }
  lines.push('')

  lines.push('## Inteligencia Digital')
  if (modules.digital_identity?.email) {
    const e = modules.digital_identity.email
    lines.push(`Email: ${e.is_disposable ? 'DESECHEABLE (alerta)' : e.is_corporate_business ? 'Corporativo (positivo)' : 'Personal'}. ${e.breach_count} brechas de datos detectadas.`)
  }
  if (modules.digital_identity?.phone) {
    const p = modules.digital_identity.phone
    lines.push(`Teléfono: ${p.carrier}, línea ${p.line_type}. ${p.is_spam_reported ? 'Reportado como spam (alerta).' : 'Sin reportes de spam.'}`)
  }
  if (modules.digital_footprint) {
    const df = modules.digital_footprint
    lines.push(`Presencia digital: Score ${df.presence_score}/100. ${df.social_profiles_count} perfiles sociales, ${df.developer_profiles_count} perfiles de desarrollador.`)
  }
  lines.push('')

  lines.push('## Análisis de Riesgo')
  lines.push(`Trust Score: ${scores.trust_score}/100 | Risk Score: ${scores.risk_score}/100 | Confianza de Identidad: ${scores.identity_confidence}%`)
  if (scores.breakdown?.trust_components?.length > 0) {
    lines.push('Factores positivos: ' + scores.breakdown.trust_components.map((c: any) => `${c.label} (+${c.points})`).join(', '))
  }
  if (scores.breakdown?.risk_components?.length > 0) {
    lines.push('Factores de riesgo: ' + scores.breakdown.risk_components.map((c: any) => `${c.label} (+${c.points})`).join(', '))
  }
  lines.push('')

  lines.push('## Recomendación')
  const recMap: Record<string, string> = {
    APPROVE: 'APROBAR',
    REVIEW: 'REVISAR',
    REJECT: 'RECHAZAR',
  }
  lines.push(`Nivel de riesgo: ${scores.risk_level}. Recomendación: ${recMap[scores.recommendation] || scores.recommendation}.`)
  if (scores.flags?.length > 0) {
    lines.push(`Alertas: ${scores.flags.join('; ')}`)
  }

  return lines.join('\n')
}

export async function GET(request: Request) {
  const token = getTokenFromHeaders(request.headers)
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const payload = verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') || ''
  const riskLevel = searchParams.get('risk_level') || ''

  const where: any = { userId: payload.userId }
  if (q) {
    where.subjectName = { contains: q }
  }
  if (riskLevel) {
    where.riskLevel = riskLevel
  }

  const checks = await db.check.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return NextResponse.json(checks.map(c => ({
    id: c.id,
    subject: { full_name: c.subjectName, curp: c.subjectCurp, rfc: c.subjectRfc, email: c.subjectEmail, phone: c.subjectPhone, username: c.subjectUsername },
    trust_score: c.trustScore,
    risk_score: c.riskScore,
    identity_confidence: c.identityConfidence,
    risk_level: c.riskLevel,
    recommendation: c.recommendation,
    flags: JSON.parse(c.flags || '[]'),
    created_at: c.createdAt.toISOString(),
  })))
}
