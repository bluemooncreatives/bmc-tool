import { otpVerifySchema, parseJsonBody } from '@/server/auth-schemas'
import { isProduction } from '@/server/env'
import { notifySuccessfulSignIn } from '@/server/notification-events'
import {
  authorizePasswordReset,
  OtpError,
  PASSWORD_RESET_COOKIE,
  verifyOtpChallenge,
} from '@/server/otp'
import { enforceRateLimit, RateLimitError } from '@/server/rate-limit'
import { isActiveStatus } from '@/server/roles'
import { startSession } from '@/server/session'
import { getUsersCollection } from '@/server/users'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'

export const runtime = 'nodejs'
const RESET_AUTHORIZATION_MINUTES = 10

export async function POST(request: Request) {
  const body = await parseJsonBody(request, otpVerifySchema)
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: 400 })
  }

  try {
    await enforceRateLimit({
      request,
      action: 'otp-verify',
      max: 30,
      windowSeconds: 10 * 60,
    })
    const challenge = await verifyOtpChallenge(body.data)

    if (!challenge.userId) {
      return NextResponse.json(
        { error: 'This code is invalid or expired. Request a new code.' },
        { status: 400 }
      )
    }

    const users = await getUsersCollection()
    const user = await users.findOne({ _id: challenge.userId })
    if (!user || !isActiveStatus(user.status ?? 'active')) {
      return NextResponse.json(
        { error: 'This account is not available.' },
        { status: 403 }
      )
    }

    if (challenge.purpose === 'sign-in') {
      const now = new Date()
      await users.updateOne(
        { _id: user._id },
        {
          $set: {
            emailVerifiedAt: user.emailVerifiedAt ?? now,
            lastLoginAt: now,
            updatedAt: now,
          },
        }
      )
      await notifySuccessfulSignIn(user, request)
      return NextResponse.json({
        purpose: 'sign-in',
        user: await startSession(user, challenge.rememberMe ?? true),
      })
    }

    const resetToken = randomBytes(32).toString('base64url')
    const expiresAt = new Date(
      Date.now() + RESET_AUTHORIZATION_MINUTES * 60 * 1000
    )
    await authorizePasswordReset(challenge._id, resetToken, expiresAt)

    const cookieStore = await cookies()
    cookieStore.set(PASSWORD_RESET_COOKIE, resetToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      path: '/api/auth/password',
      maxAge: RESET_AUTHORIZATION_MINUTES * 60,
    })

    return NextResponse.json({
      purpose: 'password-reset',
      challengeId: challenge._id.toHexString(),
    })
  } catch (error) {
    if (error instanceof OtpError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
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
    console.error('OTP verification failed', error)
    return NextResponse.json(
      { error: 'Could not verify the code. Please try again.' },
      { status: 500 }
    )
  }
}
