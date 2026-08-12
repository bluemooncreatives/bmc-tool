import { parseJsonBody } from '@/server/auth-schemas'
import {
  assertSameOrigin,
  AuthorizationError,
  requireAuthenticatedUser,
} from '@/server/authorization'
import {
  availableSidebarItems,
  displaySettingsSchema,
  mergeHiddenSidebarItems,
  REQUIRED_SIDEBAR_ITEM,
  serializeDisplaySettings,
} from '@/server/display-settings'
import { getUsersCollection, toPublicUser } from '@/server/users'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

function errorResponse(error: unknown) {
  if (error instanceof AuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  // eslint-disable-next-line no-console
  console.error('display settings request failed', error)
  return NextResponse.json(
    { error: 'Could not update display preferences. Please try again.' },
    { status: 500 }
  )
}

export async function GET() {
  try {
    const user = await requireAuthenticatedUser()
    return NextResponse.json(
      { preferences: serializeDisplaySettings(user) },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request) {
  const body = await parseJsonBody(request, displaySettingsSchema)
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: 400 })
  }

  try {
    assertSameOrigin(request)
    const user = await requireAuthenticatedUser()
    const available = new Set(
      availableSidebarItems(user).map((item) => item.id)
    )
    if (body.data.selectedItems.some((item) => !available.has(item))) {
      return NextResponse.json(
        {
          error:
            'You cannot configure a sidebar item you do not have access to.',
        },
        { status: 403 }
      )
    }
    if (!body.data.selectedItems.includes(REQUIRED_SIDEBAR_ITEM)) {
      return NextResponse.json(
        { error: 'Display settings must remain visible in the sidebar.' },
        { status: 400 }
      )
    }

    const users = await getUsersCollection()
    const updated = await users.findOneAndUpdate(
      {
        _id: user._id,
        updatedAt: new Date(body.data.expectedUpdatedAt),
      },
      {
        $set: {
          hiddenSidebarItems: mergeHiddenSidebarItems(
            user,
            body.data.selectedItems
          ),
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    )
    if (!updated) {
      return NextResponse.json(
        {
          error:
            'Your settings changed in another session. Reload and try again.',
        },
        { status: 409 }
      )
    }
    return NextResponse.json({
      preferences: serializeDisplaySettings(updated),
      user: toPublicUser(updated),
    })
  } catch (error) {
    return errorResponse(error)
  }
}
