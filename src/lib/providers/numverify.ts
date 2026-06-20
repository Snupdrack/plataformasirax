// Cliente real de Numverify / apilayer (https://numverify.com)
// Verificado contra la documentación oficial: GET /api/validate?access_key=&number=
// Tier gratuito: 100 validaciones/mes. Regístrate en https://numverify.com

const BASE_URL = 'https://apilayer.net/api/validate'

export async function numverifyValidatePhone(phone: string, countryCode?: string) {
  const apiKey = process.env.NUMVERIFY_API_KEY
  if (!apiKey) {
    return { ok: false, configured: false, error: 'NUMVERIFY_API_KEY no configurado en .env' }
  }

  try {
    const params = new URLSearchParams({
      access_key: apiKey,
      number: phone,
      format: '1',
    })
    if (countryCode) params.set('country_code', countryCode)

    const res = await fetch(`${BASE_URL}?${params.toString()}`, { signal: AbortSignal.timeout(15000) })
    const json = await res.json().catch(() => null)

    if (json?.error) {
      return { ok: false, configured: true, error: json.error.info || json.error.type }
    }
    if (!res.ok) {
      return { ok: false, configured: true, status: res.status, error: `HTTP ${res.status}` }
    }

    return {
      ok: true,
      configured: true,
      is_valid: !!json?.valid,
      number: json?.number,
      local_format: json?.local_format,
      international_format: json?.international_format,
      country_prefix: json?.country_prefix,
      country_code: json?.country_code,
      country_name: json?.country_name,
      location: json?.location,
      carrier: json?.carrier,
      line_type: json?.line_type, // mobile | landline | etc.
    }
  } catch (err: any) {
    return { ok: false, configured: true, error: err?.message || 'Error de red consultando Numverify' }
  }
}
