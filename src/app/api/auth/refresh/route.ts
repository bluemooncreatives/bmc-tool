import { NextResponse } from 'next/server'
import {
  clearSession,
  getUserFromRefreshCookie,
  startSession,
  wasRememberMeRequested,
} from '@/server/session'

export const runtime = 'nodejs'

/**
 * Exchanges a valid refresh cookie for a new token pair. Both tokens are
 * reissued, so an active session keeps rolling while an idle one expires after
 * the refresh TTL.
 */
export async function POST() {
  try {
    const user = await getUserFromRefreshCookie()
    if (!user) {
      // Drop the stale cookies so the client stops retrying with them.
      await clearSession()
      return NextResponse.json(
        { error: 'Session expired. Please sign in again.' },
        { status: 401 }
      )
    }

    // Rotation keeps whatever persistence the user chose at sign-in.
    const remember = await wasRememberMeRequested()
    return NextResponse.json({ user: await startSession(user, remember) })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('refresh failed', error)
    return NextResponse.json(
      { error: 'Could not refresh the session.' },
      { status: 500 }
    )
  }
}
