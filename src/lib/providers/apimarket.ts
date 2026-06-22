// Cliente para ApiMarket (https://apimarket.mx) — fallback de CURP/RENAPO.
// Endpoint verificado: POST https://apimarket.mx/api/renapo/grupo/valida-curp?curp={curp}
// Auth: header X-API-Key.
// Regístrate / obtén tu key en https://apimarket.mx

const BASE_URL = process.env.APIMARKET_API_URL || 'https://apimarket.mx/api'

export async function apimarketValidateCurp(curp: string): Promise<any> {
  const apiKey = process.env.APIMARKET_API_KEY
  if (!apiKey) {
    return { ok: false, configured: false, error: 'APIMARKET_API_KEY no configurado en .env' }
  }

  try {
    const url = `${BASE_URL}/renapo/grupo/valida-curp?curp=${encodeURIComponent(curp)}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'X-API-Key': apiKey },
      signal: AbortSignal.timeout(15000),
    })

    const json = await res.json().catch(() => null)

    if (!res.ok) {
      return { ok: false, configured: true, status: res.status, error: json?.mensaje || json?.message || `HTTP ${res.status}` }
    }

    // ApiMarket responde con el mismo esquema RENAPO clásico (estatus/nombre/...)
    const found = json?.estatus === 'OK' || !!json?.curp
    return {
      ok: true,
      configured: true,
      found,
      raw_status: json?.estatus,
      data: found ? {
        curp: json.curp,
        nombre: json.nombre,
        apellido_paterno: json.apellidoPaterno || json.apellido_paterno,
        apellido_materno: json.apellidoMaterno || json.apellido_materno,
        sexo: json.sexo,
        estado_nacimiento: json.estadoNacimiento || json.estado_nacimiento,
        pais_nacimiento: json.paisNacimiento || json.pais_nacimiento,
        fecha_nacimiento: json.fechaNacimiento || json.fecha_nacimiento,
        estatus_curp: json.estatusCurp || json.estatus_curp,
      } : null,
      message: json?.mensaje || json?.message,
    }
  } catch (err: any) {
    return { ok: false, configured: true, error: err?.message || 'Error de red consultando ApiMarket' }
  }
}
