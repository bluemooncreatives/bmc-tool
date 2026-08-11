import { parseJsonBody, signUpSchema } from '@/server/auth-schemas'
import { hashPassword } from '@/server/password'
import { startSession } from '@/server/session'
import {
  getUsersCollection,
  normalizeEmail,
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
    const users = await getUsersCollection()
    const now = new Date()
    const user: UserDoc = {
      _id: new ObjectId(),
      email,
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

    return NextResponse.json(
      { user: await startSession(user) },
      { status: 201 }
    )
  } catch (error) {
    // 11000 is the unique index on email rejecting a duplicate.
    if (
      error instanceof Error &&
      (error as Error & { code?: number }).code === 11000
    ) {
      return NextResponse.json(
        { error: 'An account with that email already exists.' },
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
