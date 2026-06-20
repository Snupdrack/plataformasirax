// Genera el "Dictamen Ejecutivo" usando la capa agnóstica de IA (src/lib/ai)
// sobre los datos YA verificados por las otras fuentes (RENAPO, SAT,
// OpenSanctions, HaveIBeenPwned, Hunter.io, Numverify, etc.) — no inventa ni
// consulta nada nuevo, solo redacta en lenguaje natural lo que el resto del
// pipeline ya encontró. Funciona con cualquier proveedor configurado
// (AI_PROVIDER=anthropic|openai|google|custom). Si no hay ningún proveedor
// configurado, cae a una plantilla determinística para que el endpoint
// nunca truene.

import { generateAiText } from '@/lib/ai'

export async function generateAiNarrative(subjectName: string, modules: any, scores: any, fallback: string): Promise<string> {
  const system = 'Eres un analista de cumplimiento (compliance) senior. Redactas dictámenes ejecutivos de verificación de identidad en español, claros y profesionales, basados ÚNICAMENTE en los datos JSON provistos. No inventas datos que no estén en el JSON. Si un módulo no está disponible (available:false o configured:false), lo dices explícitamente en vez de omitirlo silenciosamente.'

  const prompt = `Redacta un Dictamen Ejecutivo de verificación de identidad para: ${subjectName}

Estructura requerida (usa estos encabezados exactos en markdown):
## Resumen Ejecutivo
## Hallazgos de Identidad
## Cumplimiento y Sanciones
## Inteligencia Digital
## Análisis de Riesgo
## Recomendación

Datos verificados (JSON):
${JSON.stringify({ modules, scores }, null, 2).slice(0, 12000)}`

  const result = await generateAiText(prompt, { system, maxTokens: 1500 })

  if (!result.ok || !result.text) {
    console.error('[ai-report] usando fallback de plantilla:', result.error)
    return fallback
  }

  return result.text
}
