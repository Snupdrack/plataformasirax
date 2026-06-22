// SynkData Identity Intelligence - Service Modules
// Validación algorítmica (CURP/RFC) + consultas reales a proveedores externos
// (Nubarium, OpenSanctions, HaveIBeenPwned, Hunter.io, Numverify) + checks
// reales sin API key (DNS MX, Gravatar, existencia de username).
//
// Todo lo que antes era data simulada (seededRandom) fue reemplazado por
// llamadas reales. Si una API key no está configurada en .env, el módulo
// correspondiente regresa `available: false` con un mensaje explícito en vez
// de inventar datos — nunca se muestra data falsa como si fuera real.

import {
  nubariumValidateCurp, nubariumValidateRfc, nubariumImssHistorial, nubariumScreenPep,
} from './providers/nubarium'
import { apimarketValidateCurp } from './providers/apimarket'
import { datosnonstopValidateCurp } from './providers/datosnonstop'
import { opensanctionsMatch } from './providers/opensanctions'
import { hibpCheckBreaches } from './providers/hibp'
import { hunterVerifyEmail } from './providers/hunter'
import { numverifyValidatePhone } from './providers/numverify'
import { checkUsernamePresence } from './providers/username-check'
import { checkMxRecords, checkGravatar, isDisposableDomain } from './providers/email-checks'

// ==================== CURP VALIDATION (algoritmo oficial) ====================

const ESTADOS: Record<string, string> = {
  AS: 'AGUASCALIENTES', BC: 'BAJA CALIFORNIA', BS: 'BAJA CALIFORNIA SUR',
  CC: 'CAMPECHE', CL: 'COAHUILA', CM: 'COLIMA', CS: 'CHIAPAS',
  CH: 'CHIHUAHUA', DF: 'CIUDAD DE MEXICO', DG: 'DURANGO',
  GT: 'GUANAJUATO', GR: 'GUERRERO', HG: 'HIDALGO', JC: 'JALISCO',
  MC: 'MEXICO', MN: 'MICHOACAN', MS: 'MORELOS', NT: 'NAYARIT',
  NL: 'NUEVO LEON', OC: 'OAXACA', PL: 'PUEBLA', QT: 'QUERETARO',
  QR: 'QUINTANA ROO', SP: 'SAN LUIS POTOSI', SL: 'SINALOA',
  SR: 'SONORA', TC: 'TABASCO', TS: 'TAMAULIPAS', TL: 'TLAXCALA',
  VZ: 'VERACRUZ', YN: 'YUCATAN', ZS: 'ZACATECAS', NE: 'NACIDO EXTRANJERO'
}

function validateCheckDigit(curp: string): boolean {
  const values = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'
  let suma = 0
  for (let i = 0; i < 17; i++) {
    const idx = values.indexOf(curp[i])
    if (idx === -1) return false
    suma += idx * (18 - i)
  }
  let digitoCalculado = 10 - (suma % 10)
  if (digitoCalculado === 10) digitoCalculado = 0
  const last = curp[17]
  const digitoCurp = /\d/.test(last) ? parseInt(last) : values.indexOf(last)
  return digitoCalculado === digitoCurp
}

// Validación puramente algorítmica (formato + dígito verificador). NO consulta
// RENAPO — eso lo hace queryRenapo() por separado, que sí es una llamada real.
export function validateCurp(curp: string, fullName?: string): any {
  curp = (curp || '').toUpperCase().trim()

  if (curp.length !== 18) {
    return { is_valid: false, message: `La CURP debe tener 18 caracteres (recibido: ${curp.length})`, curp }
  }

  const pattern = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/
  if (!pattern.test(curp)) {
    return { is_valid: false, message: 'Formato de CURP inválido', curp }
  }

  const fechaNac = curp.substring(4, 10)
  const sexo = curp[10]
  const estado = curp.substring(11, 13)

  const year = parseInt(fechaNac.substring(0, 2))
  const yearFull = year <= 29 ? 2000 + year : 1900 + year
  const month = parseInt(fechaNac.substring(2, 4))
  const day = parseInt(fechaNac.substring(4, 6))

  const birthDate = new Date(yearFull, month - 1, day)
  if (isNaN(birthDate.getTime()) || birthDate > new Date()) {
    return { is_valid: false, message: 'Fecha de nacimiento inválida en CURP', curp }
  }

  if (!(estado in ESTADOS)) {
    return { is_valid: false, message: `Código de estado inválido: ${estado}`, curp }
  }

  const checkDigitValid = validateCheckDigit(curp)
  if (!checkDigitValid) {
    return { is_valid: false, message: 'Dígito verificador incorrecto', curp, check_digit_valid: false }
  }

  return {
    is_valid: true,
    message: 'CURP con formato y dígito verificador válidos. Verificación contra RENAPO disponible en el módulo de gobierno.',
    curp,
    check_digit_valid: true,
    format_valid: true,
    components: {
      birth_date: birthDate.toISOString().split('T')[0],
      sex: sexo === 'H' ? 'Hombre' : 'Mujer',
      state: ESTADOS[estado],
      state_code: estado,
      homoclave: curp[16],
      verification_digit: curp[17],
    }
  }
}

// ==================== RFC VALIDATION (algoritmo) ====================

export function validateRfc(rfc: string): any {
  rfc = (rfc || '').toUpperCase().trim().replace(/[-\s]/g, '')

  if (rfc.length !== 12 && rfc.length !== 13) {
    return { is_valid: false, message: 'RFC debe tener 12 (moral) o 13 (física) caracteres', rfc }
  }

  let fecha: string, rfcType: string
  if (rfc.length === 13) {
    const pattern = /^[A-ZÑ&]{4}\d{6}[A-Z0-9]{3}$/
    if (!pattern.test(rfc)) {
      return { is_valid: false, message: 'Formato RFC persona física inválido', rfc }
    }
    fecha = rfc.substring(4, 10)
    rfcType = 'fisica'
  } else {
    const pattern = /^[A-ZÑ&]{3}\d{6}[A-Z0-9]{3}$/
    if (!pattern.test(rfc)) {
      return { is_valid: false, message: 'Formato RFC persona moral inválido', rfc }
    }
    fecha = rfc.substring(3, 9)
    rfcType = 'moral'
  }

  const year = parseInt(fecha.substring(0, 2))
  const yearFull = year <= 29 ? 2000 + year : 1900 + year
  const month = parseInt(fecha.substring(2, 4))
  const day = parseInt(fecha.substring(4, 6))
  const dateObj = new Date(yearFull, month - 1, day)

  if (isNaN(dateObj.getTime()) || dateObj > new Date()) {
    return { is_valid: false, message: 'Fecha inválida en RFC', rfc }
  }

  return {
    is_valid: true,
    message: `RFC con formato válido (${rfcType === 'fisica' ? 'Persona Física' : 'Persona Moral'}). Estatus real ante SAT disponible en el módulo de gobierno.`,
    rfc,
    type: rfcType,
    components: {
      date: dateObj.toISOString().split('T')[0],
      homoclave: rfc.slice(-3),
    },
  }
}

// ==================== GOVERNMENT INTELLIGENCE (consultas reales) ====================

// Orden de fallback para CURP/RENAPO: ApiMarket -> datosnonstop -> Nubarium.
// Cada proveedor regresa { ok, configured, found?, ... } siguiendo la
// convención de src/lib/providers/_template.ts. Se intenta el siguiente
// proveedor solo si el actual no está configurado (sin API key) o falló
// (error de red/HTTP) — NO si simplemente no encontró la CURP (eso ya es
// una respuesta real de la fuente y no debe enmascararse intentando otra).
const RENAPO_PROVIDERS: Array<{ id: string; call: (curp: string) => Promise<any> }> = [
  { id: 'ApiMarket', call: apimarketValidateCurp },
  { id: 'datosnonstop', call: datosnonstopValidateCurp },
  { id: 'Nubarium', call: nubariumValidateCurp },
]

export async function queryRenapo(curp: string, fullName?: string): Promise<any> {
  if (!curp || curp.length !== 18) {
    return { found: false, available: false, source: 'RENAPO', message: 'CURP no proporcionado o inválido' }
  }

  const attempts: Array<{ provider: string; configured: boolean; ok: boolean; error?: string }> = []

  for (const { id, call } of RENAPO_PROVIDERS) {
    const result = await call(curp)

    if (!result.configured) {
      attempts.push({ provider: id, configured: false, ok: false, error: result.error })
      continue // sin API key configurada, intenta el siguiente proveedor
    }

    if (!result.ok) {
      attempts.push({ provider: id, configured: true, ok: false, error: result.error })
      continue // se intentó pero falló (red/HTTP), intenta el siguiente proveedor
    }

    // Llegó respuesta válida de este proveedor (encontrada o no) — es la
    // respuesta final, no se sigue intentando con los demás.
    if (!result.found) {
      return {
        found: false,
        available: true,
        source: `RENAPO (${id})`,
        registry_status: 'NO_ENCONTRADO',
        message: result.message || 'CURP no encontrada en RENAPO',
        attempts,
      }
    }

    return {
      found: true,
      available: true,
      source: `RENAPO (${id})`,
      registry_status: 'VIGENTE',
      validation_id: result.validation_id,
      data: result.data,
      attempts,
    }
  }

  // Ningún proveedor pudo responder: o ninguno está configurado, o todos fallaron.
  const anyConfigured = attempts.some(a => a.configured)
  return {
    found: false,
    available: anyConfigured,
    source: 'RENAPO',
    message: anyConfigured
      ? `Todos los proveedores de RENAPO fallaron: ${attempts.map(a => `${a.provider}: ${a.error}`).join(' | ')}`
      : 'Ningún proveedor de RENAPO está configurado (faltan API keys en .env: APIMARKET_API_KEY, DATOSNONSTOP_API_KEY, NUBARIUM_USER/NUBARIUM_PASSWORD)',
    attempts,
  }
}

export async function querySat(rfc: string): Promise<any> {
  if (!rfc) return { found: false, available: false, source: 'SAT', message: 'RFC no proporcionado' }
  const result = await nubariumValidateRfc(rfc)
  if (!result.configured) {
    return { found: false, available: false, source: 'SAT', message: result.error }
  }
  if (!result.ok) {
    return { found: false, available: true, source: 'SAT', error: result.error }
  }
  if (!result.found) {
    return { found: false, available: true, source: 'SAT', message: result.message || 'RFC no encontrado en SAT' }
  }
  return {
    found: true,
    available: true,
    source: 'SAT',
    rfc,
    status: result.data?.situacion_contribuyente || 'DESCONOCIDO',
    data: result.data,
  }
}

export async function queryImss(nss?: string, curp?: string): Promise<any> {
  if (!curp) {
    return { found: false, available: false, source: 'IMSS', message: 'Se requiere CURP para consultar el historial laboral IMSS' }
  }
  const result = await nubariumImssHistorial(curp)
  if (!result.configured) {
    return { found: false, available: false, source: 'IMSS', message: result.error }
  }
  if (!result.ok) {
    return { found: false, available: true, source: 'IMSS', error: result.error }
  }
  return {
    found: result.found,
    available: true,
    source: 'IMSS',
    nss: result.nss || nss,
    periodos_cotizados: result.periodos,
    consent_required: result.consent_required,
    consent_note: result.consent_note,
  }
}

// El Registro Nacional de Detenciones (RND) NO tiene API pública ni comercial.
// El acceso está restringido por ley a instituciones de seguridad autorizadas
// (Ley General del Sistema Nacional de Seguridad Pública, Art. 115-126). Ningún
// proveedor KYC (Nubarium, NuFi, Belvo) lo ofrece. Este módulo se deja
// honestamente deshabilitado en vez de simular resultados.
export async function queryRnd(nombre: string, paterno: string, materno?: string, estado?: string): Promise<any> {
  const nombreCompleto = `${nombre} ${paterno} ${materno || ''}`.trim()
  return {
    found: false,
    available: false,
    source: 'RND (SSPC)',
    nombre_buscado: nombreCompleto,
    estado: estado || 'Nacional',
    sin_resultados: true,
    message: 'El Registro Nacional de Detenciones no expone API pública ni comercial. Solo instituciones de seguridad autorizadas tienen acceso (Ley General del Sistema Nacional de Seguridad Pública). Este módulo permanece deshabilitado por diseño.',
  }
}

// ==================== SANCTIONS SCREENING (OpenSanctions + Nubarium PEP) ====================

export const ALL_LISTS = [
  'OFAC SDN', 'ONU Consolidated List', 'OpenSanctions', 'PEP Database (Nubarium)',
  'EU Sanctions', 'UK HMT Sanctions', 'Interpol Red Notices',
]

export async function screenSanctions(fullName: string, threshold = 70): Promise<any> {
  if (!fullName) {
    return { available: false, is_sanctioned: false, is_pep: false, matches: [], lists_checked: ALL_LISTS }
  }

  const [openSanctionsResult, nubariumPepResult] = await Promise.all([
    opensanctionsMatch(fullName),
    nubariumScreenPep(fullName),
  ])

  const sourcesAvailable: string[] = []
  const sourcesUnavailable: string[] = []
  const matches: any[] = []

  if (openSanctionsResult.configured && openSanctionsResult.ok) {
    sourcesAvailable.push('OpenSanctions (OFAC/ONU/EU/UK)')
    for (const m of openSanctionsResult.matches) {
      if (m.score >= threshold) matches.push({ ...m, provider: 'OpenSanctions' })
    }
  } else {
    sourcesUnavailable.push(`OpenSanctions: ${openSanctionsResult.error}`)
  }

  if (nubariumPepResult.configured && nubariumPepResult.ok) {
    sourcesAvailable.push('Nubarium PLD/PEP')
    for (const m of nubariumPepResult.matches || []) {
      matches.push({ ...m, provider: 'Nubarium' })
    }
  } else {
    sourcesUnavailable.push(`Nubarium PEP: ${nubariumPepResult.error}`)
  }

  const isSanctioned = matches.some((m) => (m.topics || []).some((t: string) => ['sanction', 'debarment', 'crime'].includes(t)))
  const isPep = matches.some((m) => (m.topics || []).includes('role.pep')) || !!nubariumPepResult.is_pep

  return {
    available: sourcesAvailable.length > 0,
    is_sanctioned: isSanctioned,
    is_pep: isPep,
    matches,
    lists_checked: ALL_LISTS,
    sources_available: sourcesAvailable,
    sources_unavailable: sourcesUnavailable,
    threshold_used: threshold,
  }
}

// ==================== DIGITAL IDENTITY (consultas reales) ====================

const CORPORATE_DOMAINS: Record<string, [string, string]> = {
  'gmail.com': ['Google', 'consumer'],
  'outlook.com': ['Microsoft', 'consumer'],
  'hotmail.com': ['Microsoft', 'consumer'],
  'yahoo.com': ['Yahoo', 'consumer'],
  'icloud.com': ['Apple', 'consumer'],
  'protonmail.com': ['Proton', 'privacy'],
}

export async function enrichEmail(email: string): Promise<any> {
  if (!email || !email.includes('@')) return { is_valid: false, email }

  const [, domain] = email.toLowerCase().split('@')

  const [hunterResult, hibpResult, mxValid, hasGravatar] = await Promise.all([
    hunterVerifyEmail(email),
    hibpCheckBreaches(email),
    checkMxRecords(domain),
    checkGravatar(email),
  ])

  const isDisposable = isDisposableDomain(domain) || (hunterResult.configured && hunterResult.ok && hunterResult.is_disposable)
  const isCorporateConsumer = domain in CORPORATE_DOMAINS
  const isCorporateBusiness = !isCorporateConsumer && !isDisposable && domain.includes('.')

  const sourcesAvailable: string[] = ['DNS MX Records', 'Gravatar']
  const sourcesUnavailable: string[] = []
  if (hunterResult.configured) sourcesAvailable.push('Hunter.io') ; else sourcesUnavailable.push(`Hunter.io: ${hunterResult.error}`)
  if (hibpResult.configured) sourcesAvailable.push('HaveIBeenPwned') ; else sourcesUnavailable.push(`HaveIBeenPwned: ${hibpResult.error}`)

  let riskScore = 0
  if (isDisposable) riskScore += 60
  if (!mxValid) riskScore += 25
  if (hibpResult.configured && hibpResult.ok && hibpResult.breach_count >= 5) riskScore += 30
  else if (hibpResult.configured && hibpResult.ok && hibpResult.breach_count >= 2) riskScore += 15
  riskScore = Math.min(100, riskScore)

  return {
    email,
    is_valid: hunterResult.configured && hunterResult.ok ? hunterResult.result !== 'undeliverable' : mxValid,
    domain,
    is_disposable: isDisposable,
    is_corporate_business: isCorporateBusiness,
    is_corporate_consumer: isCorporateConsumer,
    provider: CORPORATE_DOMAINS[domain]?.[0] || 'Custom Domain',
    mx_records_valid: mxValid,
    deliverable: hunterResult.configured && hunterResult.ok ? hunterResult.result === 'deliverable' : mxValid,
    has_gravatar: hasGravatar,
    breach_count: hibpResult.configured && hibpResult.ok ? hibpResult.breach_count : null,
    breach_sources: hibpResult.configured && hibpResult.ok ? hibpResult.breaches.map((b: any) => b.title) : [],
    hunter_status: hunterResult.configured && hunterResult.ok ? hunterResult.status : null,
    risk_score: riskScore,
    risk_level: riskScore >= 60 ? 'ALTO' : riskScore >= 30 ? 'MEDIO' : 'BAJO',
    sources_available: sourcesAvailable,
    sources_unavailable: sourcesUnavailable,
  }
}

export async function enrichPhone(phone: string): Promise<any> {
  if (!phone) return { is_valid: false, phone }

  const clean = phone.replace(/\D/g, '')
  if (clean.length < 10 || clean.length > 13) {
    return { is_valid: false, phone, message: 'Longitud inválida' }
  }

  const result = await numverifyValidatePhone(phone)
  if (!result.configured) {
    return { is_valid: null, phone, available: false, message: result.error }
  }
  if (!result.ok) {
    return { is_valid: null, phone, available: true, error: result.error }
  }

  const lineType = (result.line_type || '').toLowerCase()
  let riskScore = 0
  if (lineType === 'voip') riskScore += 20
  if (!result.is_valid) riskScore += 30
  riskScore = Math.min(100, riskScore)

  return {
    phone,
    available: true,
    is_valid: result.is_valid,
    international_format: result.international_format,
    local_format: result.local_format,
    country_code: result.country_prefix,
    country: result.country_name,
    carrier: result.carrier || 'Desconocido',
    line_type: result.line_type || 'DESCONOCIDO',
    location: result.location,
    risk_score: riskScore,
    risk_level: riskScore >= 60 ? 'ALTO' : riskScore >= 30 ? 'MEDIO' : 'BAJO',
    sources_available: ['Numverify'],
  }
}

export async function discoverUsername(username: string): Promise<any> {
  if (!username) return { username, found: false }
  return checkUsernamePresence(username)
}

export function calculateDigitalFootprint(emailData?: any, usernameData?: any): any {
  const socialProfiles: any[] = []
  const developerProfiles: any[] = []
  let professionalPresence = false

  if (usernameData?.found) {
    for (const p of usernameData.profiles) {
      socialProfiles.push(p)
      if (['GitHub', 'GitLab', 'Stack Overflow', 'Dev.to'].includes(p.platform)) {
        developerProfiles.push(p)
      }
      if (['LinkedIn', 'Medium'].includes(p.platform)) {
        professionalPresence = true
      }
    }
  }

  const presenceScore = Math.min(100, socialProfiles.length * 15 + developerProfiles.length * 8 + (professionalPresence ? 15 : 0))

  return {
    presence_score: presenceScore,
    social_profiles_count: socialProfiles.length,
    developer_profiles_count: developerProfiles.length,
    professional_presence: professionalPresence,
    profiles: socialProfiles,
    platforms: socialProfiles.map((p: any) => p.platform),
  }
}

// ==================== RELATIONSHIP GRAPH (lógica pura, sin datos simulados) ====================

function nodeId(prefix: string, value: string): string {
  let h = 0
  const str = prefix + '_' + value
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0
  }
  return `${prefix}_${Math.abs(h).toString(16).slice(0, 10)}`
}

export function buildRelationshipGraph(
  subjectName: string,
  email?: string,
  phone?: string,
  curp?: string,
  rfc?: string,
  address?: string,
  username?: string,
  digitalProfiles?: any[],
  sanctionsMatches?: any[],
  riskScore = 0,
  riskLevel = 'BAJO'
): any {
  const nodes: any[] = []
  const edges: any[] = []
  const personId = nodeId('person', curp || rfc || subjectName)

  nodes.push({ data: { id: personId, type: 'Person', label: subjectName, risk_level: riskLevel, risk_score: riskScore } })

  const addAttr = (prefix: string, value: string | undefined, labelPrefix: string, rel: string) => {
    if (!value) return
    const nid = nodeId(prefix, value)
    nodes.push({ data: { id: nid, type: prefix.charAt(0).toUpperCase() + prefix.slice(1), label: `${labelPrefix}: ${value}`, value } })
    edges.push({ data: { source: personId, target: nid, relationship: rel } })
  }

  addAttr('email', email, 'Email', 'HAS_EMAIL')
  addAttr('phone', phone, 'Phone', 'HAS_PHONE')
  addAttr('curp', curp, 'CURP', 'HAS_CURP')
  addAttr('rfc', rfc, 'RFC', 'HAS_RFC')
  addAttr('address', address, 'Dirección', 'LIVES_AT')
  addAttr('username', username, 'Alias', 'USES_ALIAS')

  if (digitalProfiles) {
    for (const p of digitalProfiles.slice(0, 10)) {
      const nid = nodeId('social', p.url)
      nodes.push({ data: { id: nid, type: 'SocialProfile', label: p.platform, url: p.url } })
      edges.push({ data: { source: personId, target: nid, relationship: 'HAS_PROFILE' } })
    }
  }

  if (sanctionsMatches) {
    for (const m of sanctionsMatches.slice(0, 5)) {
      const nid = nodeId('sanction', (m.official_name || m.caption || '') + (m.list_name || m.provider || ''))
      nodes.push({ data: { id: nid, type: 'SanctionMatch', label: `${m.provider || m.list_name}: ${m.caption || m.matched_name}`, risk_level: 'CRITICO' } })
      edges.push({ data: { source: personId, target: nid, relationship: 'MATCHED_IN' } })
    }
  }

  const suspicious: any[] = []
  const sanctionNodes = nodes.filter(n => n.data.type === 'SanctionMatch')
  if (sanctionNodes.length > 0) {
    suspicious.push({
      type: 'SANCTION_LINK',
      description: `Conexión con ${sanctionNodes.length} registro(s) en listas restringidas`,
      severity: 'CRITICAL',
      count: sanctionNodes.length,
    })
  }

  return {
    graph: { nodes, edges },
    analysis: {
      total_nodes: nodes.length,
      total_edges: edges.length,
      suspicious_patterns: suspicious,
      subject_node_id: personId,
      entity_types: [...new Set(nodes.map(n => n.data.type))],
    }
  }
}

// ==================== MOTOR DE CORRELACIÓN DE IDENTIDAD ====================
// Compara el nombre declarado contra el nombre real devuelto por RENAPO y
// contra cualquier señal de nombre disponible en las fuentes digitales ya
// consultadas (no scrapea nada nuevo, solo correlaciona lo que ya se obtuvo).

function normalizeName(s: string): string {
  if (!s) return ''
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim().replace(/\s+/g, ' ')
}

function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a)
  const nb = normalizeName(b)
  if (!na || !nb) return 0
  if (na === nb) return 100
  const tokensA = new Set(na.split(' '))
  const tokensB = new Set(nb.split(' '))
  let shared = 0
  for (const t of tokensA) if (tokensB.has(t)) shared++
  const union = new Set([...tokensA, ...tokensB]).size
  return union === 0 ? 0 : Math.round((shared / union) * 100)
}

export function correlateIdentity(declaredName: string, modules: any): any {
  const checks: any[] = []
  const gov = modules.government || {}

  if (gov.renapo?.available && gov.renapo?.found && gov.renapo.data) {
    const renapoName = [gov.renapo.data.nombre, gov.renapo.data.apellido_paterno, gov.renapo.data.apellido_materno]
      .filter(Boolean).join(' ')
    const score = nameSimilarity(declaredName, renapoName)
    checks.push({
      check: 'Nombre declarado vs. RENAPO',
      score,
      consistent: score >= 70,
      detail: `"${declaredName}" vs. "${renapoName}"`,
    })
  }

  const digitalProfiles = modules.digital_footprint?.profiles || []
  if (digitalProfiles.length > 0) {
    checks.push({
      check: 'Presencia digital corroborada',
      score: Math.min(100, digitalProfiles.length * 20),
      consistent: digitalProfiles.length > 0,
      detail: `${digitalProfiles.length} perfil(es) público(s) verificado(s) (${digitalProfiles.map((p: any) => p.platform).join(', ')})`,
    })
  }

  const overallConsistent = checks.length > 0 && checks.every((c) => c.consistent)
  const anyInconsistent = checks.some((c) => !c.consistent)

  return {
    checks,
    overall: checks.length === 0 ? 'SIN_DATOS_SUFICIENTES' : anyInconsistent ? 'INCONSISTENTE' : 'CONSISTENTE',
  }
}



export function calculateScores(modules: any): any {
  let trust = 0
  let risk = 0
  const flags: string[] = []
  const breakdown: any = { trust_components: [], risk_components: [] }

  const curpV = modules.curp_validation
  if (curpV) {
    if (curpV.is_valid) {
      trust += 15
      breakdown.trust_components.push({ label: 'CURP con formato y dígito verificador válidos', points: 15 })
    } else {
      risk += 25
      breakdown.risk_components.push({ label: 'CURP inválida', points: 25 })
      flags.push('CURP inválida o con dígito verificador incorrecto')
    }
  }

  const rfcV = modules.rfc_validation
  if (rfcV) {
    if (rfcV.is_valid) {
      trust += 10
      breakdown.trust_components.push({ label: 'RFC con formato válido', points: 10 })
    } else {
      risk += 15
      breakdown.risk_components.push({ label: 'RFC inválido', points: 15 })
    }
  }

  const gov = modules.government || {}
  const renapo = gov.renapo
  if (renapo?.available && renapo.found && renapo.registry_status === 'VIGENTE') {
    trust += 15
    breakdown.trust_components.push({ label: 'Registro RENAPO vigente (consulta real)', points: 15 })
  }

  const sat = gov.sat
  if (sat?.available && sat.found) {
    if (sat.status === 'ACTIVO') {
      trust += 15
      breakdown.trust_components.push({ label: 'SAT activo (consulta real)', points: 15 })
    } else if (sat.status === 'SUSPENDIDO' || sat.status === 'CANCELADO') {
      risk += 20
      breakdown.risk_components.push({ label: `RFC con estatus ${sat.status} en SAT`, points: 20 })
      flags.push(`RFC con estatus ${sat.status} en SAT`)
    }
  }

  const rnd = gov.rnd
  if (rnd?.available) {
    // Solo se considera en el score si el módulo está realmente disponible.
    if (!rnd.sin_resultados && rnd.found) {
      risk += 60
      breakdown.risk_components.push({ label: 'Registro en RND (Detenciones)', points: 60 })
      flags.push('Detención registrada en el Registro Nacional de Detenciones')
    }
  }

  const sanc = modules.sanctions
  if (sanc?.available) {
    if (sanc.is_sanctioned) {
      risk = 100
      breakdown.risk_components.push({ label: 'Match en lista de sanciones', points: 100 })
      flags.push('Coincidencia en listas de sanciones (OFAC/ONU/OpenSanctions)')
    } else if (sanc.is_pep) {
      risk += 25
      breakdown.risk_components.push({ label: 'Persona Expuesta Políticamente (PEP)', points: 25 })
      flags.push('Persona Expuesta Políticamente (PEP)')
    } else {
      trust += 20
      breakdown.trust_components.push({ label: 'Sin coincidencias en listas restringidas', points: 20 })
    }
  }

  const di = modules.digital_identity || {}
  const email = di.email
  if (email) {
    if (email.is_disposable) {
      risk += 25
      breakdown.risk_components.push({ label: 'Email desechable', points: 25 })
      flags.push('Email desechable detectado')
    } else if (email.is_corporate_business) {
      trust += 5
      breakdown.trust_components.push({ label: 'Email corporativo propio', points: 5 })
    }
    if (typeof email.breach_count === 'number' && email.breach_count >= 5) {
      risk += 15
      breakdown.risk_components.push({ label: `${email.breach_count} brechas de datos (HaveIBeenPwned)`, points: 15 })
    }
  }

  const phoneData = di.phone
  if (phoneData?.available) {
    if (phoneData.line_type === 'voip') {
      risk += 10
      breakdown.risk_components.push({ label: 'Teléfono VOIP', points: 10 })
    }
    if (phoneData.is_valid === false) {
      risk += 15
      breakdown.risk_components.push({ label: 'Teléfono inválido', points: 15 })
      flags.push('Teléfono inválido según Numverify')
    }
  }

  const df = modules.digital_footprint
  if (df) {
    if (df.presence_score >= 60) {
      trust += 10
      breakdown.trust_components.push({ label: 'Presencia digital consistente', points: 10 })
    }
    if (df.professional_presence) {
      trust += 5
      breakdown.trust_components.push({ label: 'Presencia profesional (LinkedIn)', points: 5 })
    }
    if (df.developer_profiles_count > 0) {
      trust += 5
      breakdown.trust_components.push({ label: 'Perfiles de desarrollador (GitHub/GitLab)', points: 5 })
    }
  }

  const correlation = modules.identity_correlation
  if (correlation?.overall === 'CONSISTENTE') {
    trust += 10
    breakdown.trust_components.push({ label: 'Nombre declarado consistente con RENAPO y huella digital', points: 10 })
  } else if (correlation?.overall === 'INCONSISTENTE') {
    risk += 20
    breakdown.risk_components.push({ label: 'Inconsistencia entre nombre declarado y fuentes verificadas', points: 20 })
    flags.push('El nombre declarado no coincide con los registros verificados')
  }

  trust = Math.max(0, Math.min(100, trust))
  risk = Math.max(0, Math.min(100, risk))

  const signalsValidated = [
    !!(curpV?.is_valid),
    !!(rfcV?.is_valid),
    !!(renapo?.available && renapo.found),
    !!(email && !email.is_disposable && email.is_valid),
    !!(phoneData?.available && phoneData.is_valid),
    !!(df?.presence_score >= 40),
    !!(sanc?.available && !sanc.is_sanctioned),
  ].filter(Boolean).length

  const identityConfidence = Math.round(Math.min(100, signalsValidated * 14 + (trust >= 60 ? 10 : 0)))

  let level: string, recommendation: string
  if (risk >= 70) { level = 'CRITICO'; recommendation = 'REJECT' }
  else if (risk >= 40) { level = 'ALTO'; recommendation = 'REVIEW' }
  else if (risk >= 20) { level = 'MEDIO'; recommendation = 'REVIEW' }
  else { level = 'BAJO'; recommendation = 'APPROVE' }

  return {
    trust_score: Math.round(trust),
    risk_score: Math.round(risk),
    identity_confidence: identityConfidence,
    risk_level: level,
    recommendation,
    flags,
    breakdown,
  }
}
