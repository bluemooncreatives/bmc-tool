import { emailSchema, parseJsonBody } from '@/server/auth-schemas'
import { createOtpChallenge, maskEmail, OtpError } from '@/server/otp'
import { enforceRateLimit, RateLimitError } from '@/server/rate-limit'
import { getUsersCollection, normalizeEmail } from '@/server/users'
import { ObjectId } from 'mongodb'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const body = await parseJsonBody(request, emailSchema)
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: 400 })
  }

  const email = normalizeEmail(body.data.email)
  try {
    await enforceRateLimit({
      request,
      action: 'forgot-password',
      max: 10,
      windowSeconds: 60 * 60,
    })
    const users = await getUsersCollection()
    const user = await users.findOne({ email })
    const challenge = await createOtpChallenge({
      email,
      userId: user?._id,
      purpose: 'password-reset',
      deliver: Boolean(user),
    })

    // The response is intentionally identical for known and unknown emails.
    return NextResponse.json({
      message:
        'If an account exists for that email, a verification code has been sent.',
      challengeId: challenge._id.toHexString(),
      email: maskEmail(email),
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
    console.error('forgot-password request failed', error)
    // Preserve the same externally visible response as an unknown email. This
    // prevents SMTP availability from becoming an account-enumeration oracle.
    return NextResponse.json({
      message:
        'If an account exists for that email, a verification code has been sent.',
      challengeId: new ObjectId().toHexString(),
      email: maskEmail(email),
      expiresIn: 10 * 60,
      resendAfter: 60,
    })
  }
}
