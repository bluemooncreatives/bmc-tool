import { type Collection, ObjectId } from 'mongodb'
import { createHash, randomBytes } from 'node:crypto'
import { sanitizeModulePermissions, type ModuleKey } from '@/lib/permissions'
import { getSuperadminEmail, getSuperadminPassword } from './env'
import { normalizeEmail, normalizeUsername } from './identity'
import { getDb } from './mongodb'
import { hashPassword } from './password'
import { sanitizeRoles, type Role, type UserStatus } from './roles'

export type UserDoc = {
  _id: ObjectId
  email: string
  /** Immutable canonical account identifier used by authentication. */
  username: string
  /** Lower-cased username used only for case-insensitive uniqueness. */
  usernameKey: string
  usernameChangedAt?: Date
  bio?: string
  urls?: string[]
  emails: UserEmail[]
  /** Public/contact email. Never replaces the canonical `email` field. */
  displayEmail: string
  /** Navigation modules the user chose to hide; absent means show defaults. */
  hiddenSidebarItems?: ModuleKey[]
  passwordHash: string
  role: Role[]
  status: UserStatus
  accountNo: string
  firstName?: string
  lastName?: string
  emailVerifiedAt?: Date
  mfaEnabled: boolean
  modulePermissions: ModuleKey[]
  isSystemOwner?: boolean
  failedSignInAttempts: number
  lockedUntil?: Date
  lastLoginAt?: Date
  /** Bumped to invalidate every token issued before the change. */
  tokenVersion: number
  createdAt: Date
  updatedAt: Date
}

export type UserEmail = {
  address: string
  addedAt: Date
  verifiedAt?: Date
}

/** The shape sent to the client. Never includes passwordHash. */
export type PublicUser = {
  id: string
  accountNo: string
  email: string
  username: string
  displayEmail: string
  hiddenSidebarItems: ModuleKey[]
  role: Role[]
  status: UserStatus
  firstName?: string
  lastName?: string
  mfaEnabled: boolean
  modulePermissions: ModuleKey[]
}

export function toPublicUser(user: UserDoc): PublicUser {
  return {
    id: user._id.toHexString(),
    accountNo: user.accountNo,
    email: user.email,
    username: user.username,
    displayEmail: user.displayEmail ?? user.email,
    hiddenSidebarItems: sanitizeModulePermissions(user.hiddenSidebarItems),
    role: sanitizeRoles(user.role),
    status: user.status ?? 'active',
    firstName: user.firstName,
    lastName: user.lastName,
    mfaEnabled: Boolean(user.mfaEnabled),
    modulePermissions: sanitizeModulePermissions(user.modulePermissions),
  }
}

export { normalizeEmail, normalizeUsername } from './identity'

/** "First Last", falling back to the email when no name is on file. */
export function getUserDisplayName(user: UserDoc): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  return name || user.username || user.email
}

function legacyUsername(user: Pick<UserDoc, '_id' | 'email'>): string {
  const base = user.email
    .split('@')[0]
    ?.toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '')
  const suffix = user._id.toHexString().slice(-6)
  const prefix = (base || 'user').slice(0, 30 - suffix.length - 1)
  return `${prefix}-${suffix}`
}

let collectionReady: Promise<void> | undefined

async function prepareUsersCollection(
  users: Collection<UserDoc>
): Promise<void> {
  await users.createIndex({ email: 1 }, { unique: true })

  const now = new Date()
  const email = normalizeEmail(getSuperadminEmail())

  // Backfill template-era accounts before enforcing the new unique indexes.
  // The ObjectId suffix makes generated usernames deterministic and collision
  // safe while still allowing the user to choose a friendlier name later.
  const legacyUsers = await users
    .find({
      $or: [
        { usernameKey: { $exists: false } },
        { emails: { $exists: false } },
        { displayEmail: { $exists: false } },
      ],
    })
    .toArray()
  for (const user of legacyUsers) {
    const username = user.username?.trim() || legacyUsername(user)
    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          username,
          usernameKey: normalizeUsername(username),
          emails:
            user.emails?.length > 0
              ? user.emails
              : [
                  {
                    address: user.email,
                    addedAt: user.createdAt ?? now,
                    ...(user.emailVerifiedAt
                      ? { verifiedAt: user.emailVerifiedAt }
                      : {}),
                  },
                ],
          displayEmail: user.displayEmail ?? user.email,
        },
      }
    )
  }
  await Promise.all([
    users.createIndex({ usernameKey: 1 }, { unique: true }),
    users.createIndex({ 'emails.address': 1 }, { unique: true }),
  ])

  // Normalize documents from the dashboard template. Access remains
  // deny-by-default until the owner grants individual modules. The configured
  // owner address is the only document allowed to retain superadmin authority.
  await users.updateMany(
    { email: { $ne: email } },
    { $set: { role: ['user'], isSystemOwner: false } }
  )
  await users.updateMany(
    { modulePermissions: { $exists: false } },
    { $set: { modulePermissions: [] } }
  )
  await users.updateMany(
    { status: { $exists: false } },
    { $set: { status: 'active' } }
  )
  await users.updateMany(
    { mfaEnabled: { $exists: false } },
    { $set: { mfaEnabled: false } }
  )
  await users.updateMany(
    { failedSignInAttempts: { $exists: false } },
    { $set: { failedSignInAttempts: 0 } }
  )

  const configuredPassword = getSuperadminPassword()
  if (
    configuredPassword &&
    (configuredPassword.length < 8 ||
      configuredPassword.length > 128 ||
      !/[a-z]/.test(configuredPassword) ||
      !/[A-Z]/.test(configuredPassword) ||
      !/\d/.test(configuredPassword))
  ) {
    throw new Error(
      'SUPERADMIN_PASSWORD must be 8-128 characters and include uppercase, lowercase, and a number.'
    )
  }
  const bootstrapPassword =
    configuredPassword ?? randomBytes(32).toString('base64url')
  const ownerUsername = `bmc-owner-${createHash('sha256')
    .update(email)
    .digest('hex')
    .slice(0, 8)}`

  // setOnInsert makes the configured password a one-time bootstrap secret.
  // Changing the environment later cannot silently replace a real password.
  await users.updateOne(
    { email },
    {
      $setOnInsert: {
        _id: new ObjectId(),
        passwordHash: await hashPassword(bootstrapPassword),
        accountNo: 'BMC-SUPERADMIN',
        username: ownerUsername,
        usernameKey: normalizeUsername(ownerUsername),
        emails: [{ address: email, addedAt: now, verifiedAt: now }],
        displayEmail: email,
        firstName: 'Blue Moon',
        lastName: 'Creatives',
        tokenVersion: 0,
        failedSignInAttempts: 0,
        modulePermissions: [],
        createdAt: now,
      },
      $set: {
        email,
        role: ['superadmin'],
        status: 'active',
        mfaEnabled: true,
        isSystemOwner: true,
        updatedAt: now,
      },
    },
    { upsert: true }
  )
}

export async function getUsersCollection(): Promise<Collection<UserDoc>> {
  const db = await getDb()
  const users = db.collection<UserDoc>('users')

  // Index creation and owner seeding are idempotent and run once per process.
  if (!collectionReady) {
    collectionReady = prepareUsersCollection(users).catch((error) => {
      collectionReady = undefined
      throw error
    })
  }
  await collectionReady

  return users
}
