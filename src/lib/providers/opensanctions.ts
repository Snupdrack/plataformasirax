// Cliente real de OpenSanctions (https://api.opensanctions.org)
// Verificado contra la documentación oficial: POST /match/{dataset}
// Header: Authorization: ApiKey <key>
// Gratis para uso no comercial / investigación; planes pagos para uso comercial.
// Regístrate en https://www.opensanctions.org/api/

const BASE_URL = 'https://api.opensanctions.org'

export async function opensanctionsMatch(fullName: string, opts?: { birthDate?: string; nationality?: string }) {
  const apiKey = process.env.OPENSANCTIONS_API_KEY
  if (!apiKey) {
    return { ok: false, configured: false, error: 'OPENSANCTIONS_API_KEY no configurado en .env' }
  }

  const properties: Record<string, string[]> = { name: [fullName] }
  if (opts?.birthDate) properties.birthDate = [opts.birthDate]
  if (opts?.nationality) properties.nationality = [opts.nationality]

  try {
    const res = await fetch(`${BASE_URL}/match/default`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `ApiKey ${apiKey}`,
      },
      body: JSON.stringify({
        queries: { q: { schema: 'Person', properties } },
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { ok: false, configured: true, status: res.status, error: text || `HTTP ${res.status}` }
    }

    const json = await res.json()
    const results = json?.responses?.q?.results || []

    const matches = results.map((r: any) => ({
      id: r.id,
      caption: r.caption,
      score: Math.round((r.score || 0) * 100),
      datasets: r.datasets || [],
      topics: r.properties?.topics || [],
      countries: r.properties?.country || [],
      schema: r.schema,
    }))

    const isSanctioned = matches.some((m: any) => m.score >= 70 && (m.topics.includes('sanction') || m.topics.includes('debarment') || m.topics.includes('crime')))
    const isPep = matches.some((m: any) => m.score >= 70 && m.topics.includes('role.pep'))

    return {
      ok: true,
      configured: true,
      is_sanctioned: isSanctioned,
      is_pep: isPep,
      matches,
      total_candidates: results.length,
    }
  } catch (err: any) {
    return { ok: false, configured: true, error: err?.message || 'Error de red consultando OpenSanctions' }
  }
}
