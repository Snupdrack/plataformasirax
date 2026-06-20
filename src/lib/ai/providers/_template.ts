// PLANTILLA — copia este archivo a un nombre nuevo (ej. mistral.ts), ajusta
// la llamada HTTP real al API del proveedor que quieras agregar, y regístralo
// en ../index.ts dentro del objeto PROVIDERS. Eso es todo lo que se necesita
// para que el resto del sistema (dictamen ejecutivo, futuros módulos de IA)
// pueda usarlo seleccionando AI_PROVIDER=mi-proveedor en el .env.
//
// Este archivo NO se importa en ningún lado — es solo referencia. Bórralo o
// déjalo, no afecta el build.

import type { AiProvider, AiGenerateOptions, AiGenerateResult } from '../types'

const API_KEY_ENV = 'MI_PROVEEDOR_API_KEY' // <- cambia esto
const MODEL = process.env.MI_PROVEEDOR_MODEL || 'modelo-por-defecto'

export const templateProvider: AiProvider = {
  id: 'mi-proveedor',
  label: 'Mi Proveedor',

  configured: () => !!process.env[API_KEY_ENV],

  async generate(prompt: string, opts?: AiGenerateOptions): Promise<AiGenerateResult> {
    const apiKey = process.env[API_KEY_ENV]
    if (!apiKey) {
      return { ok: false, error: `${API_KEY_ENV} no configurado`, provider: 'mi-proveedor' }
    }

    try {
      const res = await fetch('https://api.mi-proveedor.com/v1/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          prompt,
          system: opts?.system,
          max_tokens: opts?.maxTokens || 1500,
        }),
        signal: AbortSignal.timeout(30000),
      })

      if (!res.ok) {
        return { ok: false, error: `HTTP ${res.status}`, provider: 'mi-proveedor' }
      }

      const data = await res.json()
      return { ok: true, text: data.output_text, provider: 'mi-proveedor' }
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Error de red', provider: 'mi-proveedor' }
    }
  },
}
