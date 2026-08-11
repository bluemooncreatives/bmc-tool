import { type Collection, ObjectId } from 'mongodb'
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import { getJwtSecret } from './env'
import { sendOtpEmail, type OtpMailPurpose } from './mailer'
import { getDb } from './mongodb'

export type OtpPurpose = OtpMailPurpose

export type OtpChallengeDoc = {
  _id: ObjectId
  userId?: ObjectId
  email: string
  purpose: OtpPurpose
  codeHash: string
  attempts: number
  rememberMe?: boolean
  createdAt: Date
  lastSentAt: Date
  expiresAt: Date
  deleteAt: Date
  supersededAt?: Date
  consumedAt?: Date
  resetTokenHash?: string
  resetTokenExpiresAt?: Date
}

export const OTP_TTL_MINUTES = 10
export const OTP_RESEND_SECONDS = 60
export const OTP_MAX_ATTEMPTS = 5
export const PASSWORD_RESET_COOKIE = 'bmc_password_reset'
const OTP_MAX_SENDS_PER_HOUR = 5
const OTP_RETENTION_HOURS = 24

export class OtpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfter?: number
  ) {
    super(message)
    this.name = 'OtpError'
  }
}

let indexesReady: Promise<void> | undefined

async function getOtpCollection(): Promise<Collection<OtpChallengeDoc>> {
  const db = await getDb()
  const challenges = db.collection<OtpChallengeDoc>('otp_challenges')

  if (!indexesReady) {
    indexesReady = Promise.all([
      challenges.createIndex({ deleteAt: 1 }, { expireAfterSeconds: 0 }),
      challenges.createIndex({ email: 1, purpose: 1, createdAt: -1 }),
      challenges.createIndex({ userId: 1, purpose: 1, createdAt: -1 }),
    ])
      .then(() => undefined)
      .catch((error) => {
        indexesReady = undefined
        throw error
      })
  }
  await indexesReady
  return challenges
}

function hashSecret(secret: string, challengeId: ObjectId): string {
  return createHmac('sha256', getJwtSecret())
    .update(`${challengeId.toHexString()}:${secret}`)
    .digest('base64url')
}

function matchesSecret(
  secret: string,
  expectedHash: string,
  challengeId: ObjectId
): boolean {
  const actual = Buffer.from(hashSecret(secret, challengeId))
  const expected = Buffer.from(expectedHash)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0')
}

export function parseChallengeId(value: string): ObjectId | null {
  return ObjectId.isValid(value) ? new ObjectId(value) : null
}

export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@')
  if (!domain) return 'your email'
  const visible = local.slice(0, Math.min(2, local.length))
  return `${visible}${'*'.repeat(Math.max(2, local.length - visible.length))}@${domain}`
}

async function enforceSendLimits(
  challenges: Collection<OtpChallengeDoc>,
  email: string,
  purpose: OtpPurpose,
  now: Date
): Promise<void> {
  const latest = await challenges.findOne(
    { email, purpose },
    { sort: { createdAt: -1 } }
  )

  if (latest) {
    const secondsSinceLastSend = Math.floor(
      (now.getTime() - latest.lastSentAt.getTime()) / 1000
    )
    if (secondsSinceLastSend < OTP_RESEND_SECONDS) {
      const retryAfter = OTP_RESEND_SECONDS - secondsSinceLastSend
      throw new OtpError(
        `Please wait ${retryAfter} seconds before requesting another code.`,
        429,
        retryAfter
      )
    }
  }

  const sentInLastHour = await challenges.countDocuments({
    email,
    purpose,
    createdAt: { $gte: new Date(now.getTime() - 60 * 60 * 1000) },
  })
  if (sentInLastHour >= OTP_MAX_SENDS_PER_HOUR) {
    throw new OtpError(
      'Too many codes were requested. Please try again in an hour.',
      429,
      60 * 60
    )
  }
}

export async function createOtpChallenge(input: {
  email: string
  userId?: ObjectId
  purpose: OtpPurpose
  rememberMe?: boolean
  /** Unknown reset emails still get a challenge, but never an email. */
  deliver?: boolean
}): Promise<OtpChallengeDoc> {
  const challenges = await getOtpCollection()
  const now = new Date()
  await enforceSendLimits(challenges, input.email, input.purpose, now)

  const id = new ObjectId()
  const code = generateCode()
  const challenge: OtpChallengeDoc = {
    _id: id,
    userId: input.userId,
    email: input.email,
    purpose: input.purpose,
    codeHash: hashSecret(code, id),
    attempts: 0,
    rememberMe: input.rememberMe,
    createdAt: now,
    lastSentAt: now,
    expiresAt: new Date(now.getTime() + OTP_TTL_MINUTES * 60 * 1000),
    deleteAt: new Date(now.getTime() + OTP_RETENTION_HOURS * 60 * 60 * 1000),
  }

  await challenges.insertOne(challenge)

  try {
    if (input.deliver !== false) {
      await sendOtpEmail({
        to: input.email,
        code,
        purpose: input.purpose,
        expiresInMinutes: OTP_TTL_MINUTES,
      })
    }
  } catch (error) {
    await challenges.deleteOne({ _id: id })
    throw error
  }

  // A new code immediately invalidates older codes for the same flow.
  await challenges.updateMany(
    {
      _id: { $ne: id },
      email: input.email,
      purpose: input.purpose,
      consumedAt: { $exists: false },
      supersededAt: { $exists: false },
    },
    { $set: { supersededAt: now } }
  )

  return challenge
}

export async function resendOtpChallenge(
  challengeId: string
): Promise<OtpChallengeDoc> {
  const id = parseChallengeId(challengeId)
  if (!id) throw new OtpError('This verification request is invalid.', 400)

  const challenges = await getOtpCollection()
  const previous = await challenges.findOne({ _id: id })
  if (
    !previous ||
    previous.consumedAt ||
    previous.supersededAt ||
    previous.expiresAt <= new Date()
  ) {
    throw new OtpError(
      'This verification request has expired. Start again to get a new code.',
      410
    )
  }

  return createOtpChallenge({
    email: previous.email,
    userId: previous.userId,
    purpose: previous.purpose,
    rememberMe: previous.rememberMe,
    deliver: Boolean(previous.userId),
  })
}

export async function verifyOtpChallenge(input: {
  challengeId: string
  code: string
}): Promise<OtpChallengeDoc> {
  const id = parseChallengeId(input.challengeId)
  if (!id) throw new OtpError('This verification request is invalid.', 400)

  const challenges = await getOtpCollection()
  const now = new Date()

  // Consuming an attempt first makes the attempt ceiling safe under concurrent
  // requests. Only one successful request can set consumedAt below.
  const challenge = await challenges.findOneAndUpdate(
    {
      _id: id,
      consumedAt: { $exists: false },
      supersededAt: { $exists: false },
      expiresAt: { $gt: now },
      attempts: { $lt: OTP_MAX_ATTEMPTS },
    },
    { $inc: { attempts: 1 } },
    { returnDocument: 'after' }
  )

  if (!challenge) {
    throw new OtpError(
      'This code is invalid, expired, or already used. Request a new code.',
      400
    )
  }

  if (!matchesSecret(input.code, challenge.codeHash, challenge._id)) {
    const remaining = OTP_MAX_ATTEMPTS - challenge.attempts
    throw new OtpError(
      remaining > 0
        ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
        : 'Too many incorrect attempts. Request a new code.',
      400
    )
  }

  const consumed = await challenges.updateOne(
    { _id: id, consumedAt: { $exists: false } },
    { $set: { consumedAt: now } }
  )
  if (consumed.modifiedCount !== 1) {
    throw new OtpError('This code has already been used.', 409)
  }

  return { ...challenge, consumedAt: now }
}

export async function authorizePasswordReset(
  challengeId: ObjectId,
  resetToken: string,
  expiresAt: Date
): Promise<void> {
  const challenges = await getOtpCollection()
  await challenges.updateOne(
    {
      _id: challengeId,
      purpose: 'password-reset',
      consumedAt: { $exists: true },
    },
    {
      $set: {
        resetTokenHash: hashSecret(resetToken, challengeId),
        resetTokenExpiresAt: expiresAt,
      },
    }
  )
}

export async function consumePasswordResetAuthorization(input: {
  challengeId: string
  resetToken: string
}): Promise<OtpChallengeDoc | null> {
  const id = parseChallengeId(input.challengeId)
  if (!id) return null

  const challenges = await getOtpCollection()
  const challenge = await challenges.findOne({
    _id: id,
    purpose: 'password-reset',
    consumedAt: { $exists: true },
    resetTokenExpiresAt: { $gt: new Date() },
  })
  if (
    !challenge?.resetTokenHash ||
    !matchesSecret(input.resetToken, challenge.resetTokenHash, id)
  ) {
    return null
  }

  const result = await challenges.updateOne(
    { _id: id, resetTokenHash: challenge.resetTokenHash },
    { $unset: { resetTokenHash: '', resetTokenExpiresAt: '' } }
  )
  return result.modifiedCount === 1 ? challenge : null
}
