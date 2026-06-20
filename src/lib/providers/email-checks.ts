// Verificaciones reales de email que no requieren API key:
// - Registros MX del dominio (node:dns, consulta DNS real)
// - Existencia de Gravatar (HEAD request real a gravatar.com)

import { resolveMx } from 'node:dns/promises'
import { createHash } from 'node:crypto'

export async function checkMxRecords(domain: string): Promise<boolean> {
  try {
    const records = await resolveMx(domain)
    return records.length > 0
  } catch {
    return false
  }
}

export async function checkGravatar(email: string): Promise<boolean> {
  try {
    const hash = createHash('md5').update(email.trim().toLowerCase()).digest('hex')
    const res = await fetch(`https://www.gravatar.com/avatar/${hash}?d=404`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(8000),
    })
    return res.status === 200
  } catch {
    return false
  }
}

const DISPOSABLE_DOMAINS = new Set([
  'tempmail.com', '10minutemail.com', 'guerrillamail.com', 'mailinator.com',
  'throwawaymail.com', 'yopmail.com', 'fakemailgenerator.com', 'trashmail.com',
  'sharklasers.com', 'getnada.com', 'maildrop.cc', 'temp-mail.org',
])

export function isDisposableDomain(domain: string): boolean {
  return DISPOSABLE_DOMAINS.has(domain.toLowerCase())
}
