import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/server/session'
import { toPublicUser } from '@/server/users'

export const runtime = 'nodejs'

/** Hydrates the client on load and is the source of truth for "am I signed in". */
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
    }

    return NextResponse.json(
      { user: toPublicUser(user) },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('me lookup failed', error)
    return NextResponse.json(
      { error: 'Could not load the current session.' },
      { status: 500 }
    )
  }
}
