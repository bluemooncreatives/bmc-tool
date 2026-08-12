import { parseJsonBody, signUpSchema } from '@/server/auth-schemas'
import { notifyAccountCreated } from '@/server/notification-events'
import { hashPassword } from '@/server/password'
import { enforceRateLimit, RateLimitError } from '@/server/rate-limit'
import { startSession } from '@/server/session'
import {
  getUsersCollection,
  normalizeEmail,
  normalizeUsername,
  type UserDoc,
} from '@/server/users'
import { ObjectId } from 'mongodb'
import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'

export const runtime = 'nodejs'

function generateAccountNo(): string {
  return `ACC-${randomBytes(4).toString('hex').toUpperCase()}`
}

export async function POST(request: Request) {
  const body = await parseJsonBody(request, signUpSchema)
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: 400 })
  }

  const email = normalizeEmail(body.data.email)

  try {
    await enforceRateLimit({
      request,
      action: 'sign-up',
      max: 10,
      windowSeconds: 60 * 60,
    })
    const users = await getUsersCollection()
    const now = new Date()
    const user: UserDoc = {
      _id: new ObjectId(),
      email,
      username: body.data.username,
      usernameKey: normalizeUsername(body.data.username),
      usernameChangedAt: now,
      emails: [{ address: email, addedAt: now }],
      displayEmail: email,
      passwordHash: await hashPassword(body.data.password),
      role: ['user'],
      status: 'active',
      accountNo: generateAccountNo(),
      mfaEnabled: false,
      failedSignInAttempts: 0,
      modulePermissions: [],
      tokenVersion: 0,
      createdAt: now,
      updatedAt: now,
    }

    await users.insertOne(user)
    await notifyAccountCreated(user)

    return NextResponse.json(
      { user: await startSession(user) },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: error.message },
        {
          status: 429,
          headers: { 'Retry-After': String(error.retryAfter) },
        }
      )
    }
    // 11000 is a unique email or username index rejecting a duplicate.
    if (
      error instanceof Error &&
      (error as Error & { code?: number }).code === 11000
    ) {
      const duplicateField = String(
        (error as Error & { keyPattern?: Record<string, number> }).keyPattern
          ? Object.keys(
              (error as Error & { keyPattern: Record<string, number> })
                .keyPattern
            )[0]
          : ''
      )
      return NextResponse.json(
        {
          error: duplicateField.includes('username')
            ? 'That username is already taken.'
            : 'An account with that email already exists.',
        },
        { status: 409 }
      )
    }

    // eslint-disable-next-line no-console
    console.error('sign-up failed', error)
    return NextResponse.json(
      { error: 'Could not create the account. Please try again.' },
      { status: 500 }
    )
  }
}
