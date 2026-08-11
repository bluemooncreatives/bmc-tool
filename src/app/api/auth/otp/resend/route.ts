import { otpResendSchema, parseJsonBody } from '@/server/auth-schemas'
import { maskEmail, OtpError, resendOtpChallenge } from '@/server/otp'
import { enforceRateLimit, RateLimitError } from '@/server/rate-limit'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const body = await parseJsonBody(request, otpResendSchema)
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: 400 })
  }

  try {
    await enforceRateLimit({
      request,
      action: 'otp-resend',
      max: 10,
      windowSeconds: 60 * 60,
    })
    const challenge = await resendOtpChallenge(body.data.challengeId)
    return NextResponse.json({
      challengeId: challenge._id.toHexString(),
      email: maskEmail(challenge.email),
      expiresIn: 10 * 60,
      resendAfter: 60,
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
    console.error('OTP resend failed', error)
    return NextResponse.json(
      { error: 'Could not send a new code. Please try again.' },
      { status: 500 }
    )
  }
}
