import { type Collection, ObjectId } from 'mongodb'
import {
  sanitizeMutedCategories,
  type AppNotification,
  type NotificationCategory,
  type NotificationLevel,
  type NotificationPreferences,
} from '@/lib/notifications'
import { getDb } from './mongodb'

export type NotificationDoc = {
  _id: ObjectId
  recipientId: ObjectId
  actorId?: ObjectId
  category: NotificationCategory
  level: NotificationLevel
  title: string
  message: string
  actionUrl?: string
  dedupeKey?: string
  readAt?: Date
  archivedAt?: Date
  createdAt: Date
  expiresAt: Date
}

type NotificationPreferencesDoc = {
  _id: ObjectId
  userId: ObjectId
  mutedCategories: NotificationCategory[]
  createdAt: Date
  updatedAt: Date
}

let collectionsReady: Promise<void> | undefined

async function prepareCollections(
  notifications: Collection<NotificationDoc>,
  preferences: Collection<NotificationPreferencesDoc>
): Promise<void> {
  await Promise.all([
    notifications.createIndex({ recipientId: 1, _id: -1 }),
    notifications.createIndex({ recipientId: 1, readAt: 1, _id: -1 }),
    notifications.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    notifications.createIndex(
      { recipientId: 1, dedupeKey: 1 },
      {
        unique: true,
        partialFilterExpression: { dedupeKey: { $type: 'string' } },
      }
    ),
    preferences.createIndex({ userId: 1 }, { unique: true }),
  ])
}

export async function getNotificationCollections() {
  const db = await getDb()
  const notifications = db.collection<NotificationDoc>('notifications')
  const preferences =
    db.collection<NotificationPreferencesDoc>('notification_preferences')

  if (!collectionsReady) {
    collectionsReady = prepareCollections(notifications, preferences).catch(
      (error) => {
        collectionsReady = undefined
        throw error
      }
    )
  }
  await collectionsReady
  return { notifications, preferences }
}

export function toAppNotification(
  notification: NotificationDoc
): AppNotification {
  return {
    id: notification._id.toHexString(),
    category: notification.category,
    level: notification.level,
    title: notification.title,
    message: notification.message,
    actionUrl: notification.actionUrl,
    actorId: notification.actorId?.toHexString(),
    readAt: notification.readAt?.toISOString(),
    createdAt: notification.createdAt.toISOString(),
  }
}

export async function getNotificationPreferences(
  userId: ObjectId
): Promise<NotificationPreferences> {
  const { preferences } = await getNotificationCollections()
  const saved = await preferences.findOne({ userId })
  return {
    mutedCategories: sanitizeMutedCategories(saved?.mutedCategories),
    updatedAt: saved?.updatedAt.toISOString(),
  }
}

export async function saveNotificationPreferences(
  userId: ObjectId,
  mutedCategories: NotificationCategory[]
): Promise<NotificationPreferences> {
  const { preferences } = await getNotificationCollections()
  const now = new Date()
  const saved = await preferences.findOneAndUpdate(
    { userId },
    {
      $set: {
        mutedCategories: sanitizeMutedCategories(mutedCategories),
        updatedAt: now,
      },
      $setOnInsert: { _id: new ObjectId(), userId, createdAt: now },
    },
    { upsert: true, returnDocument: 'after' }
  )
  return {
    mutedCategories: sanitizeMutedCategories(saved?.mutedCategories),
    updatedAt: saved?.updatedAt.toISOString(),
  }
}

function safeActionUrl(value: string | undefined): string | undefined {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return
  return value.slice(0, 500)
}

export async function createNotification(input: {
  recipientId: ObjectId
  actorId?: ObjectId
  category: NotificationCategory
  level?: NotificationLevel
  title: string
  message: string
  actionUrl?: string
  dedupeKey?: string
  expiresAt?: Date
}): Promise<AppNotification | null> {
  const { notifications } = await getNotificationCollections()
  const preferences = await getNotificationPreferences(input.recipientId)
  if (preferences.mutedCategories.includes(input.category)) return null

  const now = new Date()
  const notification: NotificationDoc = {
    _id: new ObjectId(),
    recipientId: input.recipientId,
    actorId: input.actorId,
    category: input.category,
    level: input.level ?? 'info',
    title: input.title.trim().slice(0, 160),
    message: input.message.trim().slice(0, 1_000),
    actionUrl: safeActionUrl(input.actionUrl),
    dedupeKey: input.dedupeKey?.trim().slice(0, 200),
    createdAt: now,
    expiresAt:
      input.expiresAt ?? new Date(now.getTime() + 180 * 24 * 60 * 60 * 1_000),
  }

  if (!notification.dedupeKey) {
    await notifications.insertOne(notification)
    return toAppNotification(notification)
  }

  const created = await notifications.findOneAndUpdate(
    { recipientId: input.recipientId, dedupeKey: notification.dedupeKey },
    { $setOnInsert: notification },
    { upsert: true, returnDocument: 'after' }
  )
  return created ? toAppNotification(created) : null
}

export async function createNotifications(
  notifications: Parameters<typeof createNotification>[0][]
): Promise<void> {
  const results = await Promise.allSettled(notifications.map(createNotification))
  const failures = results.filter((result) => result.status === 'rejected')
  if (failures.length > 0) {
    // Notification delivery must never roll back the action that produced it.
    // eslint-disable-next-line no-console
    console.error('notification delivery failed', failures[0])
  }
}

