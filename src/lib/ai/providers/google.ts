import type { AiProvider, AiGenerateOptions, AiGenerateResult } from '../types'

const MODEL = process.env.GOOGLE_AI_MODEL || 'gemini-2.0-flash'

export const googleProvider: AiProvider = {
  id: 'google',
  label: 'Google Gemini',

  configured: () => !!process.env.GOOGLE_AI_API_KEY,

  async generate(prompt: string, opts?: AiGenerateOptions): Promise<AiGenerateResult> {
    const apiKey = process.env.GOOGLE_AI_API_KEY
    if (!apiKey) return { ok: false, error: 'GOOGLE_AI_API_KEY no configurado', provider: 'google' }

    const body: any = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: opts?.maxTokens || 1500 },
    }
    if (opts?.system) body.systemInstruction = { parts: [{ text: opts.system }] }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      })

      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        return { ok: false, error: `HTTP ${res.status}: ${detail.slice(0, 300)}`, provider: 'google' }
      }

      const data = await res.json()
      const text = (data.candidates?.[0]?.content?.parts || [])
        .map((p: any) => p.text)
        .filter(Boolean)
        .join('\n')

      return { ok: true, text, provider: 'google' }
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Error de red consultando Google AI', provider: 'google' }
    }
  },
}
