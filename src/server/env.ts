/**
 * Server-only environment access.
 *
 * Every value here is read lazily rather than at module load, so importing a
 * route handler during `next build` does not require the secrets to be present.
 * A missing value throws at request time with a message naming the variable.
 */

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Add it to .env (see .env.example).`
    )
  }
  return value
}

export function getMongoUri(): string {
  return required('MONGODB_URI')
}

export function getJwtSecret(): Uint8Array {
  return new TextEncoder().encode(required('JWT_SECRET'))
}

export const isProduction = process.env.NODE_ENV === 'production'
