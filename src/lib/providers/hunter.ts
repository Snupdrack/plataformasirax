// Cliente real de Hunter.io API v2 (https://api.hunter.io/v2)
// Verificado contra la documentación oficial: GET /email-verifier?email=&api_key=
// Tier gratuito: 25 verificaciones/mes. Regístrate en https://hunter.io/api-keys

const BASE_URL = 'https://api.hunter.io/v2'

export async function hunterVerifyEmail(email: string) {
  const apiKey = process.env.HUNTER_API_KEY
  if (!apiKey) {
    return { ok: false, configured: false, error: 'HUNTER_API_KEY no configurado en .env' }
  }

  try {
    const url = `${BASE_URL}/email-verifier?email=${encodeURIComponent(email)}&api_key=${apiKey}`
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
    const json = await res.json().catch(() => null)

    if (!res.ok) {
      return { ok: false, configured: true, status: res.status, error: json?.errors?.[0]?.details || `HTTP ${res.status}` }
    }

    const d = json?.data
    return {
      ok: true,
      configured: true,
      status: d?.status, // valid | invalid | accept_all | webmail | disposable | unknown
      result: d?.result, // deliverable | undeliverable | risky
      score: d?.score,
      is_disposable: !!d?.disposable,
      is_webmail: !!d?.webmail,
      is_gibberish: !!d?.gibberish,
      mx_records: !!d?.mx_records,
      smtp_check: !!d?.smtp_check,
      block: !!d?.block,
      sources_count: (d?.sources || []).length,
    }
  } catch (err: any) {
    return { ok: false, configured: true, error: err?.message || 'Error de red consultando Hunter.io' }
  }
}
