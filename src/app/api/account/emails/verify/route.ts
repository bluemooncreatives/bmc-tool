import { parseJsonBody } from '@/server/auth-schemas'
import {
  assertSameOrigin,
  AuthorizationError,
  requireAuthenticatedUser,
} from '@/server/authorization'
import { OtpError, verifyOtpChallenge } from '@/server/otp'
import { serializeProfile, verifyProfileEmailSchema } from '@/server/profile'
import { getUsersCollection } from '@/server/users'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const body = await parseJsonBody(request, verifyProfileEmailSchema)
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: 400 })

  try {
    assertSameOrigin(request)
    const user = await requireAuthenticatedUser()
    if ((user.emails?.length ?? 1) >= 5) {
      return NextResponse.json(
        { error: 'You can keep up to 5 email addresses.' },
        { status: 400 }
      )
    }
    const challenge = await verifyOtpChallenge({
      ...body.data,
      expectedUserId: user._id,
      expectedPurpose: 'email-verification',
    })

    const users = await getUsersCollection()
    const now = new Date()
    const result = await users.findOneAndUpdate(
      {
        _id: user._id,
        email: { $ne: challenge.email },
        'emails.address': { $ne: challenge.email },
        // Keeps the five-address ceiling safe under concurrent verifications.
        'emails.4': { $exists: false },
      },
      {
        $push: {
          emails: { address: challenge.email, addedAt: now, verifiedAt: now },
        },
        $set: { updatedAt: now },
      },
      { returnDocument: 'after' }
    )
    if (!result) {
      return NextResponse.json(
        { error: 'That email address is already connected to an account.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ profile: serializeProfile(result) })
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
        { status: error.status }
      )
    }
    if (
      error instanceof Error &&
      (error as Error & { code?: number }).code === 11000
    ) {
      return NextResponse.json(
        { error: 'That email address is already connected to an account.' },
        { status: 409 }
      )
    }
    // eslint-disable-next-line no-console
    console.error('secondary email verification failed', error)
    return NextResponse.json(
      { error: 'Could not verify that email address.' },
      { status: 500 }
    )
  }
}
