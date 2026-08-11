import { parseJsonBody } from '@/server/auth-schemas'
import {
  assertSameOrigin,
  AuthorizationError,
  requireAuthenticatedUser,
} from '@/server/authorization'
import { notificationActionSchema } from '@/server/notification-schemas'
import {
  getNotificationCollections,
  toAppNotification,
  type NotificationDoc,
} from '@/server/notifications'
import { ObjectId, type Filter } from 'mongodb'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

function errorResponse(error: unknown) {
  if (error instanceof AuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  // eslint-disable-next-line no-console
  console.error('notification request failed', error)
  return NextResponse.json(
    { error: 'Could not update notifications. Please try again.' },
    { status: 500 }
  )
}

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser()
    const search = new URL(request.url).searchParams
    const requestedLimit = Number(search.get('limit') ?? 20)
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(50, Math.max(1, Math.floor(requestedLimit)))
      : 20
    const cursor = search.get('cursor')
    const unreadOnly = search.get('unread') === 'true'
    const filter: Filter<NotificationDoc> = {
      recipientId: user._id,
      archivedAt: { $exists: false },
      ...(unreadOnly ? { readAt: { $exists: false } } : {}),
    }
    if (cursor) {
      if (!ObjectId.isValid(cursor)) {
        return NextResponse.json(
          { error: 'The notification cursor is invalid.' },
          { status: 400 }
        )
      }
      filter._id = { $lt: new ObjectId(cursor) }
    }

    const { notifications } = await getNotificationCollections()
    const [results, unreadCount] = await Promise.all([
      notifications
        .find(filter)
        .sort({ _id: -1 })
        .limit(limit + 1)
        .toArray(),
      notifications.countDocuments({
        recipientId: user._id,
        archivedAt: { $exists: false },
        readAt: { $exists: false },
      }),
    ])
    const hasMore = results.length > limit
    const page = hasMore ? results.slice(0, limit) : results

    return NextResponse.json(
      {
        notifications: page.map(toAppNotification),
        unreadCount,
        nextCursor: hasMore ? page.at(-1)?._id.toHexString() : null,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request) {
  const body = await parseJsonBody(request, notificationActionSchema)
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: 400 })
  }

  try {
    assertSameOrigin(request)
    const user = await requireAuthenticatedUser()
    const { notifications } = await getNotificationCollections()
    const now = new Date()

    if (body.data.action === 'mark') {
      const ids = [...new Set(body.data.ids)].map((id) => new ObjectId(id))
      await notifications.updateMany(
        { _id: { $in: ids }, recipientId: user._id },
        body.data.read ? { $set: { readAt: now } } : { $unset: { readAt: '' } }
      )
    } else if (body.data.action === 'mark-all') {
      await notifications.updateMany(
        {
          recipientId: user._id,
          archivedAt: { $exists: false },
          readAt: { $exists: false },
        },
        { $set: { readAt: now } }
      )
    } else if (body.data.action === 'archive') {
      const ids = [...new Set(body.data.ids)].map((id) => new ObjectId(id))
      await notifications.updateMany(
        { _id: { $in: ids }, recipientId: user._id },
        { $set: { archivedAt: now } }
      )
    } else {
      await notifications.updateMany(
        {
          recipientId: user._id,
          archivedAt: { $exists: false },
          readAt: { $exists: true },
        },
        { $set: { archivedAt: now } }
      )
    }

    const unreadCount = await notifications.countDocuments({
      recipientId: user._id,
      archivedAt: { $exists: false },
      readAt: { $exists: false },
    })
    return NextResponse.json({ unreadCount })
  } catch (error) {
    return errorResponse(error)
  }
}
