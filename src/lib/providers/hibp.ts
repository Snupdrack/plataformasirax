// Cliente real de HaveIBeenPwned API v3 (https://haveibeenpwned.com/api/v3)
// Verificado contra la documentación oficial: GET /breachedaccount/{email}
// Headers: hibp-api-key, user-agent (obligatorio)
// Requiere suscripción de pago (haveibeenpwned.com/API/Key, ~$3.50 USD/mes).

const BASE_URL = 'https://haveibeenpwned.com/api/v3'

export async function hibpCheckBreaches(email: string) {
  const apiKey = process.env.HIBP_API_KEY
  if (!apiKey) {
    return { ok: false, configured: false, error: 'HIBP_API_KEY no configurado en .env' }
  }

  try {
    const res = await fetch(`${BASE_URL}/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`, {
      headers: {
        'hibp-api-key': apiKey,
        'user-agent': 'SIRAX-Identity-Intelligence',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (res.status === 404) {
      return { ok: true, configured: true, breached: false, breaches: [] }
    }
    if (!res.ok) {
      return { ok: false, configured: true, status: res.status, error: `HTTP ${res.status}` }
    }

    const breaches = await res.json()
    return {
      ok: true,
      configured: true,
      breached: true,
      breach_count: breaches.length,
      breaches: breaches.map((b: any) => ({
        name: b.Name,
        title: b.Title,
        breach_date: b.BreachDate,
        pwn_count: b.PwnCount,
        data_classes: b.DataClasses,
        is_sensitive: b.IsSensitive,
        is_verified: b.IsVerified,
      })),
    }
  } catch (err: any) {
    return { ok: false, configured: true, error: err?.message || 'Error de red consultando HaveIBeenPwned' }
  }
}
