import { NextResponse } from 'next/server'
import { parseJsonBody, signInSchema } from '@/server/auth-schemas'
import { hashPassword, verifyPassword } from '@/server/password'
import { startSession } from '@/server/session'
import { getUsersCollection, normalizeEmail } from '@/server/users'

export const runtime = 'nodejs'

/**
 * Hashing this on a miss keeps the response time for "no such user" close to
 * the response time for "wrong password", so the endpoint does not leak which
 * emails are registered.
 */
const DUMMY_PASSWORD = 'bmc-tool-timing-equalizer'

export async function POST(request: Request) {
  const body = await parseJsonBody(request, signInSchema)
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: 400 })
  }

  try {
    const users = await getUsersCollection()
    const user = await users.findOne({ email: normalizeEmail(body.data.email) })

    if (!user) {
      await hashPassword(DUMMY_PASSWORD)
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      )
    }

    const valid = await verifyPassword(body.data.password, user.passwordHash)
    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      user: await startSession(user, body.data.rememberMe ?? true),
    })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('sign-in failed', error)
    return NextResponse.json(
      { error: 'Could not sign in. Please try again.' },
      { status: 500 }
    )
  }
}
