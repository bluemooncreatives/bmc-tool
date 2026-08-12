import { NextResponse } from 'next/server'
import { changePasswordSchema } from '@/server/admin-schemas'
import { badRequest, errorResponse } from '@/server/api-errors'
import { parseJsonBody } from '@/server/auth-schemas'
import {
  assertSameOrigin,
  requireAuthenticatedUser,
} from '@/server/authorization'
import { notifyPasswordChanged } from '@/server/notification-events'
import { hashPassword, verifyPassword } from '@/server/password'
import { enforceRateLimit } from '@/server/rate-limit'
import { startSession, wasRememberMeRequested } from '@/server/session'
import { getUsersCollection, toPublicUser } from '@/server/users'

export const runtime = 'nodejs'

/**
 * Lets a signed-in account replace its own password, and is the endpoint the
 * forced "set your own password" screen posts to after a provisioned sign-in.
 *
 * The current password is required for a normal change. It is optional only
 * while `mustChangePassword` is set, because the session cookie was itself
 * just minted by presenting that temporary password.
 */
export async function POST(request: Request) {
  const body = await parseJsonBody(request, changePasswordSchema)
  if (!body.ok) return badRequest(body.error)

  try {
    assertSameOrigin(request)
    const user = await requireAuthenticatedUser()
    await enforceRateLimit({
      request,
      action: `password-change:${user._id.toHexString()}`,
      max: 10,
      windowSeconds: 60 * 60,
    })

    const isForcedChange = Boolean(user.mustChangePassword)
    if (!isForcedChange) {
      if (!body.data.currentPassword) {
        return badRequest('Enter your current password.')
      }
      const valid = await verifyPassword(
        body.data.currentPassword,
        user.passwordHash
      )
      if (!valid) {
        return NextResponse.json(
          { error: 'Your current password is incorrect.' },
          { status: 401 }
        )
      }
    }

    const reused = await verifyPassword(body.data.password, user.passwordHash)
    if (reused) {
      return badRequest('Choose a password you have not used before.')
    }

    const now = new Date()
    const users = await getUsersCollection()
    const updated = await users.findOneAndUpdate(
      { _id: user._id },
      {
        $set: {
          passwordHash: await hashPassword(body.data.password),
          mustChangePassword: false,
          lastPasswordChangeAt: now,
          failedSignInAttempts: 0,
          // An invited account becomes a real one the moment it is claimed.
          ...(user.status === 'invited'
            ? { status: 'active', activatedAt: now }
            : {}),
          updatedAt: now,
        },
        $unset: { lockedUntil: '' },
        // Revokes every other session; the current one is re-issued below.
        $inc: { tokenVersion: 1 },
      },
      { returnDocument: 'after' }
    )

    if (!updated) {
      return NextResponse.json(
        { error: 'The account no longer exists.' },
        { status: 404 }
      )
    }

    await notifyPasswordChanged(updated._id)

    return NextResponse.json({
      user: await startSession(updated, await wasRememberMeRequested()),
      message: 'Password updated successfully.',
    })
  } catch (error) {
    return errorResponse(error, 'password change')
  }
}

export async function GET() {
  try {
    const user = await requireAuthenticatedUser()
    return NextResponse.json(
      { user: toPublicUser(user) },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    return errorResponse(error, 'password change status')
  }
}
