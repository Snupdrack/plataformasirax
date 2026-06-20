// Genera el "Dictamen Ejecutivo" usando la API real de Claude (Anthropic) sobre
// los datos YA verificados por las otras fuentes (RENAPO, SAT, OpenSanctions,
// HaveIBeenPwned, Hunter.io, Numverify, etc.) — no inventa ni consulta nada
// nuevo, solo redacta en lenguaje natural lo que el resto del pipeline ya
// encontró. Si no hay ANTHROPIC_API_KEY configurada, cae a una plantilla
// determinística (la que ya existía) para que el endpoint nunca truene.

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'

export async function generateAiNarrative(subjectName: string, modules: any, scores: any, fallback: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return fallback

  const prompt = `Eres un analista de cumplimiento (compliance) senior. Redacta un Dictamen Ejecutivo de verificación de identidad en español, claro y profesional, basado ÚNICAMENTE en los datos JSON provistos abajo. No inventes datos que no estén en el JSON. Si un módulo no está disponible (available:false o configured:false), dilo explícitamente en vez de omitirlo silenciosamente.

Estructura requerida (usa estos encabezados exactos en markdown):
## Resumen Ejecutivo
## Hallazgos de Identidad
## Cumplimiento y Sanciones
## Inteligencia Digital
## Análisis de Riesgo
## Recomendación

Sujeto: ${subjectName}

Datos verificados (JSON):
${JSON.stringify({ modules, scores }, null, 2).slice(0, 12000)}`

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!res.ok) {
      console.error('Anthropic API error:', res.status, await res.text().catch(() => ''))
      return fallback
    }

    const data = await res.json()
    const text = (data.content || [])
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n')

    return text || fallback
  } catch (err) {
    console.error('Error generando dictamen con IA:', err)
    return fallback
  }
}
