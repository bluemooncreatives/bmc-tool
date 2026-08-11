import { type Collection, ObjectId } from 'mongodb'
import { randomBytes } from 'node:crypto'
import {
  sanitizeModulePermissions,
  type ModuleKey,
} from '@/lib/permissions'
import { getSuperadminEmail, getSuperadminPassword } from './env'
import { getDb } from './mongodb'
import { hashPassword } from './password'
import { sanitizeRoles, type Role, type UserStatus } from './roles'

export type UserDoc = {
  _id: ObjectId
  email: string
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

/** The shape sent to the client. Never includes passwordHash. */
export type PublicUser = {
  id: string
  accountNo: string
  email: string
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
    role: sanitizeRoles(user.role),
    status: user.status ?? 'active',
    firstName: user.firstName,
    lastName: user.lastName,
    mfaEnabled: Boolean(user.mfaEnabled),
    modulePermissions: sanitizeModulePermissions(user.modulePermissions),
  }
}

/** Emails are stored lower-cased so uniqueness is case-insensitive. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

let collectionReady: Promise<void> | undefined

async function prepareUsersCollection(
  users: Collection<UserDoc>
): Promise<void> {
  await users.createIndex({ email: 1 }, { unique: true })

  // Normalize documents from the dashboard template. Access remains
  // deny-by-default until the owner grants individual modules.
  await users.updateMany(
    { role: { $ne: 'superadmin' } },
    { $set: { role: ['user'] } }
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

  const now = new Date()
  const email = normalizeEmail(getSuperadminEmail())
  const bootstrapPassword =
    getSuperadminPassword() ?? randomBytes(32).toString('base64url')

  // setOnInsert makes the configured password a one-time bootstrap secret.
  // Changing the environment later cannot silently replace a real password.
  await users.updateOne(
    { email },
    {
      $setOnInsert: {
        _id: new ObjectId(),
        passwordHash: await hashPassword(bootstrapPassword),
        accountNo: 'BMC-SUPERADMIN',
        firstName: 'Blue Moon',
        lastName: 'Creatives',
        tokenVersion: 0,
        failedSignInAttempts: 0,
        modulePermissions: [],
        createdAt: now,
      },
      $set: {
        email,
        status: 'active',
        mfaEnabled: true,
        isSystemOwner: true,
        updatedAt: now,
      },
      $addToSet: { role: 'superadmin' },
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
