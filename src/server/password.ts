import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto'

// promisify's typings drop the options argument, so wrap scrypt directly.
function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (error, derivedKey) => {
      if (error) reject(error)
      else resolve(derivedKey)
    })
  })
}

// Cost parameters. 128 * N * r bytes of memory => 16 MiB here, which stays
// under Node's default 32 MiB scrypt maxmem.
const N = 16384
const r = 8
const p = 1
const KEY_LENGTH = 64
const SALT_LENGTH = 16

/**
 * Hashes a password with scrypt. The cost parameters are stored alongside the
 * digest so existing hashes stay verifiable if they are tuned up later.
 *
 * Format: scrypt$N$r$p$<salt base64url>$<key base64url>
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH)
  const key = await scryptAsync(password, salt, KEY_LENGTH, { N, r, p })

  return [
    'scrypt',
    N,
    r,
    p,
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join('$')
}

/**
 * Verifies a password against a stored hash. Returns false rather than
 * throwing on a malformed or unknown-format hash.
 */
export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false

  const [, rawN, rawR, rawP, rawSalt, rawKey] = parts
  const params = { N: Number(rawN), r: Number(rawR), p: Number(rawP) }
  if (!Number.isFinite(params.N) || !Number.isFinite(params.r)) return false

  const expected = Buffer.from(rawKey, 'base64url')
  const actual = await scryptAsync(
    password,
    Buffer.from(rawSalt, 'base64url'),
    expected.length,
    params
  )

  // Lengths are equal by construction, but timingSafeEqual throws if they are
  // not, so guard before comparing.
  if (actual.length !== expected.length) return false
  return timingSafeEqual(actual, expected)
}
