import { createHmac } from 'node:crypto'
import { getJwtSecret } from './env'
import { getDb } from './mongodb'

type RateLimitDoc = {
  key: string
  count: number
  createdAt: Date
  deleteAt: Date
}

export class RateLimitError extends Error {
  constructor(
    message: string,
    readonly retryAfter: number
  ) {
    super(message)
    this.name = 'RateLimitError'
  }
}

let indexReady: Promise<void> | undefined

function clientIdentifier(request: Request): string {
  const forwarded = request.headers
    .get('x-forwarded-for')
    ?.split(',')[0]
    ?.trim()
  return forwarded || request.headers.get('x-real-ip')?.trim() || 'unknown'
}

function opaqueKey(action: string, identifier: string, bucket: number): string {
  return createHmac('sha256', getJwtSecret())
    .update(`${action}:${identifier}:${bucket}`)
    .digest('base64url')
}

export async function enforceRateLimit(input: {
  request: Request
  action: string
  max: number
  windowSeconds: number
}): Promise<void> {
  const db = await getDb()
  const limits = db.collection<RateLimitDoc>('auth_rate_limits')
  if (!indexReady) {
    indexReady = Promise.all([
      limits.createIndex({ key: 1 }, { unique: true }),
      limits.createIndex({ deleteAt: 1 }, { expireAfterSeconds: 0 }),
    ])
      .then(() => undefined)
      .catch((error) => {
        indexReady = undefined
        throw error
      })
  }
  await indexReady

  const now = new Date()
  const windowMs = input.windowSeconds * 1000
  const bucket = Math.floor(now.getTime() / windowMs)
  const key = opaqueKey(input.action, clientIdentifier(input.request), bucket)
  const result = await limits.findOneAndUpdate(
    { key },
    {
      $inc: { count: 1 },
      $setOnInsert: {
        createdAt: now,
        deleteAt: new Date((bucket + 2) * windowMs),
      },
    },
    { upsert: true, returnDocument: 'after' }
  )

  if (result && result.count > input.max) {
    const retryAfter = Math.max(
      1,
      Math.ceil(((bucket + 1) * windowMs - now.getTime()) / 1000)
    )
    throw new RateLimitError(
      'Too many requests. Please wait and try again.',
      retryAfter
    )
  }
}
