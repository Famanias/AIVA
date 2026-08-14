import crypto from 'crypto'

export interface AuthenticatedUser {
  id: string
  email: string
}

export const DEFAULT_LOCAL_USER: AuthenticatedUser = {
  id: '00000000-0000-0000-0000-000000000000',
  email: 'local@aiva.internal',
}

const SESSION_COOKIE_NAME = 'aiva_session'
const APP_SECRET = process.env.APP_SECRET || 'aiva_default_local_master_secret_2026'

/**
 * Creates an HMAC-SHA256 signed session token for a given user.
 */
export function createSessionToken(user: AuthenticatedUser): string {
  const payload = Buffer.from(
    JSON.stringify({
      id: user.id,
      email: user.email,
      iat: Date.now(),
    })
  ).toString('base64url')

  const signature = crypto
    .createHmac('sha256', APP_SECRET)
    .update(payload)
    .digest('base64url')

  return `${payload}.${signature}`
}

/**
 * Validates an HMAC-SHA256 signed session token.
 */
export function validateSessionToken(token: string): AuthenticatedUser | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 2) return null

    const [payload, signature] = parts
    const expectedSignature = crypto
      .createHmac('sha256', APP_SECRET)
      .update(payload)
      .digest('base64url')

    if (signature !== expectedSignature) return null

    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'))
    if (!data.id) return null

    return {
      id: data.id,
      email: data.email || 'local@aiva.internal',
    }
  } catch {
    return null
  }
}

/**
 * Resolves the authenticated user from a Request.
 * In `AIVA_AUTH_MODE=local` (default), always returns the standard local user.
 * In `AIVA_AUTH_MODE=protected`, validates session cookie or authorization header.
 */
export function getAuthenticatedUser(req: Request): AuthenticatedUser | null {
  const authMode = process.env.AIVA_AUTH_MODE || 'local'
  const headerUserId = req.headers.get('x-user-id')

  if (authMode === 'local') {
    return {
      id: headerUserId || DEFAULT_LOCAL_USER.id,
      email: DEFAULT_LOCAL_USER.email,
    }
  }

  // Extract from Cookie header
  const cookieHeader = req.headers.get('cookie') || ''
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [k, ...v] = c.trim().split('=')
      return [k, v.join('=')]
    })
  )

  const token = cookies[SESSION_COOKIE_NAME]
  if (token) {
    const user = validateSessionToken(token)
    if (user) return user
  }

  // Fallback to Authorization Bearer header
  const authHeader = req.headers.get('authorization') || ''
  if (authHeader.startsWith('Bearer ')) {
    const bearerToken = authHeader.slice(7)
    const user = validateSessionToken(bearerToken)
    if (user) return user
  }

  return null
}
