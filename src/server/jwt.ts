import { SignJWT, jwtVerify } from 'jose'
import { getJwtSecret } from './env'

const ALGORITHM = 'HS256'
const ISSUER = 'bmc-tool'
const AUDIENCE = 'bmc-tool-app'

/** Short-lived, sent on every request. */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60
/** Long-lived; its cookie is path-scoped to /api/auth, not the whole site. */
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60

type TokenType = 'access' | 'refresh'

export type TokenPayload = {
  sub: string
  email: string
  role: string[]
  /**
   * The user's tokenVersion when the token was issued. Bumping the stored
   * version (password change, forced sign-out) invalidates every token issued
   * before it without needing a token blocklist.
   */
  ver: number
}

export async function signToken(
  payload: TokenPayload,
  type: TokenType
): Promise<string> {
  const ttl =
    type === 'access' ? ACCESS_TOKEN_TTL_SECONDS : REFRESH_TOKEN_TTL_SECONDS

  return new SignJWT({
    email: payload.email,
    role: payload.role,
    ver: payload.ver,
    tokenType: type,
  })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(payload.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(getJwtSecret())
}

/**
 * Verifies signature, expiry, issuer, audience and token type. Returns null on
 * any failure — callers treat that as "not authenticated" rather than as an
 * error to surface.
 */
export async function verifyToken(
  token: string,
  expectedType: TokenType
): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: [ALGORITHM],
      issuer: ISSUER,
      audience: AUDIENCE,
    })

    if (payload.tokenType !== expectedType) return null
    if (typeof payload.sub !== 'string') return null
    if (typeof payload.email !== 'string') return null
    if (typeof payload.ver !== 'number') return null
    if (!Array.isArray(payload.role)) return null

    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role.filter((r): r is string => typeof r === 'string'),
      ver: payload.ver,
    }
  } catch {
    return null
  }
}
