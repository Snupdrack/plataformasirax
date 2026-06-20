// Proveedor genérico para CUALQUIER servicio compatible con el formato de
// OpenAI Chat Completions — que es prácticamente el estándar de facto hoy:
// Groq, Together.ai, Fireworks, OpenRouter, DeepSeek, Mistral, Azure OpenAI,
// o un modelo corriendo localmente con Ollama/LM Studio/vLLM. No requiere
// código nuevo, solo apuntar AI_CUSTOM_BASE_URL al endpoint correcto.
//
// Ejemplos de AI_CUSTOM_BASE_URL:
//   Groq:        https://api.groq.com/openai/v1
//   Together:    https://api.together.xyz/v1
//   OpenRouter:  https://openrouter.ai/api/v1
//   Ollama local: http://localhost:11434/v1  (AI_CUSTOM_API_KEY no aplica, déjalo vacío)

import type { AiProvider, AiGenerateOptions, AiGenerateResult } from '../types'

const BASE_URL = process.env.AI_CUSTOM_BASE_URL || ''
const MODEL = process.env.AI_CUSTOM_MODEL || ''
const API_KEY = process.env.AI_CUSTOM_API_KEY || ''

export const customProvider: AiProvider = {
  id: 'custom',
  label: 'Proveedor personalizado (compatible con OpenAI)',

  configured: () => !!BASE_URL && !!MODEL,

  async generate(prompt: string, opts?: AiGenerateOptions): Promise<AiGenerateResult> {
    if (!BASE_URL || !MODEL) {
      return { ok: false, error: 'AI_CUSTOM_BASE_URL / AI_CUSTOM_MODEL no configurados', provider: 'custom' }
    }

    const messages: any[] = []
    if (opts?.system) messages.push({ role: 'system', content: opts.system })
    messages.push({ role: 'user', content: prompt })

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (API_KEY) headers.Authorization = `Bearer ${API_KEY}`

    try {
      const res = await fetch(`${BASE_URL.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: MODEL,
          max_tokens: opts?.maxTokens || 1500,
          messages,
        }),
        signal: AbortSignal.timeout(30000),
      })

      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        return { ok: false, error: `HTTP ${res.status}: ${detail.slice(0, 300)}`, provider: 'custom' }
      }

      const data = await res.json()
      const text = data.choices?.[0]?.message?.content || ''
      return { ok: true, text, provider: 'custom' }
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Error de red consultando el proveedor personalizado', provider: 'custom' }
    }
  },
}
