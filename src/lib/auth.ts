import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomBytes } from 'crypto'

function resolveJwtSecret(): string {
  const fromEnv = process.env.JWT_SECRET
  if (fromEnv) return fromEnv

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET no está configurado. Defínelo en tu .env antes de arrancar en producción.')
  }

  // Solo en desarrollo: secreto aleatorio por proceso (nunca hardcodeado ni
  // commiteado). Esto invalida los tokens cada vez que reinicias el server
  // en dev, lo cual es esperado y seguro — evita tener un secreto público
  // conocido en el repositorio.
  console.warn('[auth] JWT_SECRET no configurado — usando secreto temporal de desarrollo (los tokens no persisten entre reinicios).')
  return randomBytes(32).toString('hex')
}

const JWT_SECRET = resolveJwtSecret()
const JWT_EXPIRE = '7d'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function signToken(payload: { userId: string; email: string; role: string; fullName: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRE })
}

export function verifyToken(token: string): { userId: string; email: string; role: string; fullName: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as any
  } catch {
    return null
  }
}

export function getTokenFromHeaders(headers: Headers): string | null {
  const auth = headers.get('authorization')
  if (!auth || !auth.startsWith('Bearer ')) return null
  return auth.slice(7)
}
