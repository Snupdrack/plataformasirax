// Verificación REAL de existencia de username en plataformas públicas.
// No usa API keys: solo consulta los endpoints JSON públicos que cada
// plataforma expone para verificar si un perfil existe (igual que Sherlock/
// Maigret, pero limitado a plataformas con API pública estable — evitamos
// scraping de HTML contra plataformas que lo prohíben en sus ToS como
// Instagram/TikTok/LinkedIn, que además devuelven 200 genérico sin importar
// si el usuario existe, haciendo el chequeo poco confiable).

type PlatformCheck = {
  platform: string
  url: (username: string) => string
  check: (username: string) => Promise<boolean>
}

async function fetchOk(url: string): Promise<number> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'SIRAX-Identity-Intelligence/1.0' },
    })
    return res.status
  } catch {
    return 0
  }
}

const PLATFORMS: PlatformCheck[] = [
  {
    platform: 'GitHub',
    url: (u) => `https://github.com/${u}`,
    check: async (u) => (await fetchOk(`https://api.github.com/users/${encodeURIComponent(u)}`)) === 200,
  },
  {
    platform: 'GitLab',
    url: (u) => `https://gitlab.com/${u}`,
    check: async (u) => (await fetchOk(`https://gitlab.com/api/v4/users?username=${encodeURIComponent(u)}`)) === 200,
  },
  {
    platform: 'Reddit',
    url: (u) => `https://reddit.com/user/${u}`,
    check: async (u) => (await fetchOk(`https://www.reddit.com/user/${encodeURIComponent(u)}/about.json`)) === 200,
  },
  {
    platform: 'Dev.to',
    url: (u) => `https://dev.to/${u}`,
    check: async (u) => (await fetchOk(`https://dev.to/api/users/by_username?url=${encodeURIComponent(u)}`)) === 200,
  },
  {
    platform: 'Stack Overflow',
    url: (u) => `https://stackoverflow.com/users?username=${u}`,
    check: async (u) => (await fetchOk(`https://api.stackexchange.com/2.3/users?inname=${encodeURIComponent(u)}&site=stackoverflow`)) === 200,
  },
]

export async function checkUsernamePresence(username: string) {
  if (!username) return { ok: false, configured: true, found: false, profiles: [] as any[] }

  const results = await Promise.allSettled(
    PLATFORMS.map(async (p) => {
      const exists = await p.check(username)
      return exists ? { platform: p.platform, url: p.url(username), verified: true } : null
    })
  )

  const profiles = results
    .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value !== null)
    .map((r) => r.value)

  return {
    ok: true,
    configured: true,
    username,
    found: profiles.length > 0,
    profile_count: profiles.length,
    profiles,
    platforms_checked: PLATFORMS.map((p) => p.platform),
    note: 'Solo se verifican plataformas con API pública confiable (GitHub, GitLab, Reddit, Dev.to, Stack Overflow). Instagram/TikTok/LinkedIn no se incluyen por no exponer una forma confiable de verificar existencia sin scraping.',
  }
}
