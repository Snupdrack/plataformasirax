// Cliente para datosnonstop.com — fallback de CURP/RENAPO.
// Endpoint verificado contra la documentación del dashboard:
// POST https://api.datosnonstop.com/v1/renapo/curp
// Auth: header x-api-key. Body: { "curp": "..." }

const BASE_URL = process.env.DATOSNONSTOP_API_URL || 'https://api.datosnonstop.com/v1'

export async function datosnonstopValidateCurp(curp: string): Promise<any> {
  const apiKey = process.env.DATOSNONSTOP_API_KEY
  if (!apiKey) {
    return { ok: false, configured: false, error: 'DATOSNONSTOP_API_KEY no configurado en .env' }
  }

  try {
    const res = await fetch(`${BASE_URL}/renapo/curp`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ curp }),
      signal: AbortSignal.timeout(15000),
    })

    const json = await res.json().catch(() => null)

    if (!res.ok) {
      return { ok: false, configured: true, status: res.status, error: json?.mensaje || json?.message || json?.error || `HTTP ${res.status}` }
    }

    // Esquema observado en la doc del dashboard: { estatus, curp, nombre, apellidoPaterno, ... }
    // Si tu cuenta devuelve otro shape (p.ej. anidado en "data"), ajusta aquí.
    const d = json?.data || json
    const found = d?.estatus === 'OK' || (!!d?.curp && d?.estatus !== 'NO_ENCONTRADO')

    return {
      ok: true,
      configured: true,
      found,
      raw_status: d?.estatus,
      data: found ? {
        curp: d.curp,
        nombre: d.nombre,
        apellido_paterno: d.apellidoPaterno || d.apellido_paterno,
        apellido_materno: d.apellidoMaterno || d.apellido_materno,
        sexo: d.sexo,
        estado_nacimiento: d.estadoNacimiento || d.estado_nacimiento,
        pais_nacimiento: d.paisNacimiento || d.pais_nacimiento,
        fecha_nacimiento: d.fechaNacimiento || d.fecha_nacimiento,
        estatus_curp: d.estatusCurp || d.estatus_curp,
      } : null,
      message: d?.mensaje || d?.message,
    }
  } catch (err: any) {
    return { ok: false, configured: true, error: err?.message || 'Error de red consultando datosnonstop' }
  }
}
