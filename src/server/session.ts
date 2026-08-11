import { ObjectId } from 'mongodb'
import { cookies } from 'next/headers'
import { isProduction } from './env'
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  signToken,
  verifyToken,
  type TokenPayload,
} from './jwt'
import { isActiveStatus } from './roles'
import {
  getUsersCollection,
  toPublicUser,
  type PublicUser,
  type UserDoc,
} from './users'

export const ACCESS_COOKIE = 'bmc_access'
export const REFRESH_COOKIE = 'bmc_refresh'

/**
 * Tokens live in httpOnly cookies, so page scripts cannot read them and an XSS
 * bug cannot exfiltrate a session. The refresh cookie is additionally scoped to
 * /api/auth, so it is not attached to ordinary API calls.
 */
const baseCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: isProduction,
} as const

function tokenPayloadFor(user: UserDoc): TokenPayload {
  return {
    sub: user._id.toHexString(),
    email: user.email,
    role: user.role,
    ver: user.tokenVersion,
  }
}

export const REMEMBER_ME_COOKIE = 'bmc_remember'

/**
 * Issues a fresh token pair and writes both cookies.
 *
 * `remember: false` omits maxAge, making them session cookies that the browser
 * drops when it closes. The JWTs still carry their own expiry, so this only
 * shortens the session — it never extends it. The choice is remembered in a
 * non-sensitive cookie so /api/auth/refresh can preserve it on rotation.
 */
export async function startSession(
  user: UserDoc,
  remember = true
): Promise<PublicUser> {
  const payload = tokenPayloadFor(user)
  const [accessToken, refreshToken] = await Promise.all([
    signToken(payload, 'access'),
    signToken(payload, 'refresh'),
  ])

  const cookieStore = await cookies()

  cookieStore.set(ACCESS_COOKIE, accessToken, {
    ...baseCookieOptions,
    path: '/',
    ...(remember ? { maxAge: ACCESS_TOKEN_TTL_SECONDS } : {}),
  })
  cookieStore.set(REFRESH_COOKIE, refreshToken, {
    ...baseCookieOptions,
    path: '/api/auth',
    ...(remember ? { maxAge: REFRESH_TOKEN_TTL_SECONDS } : {}),
  })
  cookieStore.set(REMEMBER_ME_COOKIE, remember ? '1' : '0', {
    ...baseCookieOptions,
    path: '/api/auth',
    ...(remember ? { maxAge: REFRESH_TOKEN_TTL_SECONDS } : {}),
  })

  return toPublicUser(user)
}

/** Reads the persistence choice made at sign-in. Defaults to persistent. */
export async function wasRememberMeRequested(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get(REMEMBER_ME_COOKIE)?.value !== '0'
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(ACCESS_COOKIE, '', {
    ...baseCookieOptions,
    path: '/',
    maxAge: 0,
  })
  cookieStore.set(REFRESH_COOKIE, '', {
    ...baseCookieOptions,
    path: '/api/auth',
    maxAge: 0,
  })
  cookieStore.set(REMEMBER_ME_COOKIE, '', {
    ...baseCookieOptions,
    path: '/api/auth',
    maxAge: 0,
  })
}

async function loadUserForToken(
  payload: TokenPayload
): Promise<UserDoc | null> {
  let id: ObjectId
  try {
    id = new ObjectId(payload.sub)
  } catch {
    return null
  }

  const users = await getUsersCollection()
  const user = await users.findOne({ _id: id })
  if (!user) return null

  // A suspended/inactive account loses access immediately, including through
  // a refresh token issued before its status changed.
  if (!isActiveStatus(user.status ?? 'active')) return null

  // Rejects tokens issued before the user's last credential change.
  if (user.tokenVersion !== payload.ver) return null

  return user
}

/**
 * Resolves the caller from the access-token cookie. Returns null when the
 * cookie is absent, expired, tampered with, or the user no longer matches the
 * token — the caller decides whether that is a 401.
 */
export async function getCurrentUser(): Promise<UserDoc | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(ACCESS_COOKIE)?.value
  if (!token) return null

  const payload = await verifyToken(token, 'access')
  if (!payload) return null

  return loadUserForToken(payload)
}

/**
 * Validates the refresh cookie and returns the user it belongs to, so the
 * caller can rotate the pair.
 */
export async function getUserFromRefreshCookie(): Promise<UserDoc | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(REFRESH_COOKIE)?.value
  if (!token) return null

  const payload = await verifyToken(token, 'refresh')
  if (!payload) return null

  return loadUserForToken(payload)
}
