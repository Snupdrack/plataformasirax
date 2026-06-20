// Cliente real para los servicios de Nubarium (https://nubarium.com)
// Catálogo verificado contra nubarium.com/productos: Validar/Obtener CURP (RENAPO),
// Validar RFC, Historia laboral IMSS, Consulta de PEPs y listas negras,
// Email/Phone Risk Score.
//
// Autenticación: HTTP Basic Auth (usuario/contraseña que Nubarium entrega al
// contratar cada servicio). El endpoint de CURP está verificado byte a byte
// contra su ficha técnica oficial (curp.nubarium.com/renapo/v2/valida_curp).
// Los demás endpoints (RFC, IMSS, PEP) siguen el mismo patrón documentado
// (dominio-por-servicio + /v{n}/accion) pero Nubarium entrega la ruta exacta
// y el payload de cada uno en el Postman collection privado que activan al
// darte de alta — si alguno responde 404, copia la ruta de ese collection y
// pégala en NUBARIUM_*_PATH dentro del .env, no hace falta tocar código.

type NubariumCreds = { user: string; password: string }

function getCreds(): NubariumCreds | null {
  const user = process.env.NUBARIUM_USER
  const password = process.env.NUBARIUM_PASSWORD
  if (!user || !password) return null
  return { user, password }
}

function basicAuthHeader(creds: NubariumCreds): string {
  return 'Basic ' + Buffer.from(`${creds.user}:${creds.password}`).toString('base64')
}

async function nubariumRequest(url: string, body: Record<string, any>) {
  const creds = getCreds()
  if (!creds) {
    return { ok: false, configured: false, error: 'NUBARIUM_USER / NUBARIUM_PASSWORD no configurados en .env' }
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: basicAuthHeader(creds),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, configured: true, status: res.status, error: json?.mensaje || json?.message || `HTTP ${res.status}` }
    }
    return { ok: true, configured: true, status: res.status, data: json }
  } catch (err: any) {
    return { ok: false, configured: true, error: err?.message || 'Error de red consultando Nubarium' }
  }
}

// ==================== CURP / RENAPO ====================
// Verificado: https://nubarium.com/docs/Validación de CURP - Tech Specs v2.2.pdf
const CURP_URL = process.env.NUBARIUM_CURP_URL || 'https://curp.nubarium.com/renapo/v2/valida_curp'

export async function nubariumValidateCurp(curp: string): Promise<any> {
  const result = await nubariumRequest(CURP_URL, { curp, documento: '0' })
  if (!result.ok) return result
  const d = result.data
  return {
    ok: true,
    configured: true,
    found: d?.estatus === 'OK',
    raw_status: d?.estatus,
    validation_id: d?.codigoValidacion,
    data: d?.estatus === 'OK' ? {
      curp: d.curp,
      nombre: d.nombre,
      apellido_paterno: d.apellidoPaterno,
      apellido_materno: d.apellidoMaterno,
      sexo: d.sexo,
      estado_nacimiento: d.estadoNacimiento,
      pais_nacimiento: d.paisNacimiento,
      fecha_nacimiento: d.fechaNacimiento,
      estatus_curp: d.estatusCurp,
    } : null,
    message: d?.mensaje,
  }
}

// ==================== RFC / SAT ====================
// Patrón documentado por Nubarium (mismo esquema que CURP). Confirma la ruta
// exacta en tu Postman collection privado al activar el servicio "Validar RFC".
const RFC_URL = process.env.NUBARIUM_RFC_URL || 'https://rfc.nubarium.com/sat/v2/valida_rfc'

export async function nubariumValidateRfc(rfc: string): Promise<any> {
  const result = await nubariumRequest(RFC_URL, { rfc })
  if (!result.ok) return result
  const d = result.data
  return {
    ok: true,
    configured: true,
    found: d?.estatus === 'OK',
    raw_status: d?.estatus,
    data: d?.estatus === 'OK' ? {
      rfc: d.rfc,
      nombre_razon_social: d.nombre || d.razonSocial,
      situacion_contribuyente: d.situacionContribuyente || d.estatusRfc,
      regimen_fiscal: d.regimenFiscal,
      fecha_inicio_operaciones: d.fechaInicioOperaciones,
    } : null,
    message: d?.mensaje,
  }
}

// ==================== IMSS - Historial laboral ====================
// Producto real de Nubarium: "Historial Laboral IMSS" — consulta por CURP,
// devuelve periodos cotizados, Registro Patronal, NSS y Salario Base de
// Cotización. Confirma la ruta exacta en tu Postman collection ("Nubarium API+").
const IMSS_URL = process.env.NUBARIUM_IMSS_URL || 'https://api.nubarium.com/imss/v1/historial_laboral'

export async function nubariumImssHistorial(curp: string): Promise<any> {
  const result = await nubariumRequest(IMSS_URL, { curp })
  if (!result.ok) return result
  const d = result.data
  return {
    ok: true,
    configured: true,
    found: d?.estatus === 'OK',
    nss: d?.nss,
    periodos: d?.periodos || d?.historialLaboral || [],
    message: d?.mensaje,
    consent_required: true,
    consent_note: 'El historial laboral IMSS es información sensible — Nubarium exige que el titular haya otorgado consentimiento explícito antes de consultarlo (LFPDPPP).',
  }
}

// ==================== PEPs y listas negras ====================
const PEP_URL = process.env.NUBARIUM_PEP_URL || 'https://api.nubarium.com/pld/v1/consulta_pep'

export async function nubariumScreenPep(fullName: string): Promise<any> {
  const result = await nubariumRequest(PEP_URL, { nombre: fullName })
  if (!result.ok) return result
  const d = result.data
  return {
    ok: true,
    configured: true,
    matches: d?.coincidencias || d?.matches || [],
    is_pep: !!(d?.esPep || d?.is_pep),
    message: d?.mensaje,
  }
}
