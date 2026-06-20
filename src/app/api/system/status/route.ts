import { NextResponse } from 'next/server'
import { verifyToken, getTokenFromHeaders } from '@/lib/auth'
import { PROVIDER_REGISTRY } from '@/lib/providers/registry'
import { listAiProviders } from '@/lib/ai'

// GET /api/system/status — muestra qué proveedores están configurados, sin
// exponer los valores de las API keys. Útil para verificar el .env sin tener
// que ir archivo por archivo, y para confirmar que un submódulo nuevo quedó
// bien registrado.
export async function GET(request: Request) {
  const token = getTokenFromHeaders(request.headers)
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const payload = verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

  const dataProviders = PROVIDER_REGISTRY.map((p) => ({
    id: p.id,
    label: p.label,
    category: p.category,
    configured: p.configured(),
    env_vars: p.envVars,
    docs_url: p.docsUrl,
  }))

  const aiProviders = listAiProviders().map((p) => ({
    ...p,
    category: 'ia' as const,
  }))

  const all = [...dataProviders, ...aiProviders]

  return NextResponse.json({
    providers: all,
    summary: {
      total: all.length,
      configured: all.filter((p) => p.configured).length,
      not_configured: all.filter((p) => !p.configured).map((p) => p.id),
    },
  })
}
