// Contrato común que debe cumplir cualquier proveedor de IA. Para agregar un
// proveedor nuevo (Mistral, Groq, DeepSeek, Azure OpenAI, un modelo local con
// Ollama, etc.) solo se necesita un archivo en ./providers que exporte un
// objeto con esta forma — ver ./providers/_template.ts.

export interface AiGenerateOptions {
  maxTokens?: number
  system?: string
}

export interface AiGenerateResult {
  ok: boolean
  text?: string
  error?: string
  provider: string
}

export interface AiProvider {
  /** Identificador único, usado en AI_PROVIDER para forzar este proveedor. */
  id: string
  /** Nombre legible para logs/UI. */
  label: string
  /** true si las env vars necesarias están presentes. */
  configured: () => boolean
  /** Genera texto a partir de un prompt. Nunca lanza — siempre regresa AiGenerateResult. */
  generate: (prompt: string, opts?: AiGenerateOptions) => Promise<AiGenerateResult>
}
