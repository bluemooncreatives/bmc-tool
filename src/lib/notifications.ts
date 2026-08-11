import { MODULE_DEFINITIONS, type ModuleKey } from './permissions'

export const SYSTEM_NOTIFICATION_CATEGORIES = [
  {
    key: 'system',
    title: 'System',
    description: 'Workspace announcements, maintenance, and service health.',
  },
  {
    key: 'security',
    title: 'Security',
    description: 'Sign-ins, password changes, and account protection.',
  },
  {
    key: 'permissions',
    title: 'Permissions',
    description: 'Module access and role changes.',
  },
] as const

export const NOTIFICATION_CATEGORY_DEFINITIONS = [
  ...SYSTEM_NOTIFICATION_CATEGORIES,
  ...MODULE_DEFINITIONS.map((module) => ({
    key: module.key,
    title: module.title,
    description: module.description,
  })),
] as const

export type SystemNotificationCategory =
  (typeof SYSTEM_NOTIFICATION_CATEGORIES)[number]['key']
export type NotificationCategory =
  | SystemNotificationCategory
  | ModuleKey

export const NOTIFICATION_CATEGORIES = NOTIFICATION_CATEGORY_DEFINITIONS.map(
  (category) => category.key
) as [NotificationCategory, ...NotificationCategory[]]

export const REQUIRED_NOTIFICATION_CATEGORIES = [
  'system',
  'security',
] as const satisfies readonly NotificationCategory[]

export type NotificationLevel = 'info' | 'success' | 'warning' | 'error'

export type AppNotification = {
  id: string
  category: NotificationCategory
  level: NotificationLevel
  title: string
  message: string
  actionUrl?: string
  actorId?: string
  readAt?: string
  createdAt: string
}

export type NotificationPreferences = {
  mutedCategories: NotificationCategory[]
  updatedAt?: string
}

export type NotificationListResponse = {
  notifications: AppNotification[]
  unreadCount: number
  nextCursor: string | null
}

export function isNotificationCategory(
  value: unknown
): value is NotificationCategory {
  return (
    typeof value === 'string' &&
    (NOTIFICATION_CATEGORIES as readonly string[]).includes(value)
  )
}

export function sanitizeMutedCategories(value: unknown): NotificationCategory[] {
  if (!Array.isArray(value)) return []
  const required = new Set<NotificationCategory>(
    REQUIRED_NOTIFICATION_CATEGORIES
  )
  return [
    ...new Set(
      value.filter(
        (category): category is NotificationCategory =>
          isNotificationCategory(category) && !required.has(category)
      )
    ),
  ]
}

