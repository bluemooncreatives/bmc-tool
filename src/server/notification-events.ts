import type { ObjectId } from 'mongodb'
import { MODULE_DEFINITIONS, type ModuleKey } from '@/lib/permissions'
import { createNotifications } from './notifications'
import { getUsersCollection, type UserDoc } from './users'

function moduleNames(keys: ModuleKey[]): string {
  const names = MODULE_DEFINITIONS.filter((module) => keys.includes(module.key))
    .map((module) => module.title)
    .slice(0, 4)
  const remainder = Math.max(0, keys.length - names.length)
  return `${names.join(', ')}${remainder ? ` and ${remainder} more` : ''}`
}

async function systemOwner(): Promise<UserDoc | null> {
  const users = await getUsersCollection()
  return users.findOne({ isSystemOwner: true, role: 'superadmin' })
}

async function safelyPublish(
  event: string,
  publish: () => Promise<void>
): Promise<void> {
  try {
    await publish()
  } catch (error) {
    // The primary action is already committed. Notification infrastructure is
    // deliberately best-effort and must never turn success into an API error.
    // eslint-disable-next-line no-console
    console.error(`${event} notification failed`, error)
  }
}

export function notifyAccountCreated(user: UserDoc): Promise<void> {
  return safelyPublish('account-created', async () => {
    const owner = await systemOwner()
    const notifications: Parameters<typeof createNotifications>[0] = [
      {
        recipientId: user._id,
        category: 'system',
        level: 'success',
        title: 'Welcome to Blue Moon Creatives',
        message:
          'Your account is ready. Your Super Admin will grant access to the workspace modules you need.',
        dedupeKey: `account-created:${user._id.toHexString()}`,
      },
    ]
    if (owner && !owner._id.equals(user._id)) {
      notifications.push({
        recipientId: owner._id,
        actorId: user._id,
        category: 'permissions',
        level: 'info',
        title: 'New user awaiting access',
        message: `${user.email} created an account and currently has no module access.`,
        actionUrl: '/permission-manager',
        dedupeKey: `new-user:${user._id.toHexString()}`,
      })
    }
    await createNotifications(notifications)
  })
}

export function notifySuccessfulSignIn(
  user: UserDoc,
  request: Request
): Promise<void> {
  return safelyPublish('sign-in', async () => {
    const tenMinuteBucket = Math.floor(Date.now() / (10 * 60 * 1_000))
    const userAgent = request.headers.get('user-agent')?.slice(0, 120)
    await createNotifications([
      {
        recipientId: user._id,
        actorId: user._id,
        category: 'security',
        level: 'info',
        title: 'New sign-in to your account',
        message: userAgent
          ? `Your account was signed in from ${userAgent}. If this was not you, reset your password immediately.`
          : 'Your account was signed in. If this was not you, reset your password immediately.',
        dedupeKey: `sign-in:${user._id.toHexString()}:${tenMinuteBucket}`,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1_000),
      },
    ])
  })
}

export function notifyAccountLocked(
  user: UserDoc,
  lockedUntil: Date
): Promise<void> {
  return safelyPublish('account-locked', async () => {
    await createNotifications([
      {
        recipientId: user._id,
        category: 'security',
        level: 'error',
        title: 'Account temporarily locked',
        message:
          'Repeated unsuccessful sign-in attempts temporarily locked your account. Reset your password if these attempts were not yours.',
        dedupeKey: `account-locked:${user._id.toHexString()}:${lockedUntil.getTime()}`,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1_000),
      },
    ])
  })
}

export function notifyPasswordChanged(userId: ObjectId): Promise<void> {
  return safelyPublish('password-changed', async () => {
    await createNotifications([
      {
        recipientId: userId,
        actorId: userId,
        category: 'security',
        level: 'success',
        title: 'Password changed',
        message:
          'Your password was changed and existing sessions were revoked. Contact the Super Admin immediately if you did not do this.',
        dedupeKey: `password-changed:${userId.toHexString()}:${Date.now()}`,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1_000),
      },
    ])
  })
}

export function notifyPermissionsChanged(input: {
  actor: UserDoc
  target: UserDoc
  before: ModuleKey[]
  after: ModuleKey[]
  changedAt: Date
}): Promise<void> {
  return safelyPublish('permissions-changed', async () => {
    const added = input.after.filter((key) => !input.before.includes(key))
    const removed = input.before.filter((key) => !input.after.includes(key))
    const details = [
      added.length ? `Added: ${moduleNames(added)}.` : '',
      removed.length ? `Removed: ${moduleNames(removed)}.` : '',
    ]
      .filter(Boolean)
      .join(' ')
    const changeId = `${input.target._id.toHexString()}:${input.changedAt.getTime()}`

    await createNotifications([
      {
        recipientId: input.target._id,
        actorId: input.actor._id,
        category: 'permissions',
        level: removed.length ? 'warning' : 'success',
        title: 'Your module access changed',
        message: details || 'Your workspace module access was updated.',
        dedupeKey: `permission-target:${changeId}`,
      },
      {
        recipientId: input.actor._id,
        actorId: input.actor._id,
        category: 'permissions',
        level: 'success',
        title: 'Module access updated',
        message: `You updated module access for ${input.target.email}. ${details}`,
        actionUrl: '/permission-manager',
        dedupeKey: `permission-actor:${changeId}`,
      },
    ])
  })
}
