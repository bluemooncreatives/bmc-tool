import { parseJsonBody } from '@/server/auth-schemas'
import {
  assertSameOrigin,
  AuthorizationError,
  requireAuthenticatedUser,
} from '@/server/authorization'
import { maskEmail, OtpError, resendOtpChallenge } from '@/server/otp'
import { resendProfileEmailSchema } from '@/server/profile'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const body = await parseJsonBody(request, resendProfileEmailSchema)
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: 400 })

  try {
    assertSameOrigin(request)
    const user = await requireAuthenticatedUser()
    const challenge = await resendOtpChallenge(body.data.challengeId, {
      userId: user._id,
      purpose: 'email-verification',
    })
    return NextResponse.json({
      challengeId: challenge._id.toHexString(),
      email: maskEmail(challenge.email),
      expiresIn: 10 * 60,
      resendAfter: 60,
    })
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    }
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
    // eslint-disable-next-line no-console
    console.error('secondary email resend failed', error)
    return NextResponse.json(
      { error: 'Could not send a new code.' },
      { status: 500 }
    )
  }
}
