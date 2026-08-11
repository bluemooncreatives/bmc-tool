import { parseJsonBody } from '@/server/auth-schemas'
import {
  assertSameOrigin,
  AuthorizationError,
  requireAuthenticatedUser,
} from '@/server/authorization'
import { notificationPreferencesSchema } from '@/server/notification-schemas'
import {
  getNotificationPreferences,
  saveNotificationPreferences,
} from '@/server/notifications'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

function errorResponse(error: unknown) {
  if (error instanceof AuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  // eslint-disable-next-line no-console
  console.error('notification preferences request failed', error)
  return NextResponse.json(
    { error: 'Could not update notification preferences. Please try again.' },
    { status: 500 }
  )
}

export async function GET() {
  try {
    const user = await requireAuthenticatedUser()
    return NextResponse.json(await getNotificationPreferences(user._id), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request) {
  const body = await parseJsonBody(request, notificationPreferencesSchema)
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: 400 })
  }
  try {
    assertSameOrigin(request)
    const user = await requireAuthenticatedUser()
    return NextResponse.json(
      await saveNotificationPreferences(
        user._id,
        body.data.mutedCategories
      )
    )
  } catch (error) {
    return errorResponse(error)
  }
}

