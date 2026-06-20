import type { AiProvider, AiGenerateOptions, AiGenerateResult } from '../types'

const URL_ = 'https://api.anthropic.com/v1/messages'
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'

export const anthropicProvider: AiProvider = {
  id: 'anthropic',
  label: 'Claude (Anthropic)',

  configured: () => !!process.env.ANTHROPIC_API_KEY,

  async generate(prompt: string, opts?: AiGenerateOptions): Promise<AiGenerateResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return { ok: false, error: 'ANTHROPIC_API_KEY no configurado', provider: 'anthropic' }

    try {
      const res = await fetch(URL_, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: opts?.maxTokens || 1500,
          ...(opts?.system ? { system: opts.system } : {}),
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: AbortSignal.timeout(30000),
      })

      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        return { ok: false, error: `HTTP ${res.status}: ${detail.slice(0, 300)}`, provider: 'anthropic' }
      }

      const data = await res.json()
      const text = (data.content || [])
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('\n')

      return { ok: true, text, provider: 'anthropic' }
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Error de red consultando Anthropic', provider: 'anthropic' }
    }
  },
}
