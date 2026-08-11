import { resetPasswordSchema, parseJsonBody } from '@/server/auth-schemas'
import { isProduction } from '@/server/env'
import {
  consumePasswordResetAuthorization,
  PASSWORD_RESET_COOKIE,
} from '@/server/otp'
import { hashPassword } from '@/server/password'
import { clearSession } from '@/server/session'
import { getUsersCollection } from '@/server/users'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const body = await parseJsonBody(request, resetPasswordSchema)
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: 400 })
  }

  const cookieStore = await cookies()
  const resetToken = cookieStore.get(PASSWORD_RESET_COOKIE)?.value
  if (!resetToken) {
    return NextResponse.json(
      { error: 'Password reset authorization expired. Start again.' },
      { status: 401 }
    )
  }

  try {
    const authorization = await consumePasswordResetAuthorization({
      challengeId: body.data.challengeId,
      resetToken,
    })
    if (!authorization?.userId) {
      return NextResponse.json(
        { error: 'Password reset authorization expired. Start again.' },
        { status: 401 }
      )
    }

    const now = new Date()
    const users = await getUsersCollection()
    const updated = await users.updateOne(
      { _id: authorization.userId },
      {
        $set: {
          passwordHash: await hashPassword(body.data.password),
          emailVerifiedAt: now,
          failedSignInAttempts: 0,
          updatedAt: now,
        },
        $unset: { lockedUntil: '' },
        $inc: { tokenVersion: 1 },
      }
    )
    if (updated.matchedCount !== 1) {
      return NextResponse.json(
        { error: 'The account no longer exists.' },
        { status: 404 }
      )
    }

    await clearSession()
    cookieStore.set(PASSWORD_RESET_COOKIE, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      path: '/api/auth/password',
      maxAge: 0,
    })

    return NextResponse.json({ message: 'Password updated successfully.' })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('password reset failed', error)
    return NextResponse.json(
      { error: 'Could not update the password. Please try again.' },
      { status: 500 }
    )
  }
}
