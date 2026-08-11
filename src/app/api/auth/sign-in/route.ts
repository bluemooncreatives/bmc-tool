import { parseJsonBody, signInSchema } from '@/server/auth-schemas'
import {
  notifyAccountLocked,
  notifySuccessfulSignIn,
} from '@/server/notification-events'
import { createOtpChallenge, maskEmail, OtpError } from '@/server/otp'
import { hashPassword, verifyPassword } from '@/server/password'
import { enforceRateLimit, RateLimitError } from '@/server/rate-limit'
import { isActiveStatus, requiresMfa } from '@/server/roles'
import { startSession } from '@/server/session'
import { getUsersCollection, normalizeEmail } from '@/server/users'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * Hashing this on a miss keeps the response time for "no such user" close to
 * the response time for "wrong password", so the endpoint does not leak which
 * emails are registered.
 */
const DUMMY_PASSWORD = 'bmc-tool-timing-equalizer'
const MAX_FAILED_ATTEMPTS = 5
const LOCK_MINUTES = 15

export async function POST(request: Request) {
  const body = await parseJsonBody(request, signInSchema)
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: 400 })
  }

  try {
    await enforceRateLimit({
      request,
      action: 'sign-in',
      max: 30,
      windowSeconds: 15 * 60,
    })
    const users = await getUsersCollection()
    const user = await users.findOne({ email: normalizeEmail(body.data.email) })

    if (!user) {
      await hashPassword(DUMMY_PASSWORD)
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      )
    }

    const now = new Date()
    if (user.lockedUntil && user.lockedUntil > now) {
      const retryAfter = Math.max(
        1,
        Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 1000)
      )
      return NextResponse.json(
        {
          error:
            'This account is temporarily locked after repeated failed attempts. Please try again later.',
        },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }

    const valid = await verifyPassword(body.data.password, user.passwordHash)
    if (!valid) {
      const attempts = (user.failedSignInAttempts ?? 0) + 1
      const lockedUntil =
        attempts >= MAX_FAILED_ATTEMPTS
          ? new Date(now.getTime() + LOCK_MINUTES * 60 * 1000)
          : undefined
      await users.updateOne(
        { _id: user._id },
        {
          $set: {
            failedSignInAttempts: attempts,
            updatedAt: now,
            ...(lockedUntil ? { lockedUntil } : {}),
          },
        }
      )
      if (lockedUntil) await notifyAccountLocked(user, lockedUntil)
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      )
    }

    if (!isActiveStatus(user.status ?? 'active')) {
      return NextResponse.json(
        { error: 'This account is not active. Contact your administrator.' },
        { status: 403 }
      )
    }

    await users.updateOne(
      { _id: user._id },
      {
        $set: { failedSignInAttempts: 0, updatedAt: now },
        $unset: { lockedUntil: '' },
      }
    )

    if (user.mfaEnabled || requiresMfa(user.role)) {
      const challenge = await createOtpChallenge({
        email: user.email,
        userId: user._id,
        purpose: 'sign-in',
        rememberMe: body.data.rememberMe ?? true,
      })
      return NextResponse.json(
        {
          requiresOtp: true,
          challengeId: challenge._id.toHexString(),
          email: maskEmail(user.email),
          expiresIn: 10 * 60,
          resendAfter: 60,
        },
        { status: 202 }
      )
    }

    const signedInUser = {
      ...user,
      failedSignInAttempts: 0,
      lockedUntil: undefined,
    }
    await notifySuccessfulSignIn(signedInUser, request)
    return NextResponse.json({
      user: await startSession(signedInUser, body.data.rememberMe ?? true),
    })
  } catch (error) {
    if (error instanceof OtpError) {
      return NextResponse.json(
        { error: error.message },
        {
          status: error.status,
          headers: error.retryAfter
            ? { 'Retry-After': String(error.retryAfter) }
            : undefined,
        }
      )
    }
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: error.message },
        {
          status: 429,
          headers: { 'Retry-After': String(error.retryAfter) },
        }
      )
    }
    // eslint-disable-next-line no-console
    console.error('sign-in failed', error)
    return NextResponse.json(
      { error: 'Could not sign in. Please try again.' },
      { status: 500 }
    )
  }
}
