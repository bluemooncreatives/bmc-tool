import { otpResendSchema, parseJsonBody } from '@/server/auth-schemas'
import { maskEmail, OtpError, resendOtpChallenge } from '@/server/otp'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const body = await parseJsonBody(request, otpResendSchema)
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: 400 })
  }

  try {
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
    // eslint-disable-next-line no-console
    console.error('OTP resend failed', error)
    return NextResponse.json(
      { error: 'Could not send a new code. Please try again.' },
      { status: 500 }
    )
  }
}
