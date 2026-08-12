import { parseJsonBody } from '@/server/auth-schemas'
import {
  assertSameOrigin,
  AuthorizationError,
  requireAuthenticatedUser,
} from '@/server/authorization'
import { createOtpChallenge, maskEmail, OtpError } from '@/server/otp'
import {
  addEmailSchema,
  removeEmailSchema,
  serializeProfile,
} from '@/server/profile'
import { enforceRateLimit, RateLimitError } from '@/server/rate-limit'
import { getUsersCollection } from '@/server/users'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
const MAX_ACCOUNT_EMAILS = 5

function knownError(error: unknown) {
  if (error instanceof AuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
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
  if (error instanceof RateLimitError) {
    return NextResponse.json(
      { error: error.message },
      { status: 429, headers: { 'Retry-After': String(error.retryAfter) } }
    )
  }
  return null
}

export async function POST(request: Request) {
  const body = await parseJsonBody(request, addEmailSchema)
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: 400 })

  try {
    assertSameOrigin(request)
    const user = await requireAuthenticatedUser()
    await enforceRateLimit({
      request,
      action: `add-profile-email:${user._id.toHexString()}`,
      max: 10,
      windowSeconds: 60 * 60,
    })
    if ((user.emails?.length ?? 1) >= MAX_ACCOUNT_EMAILS) {
      return NextResponse.json(
        { error: `You can keep up to ${MAX_ACCOUNT_EMAILS} email addresses.` },
        { status: 400 }
      )
    }

    const users = await getUsersCollection()
    const owner = await users.findOne({
      $or: [{ email: body.data.email }, { 'emails.address': body.data.email }],
    })
    if (owner) {
      return NextResponse.json(
        { error: 'That email address is already connected to an account.' },
        { status: 409 }
      )
    }

    const challenge = await createOtpChallenge({
      email: body.data.email,
      userId: user._id,
      purpose: 'email-verification',
    })
    return NextResponse.json(
      {
        challengeId: challenge._id.toHexString(),
        email: maskEmail(body.data.email),
        expiresIn: 10 * 60,
        resendAfter: 60,
      },
      { status: 202 }
    )
  } catch (error) {
    const response = knownError(error)
    if (response) return response
    // eslint-disable-next-line no-console
    console.error('secondary email request failed', error)
    return NextResponse.json(
      { error: 'Could not send a verification code. Please try again.' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  const body = await parseJsonBody(request, removeEmailSchema)
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: 400 })

  try {
    assertSameOrigin(request)
    const user = await requireAuthenticatedUser()
    if (body.data.email === user.email) {
      return NextResponse.json(
        { error: 'Your primary account email cannot be removed.' },
        { status: 400 }
      )
    }
    if (body.data.email === (user.displayEmail ?? user.email)) {
      return NextResponse.json(
        { error: 'Select another display email before removing this address.' },
        { status: 400 }
      )
    }

    const users = await getUsersCollection()
    const result = await users.updateOne(
      { _id: user._id, 'emails.address': body.data.email },
      {
        $pull: { emails: { address: body.data.email } },
        $set: { updatedAt: new Date() },
      }
    )
    if (result.modifiedCount !== 1) {
      return NextResponse.json(
        { error: 'That email address is not connected to your account.' },
        { status: 404 }
      )
    }
    const updated = await users.findOne({ _id: user._id })
    if (!updated) {
      return NextResponse.json(
        { error: 'The account no longer exists.' },
        { status: 404 }
      )
    }
    return NextResponse.json({ profile: serializeProfile(updated) })
  } catch (error) {
    const response = knownError(error)
    if (response) return response
    // eslint-disable-next-line no-console
    console.error('secondary email removal failed', error)
    return NextResponse.json(
      { error: 'Could not remove that email address.' },
      { status: 500 }
    )
  }
}
