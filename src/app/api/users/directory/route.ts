import { NextResponse } from 'next/server'
import {
  AuthorizationError,
  requireAuthenticatedUser,
} from '@/server/authorization'
import { getUserDisplayName, getUsersCollection } from '@/server/users'

export const runtime = 'nodejs'

/**
 * A lightweight name/email listing any authenticated user can read, used to
 * populate assignee ("Tagged To") pickers. No permissions/roles/status here —
 * that data stays behind the superadmin-only permission manager.
 */
export async function GET() {
  try {
    await requireAuthenticatedUser()

    const users = await getUsersCollection()
    const results = await users.find({}).sort({ email: 1 }).limit(500).toArray()

    return NextResponse.json(
      {
        users: results.map((user) => ({
          id: user._id.toHexString(),
          name: getUserDisplayName(user),
          email: user.email,
        })),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    // eslint-disable-next-line no-console
    console.error('users directory request failed', error)
    return NextResponse.json(
      { error: 'Could not load the user directory.' },
      { status: 500 }
    )
  }
}
