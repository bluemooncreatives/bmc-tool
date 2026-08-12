import { parseJsonBody } from '@/server/auth-schemas'
import {
  assertSameOrigin,
  AuthorizationError,
  requireAuthenticatedUser,
} from '@/server/authorization'
import {
  isUsernameChanged,
  profileUpdateSchema,
  serializeProfile,
  usernameAvailableAt,
} from '@/server/profile'
import {
  getUsersCollection,
  normalizeEmail,
  normalizeUsername,
  toPublicUser,
  type UserDoc,
} from '@/server/users'
import { type UpdateFilter } from 'mongodb'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof AuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  // eslint-disable-next-line no-console
  console.error(fallback, error)
  return NextResponse.json({ error: fallback }, { status: 500 })
}

export async function GET() {
  try {
    const user = await requireAuthenticatedUser()
    return NextResponse.json(
      { profile: serializeProfile(user) },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    return errorResponse(error, 'Could not load your profile.')
  }
}

export async function PATCH(request: Request) {
  const body = await parseJsonBody(request, profileUpdateSchema)
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: 400 })
  }

  try {
    assertSameOrigin(request)
    const user = await requireAuthenticatedUser()
    const usernameChanged = isUsernameChanged(user, body.data.username)
    const availableAt = usernameAvailableAt(user)
    if (usernameChanged && availableAt && availableAt > new Date()) {
      return NextResponse.json(
        {
          error: `You can change your username again on ${availableAt.toLocaleDateString('en-US', { dateStyle: 'medium' })}.`,
        },
        { status: 409 }
      )
    }

    const displayEmail = normalizeEmail(body.data.displayEmail)
    const canDisplay =
      displayEmail === user.email ||
      user.emails?.some(
        (entry) => entry.address === displayEmail && Boolean(entry.verifiedAt)
      )
    if (!canDisplay) {
      return NextResponse.json(
        {
          error:
            'Select an email address that belongs to and is verified for this account.',
        },
        { status: 400 }
      )
    }

    const users = await getUsersCollection()
    const now = new Date()
    const update: UpdateFilter<UserDoc> = {
      $set: {
        username: body.data.username,
        usernameKey: normalizeUsername(body.data.username),
        displayEmail,
        urls: body.data.urls,
        updatedAt: now,
        ...(usernameChanged ? { usernameChangedAt: now } : {}),
        ...(body.data.bio ? { bio: body.data.bio } : {}),
      },
      ...(!body.data.bio ? { $unset: { bio: '' } } : {}),
    }
    const result = await users.findOneAndUpdate(
      {
        _id: user._id,
        updatedAt: new Date(body.data.expectedUpdatedAt),
      },
      update,
      { returnDocument: 'after' }
    )
    if (!result) {
      return NextResponse.json(
        {
          error:
            'Your profile changed in another session. Reload and try again.',
        },
        { status: 409 }
      )
    }

    return NextResponse.json({
      profile: serializeProfile(result),
      user: toPublicUser(result),
    })
  } catch (error) {
    if (
      error instanceof Error &&
      (error as Error & { code?: number }).code === 11000
    ) {
      return NextResponse.json(
        { error: 'That username is already taken.' },
        { status: 409 }
      )
    }
    return errorResponse(error, 'Could not update your profile.')
  }
}
