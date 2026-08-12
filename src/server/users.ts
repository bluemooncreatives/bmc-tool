import { type Collection, ObjectId } from 'mongodb'
import { createHash, randomBytes } from 'node:crypto'
import { type SupportedLanguage } from '@/lib/account-profile'
import { type EmploymentType } from '@/lib/organizations'
import {
  sanitizeModuleActions,
  sanitizeModulePermissions,
  type ModuleActionMap,
  type ModuleKey,
} from '@/lib/permissions'
import { getSuperadminEmail, getSuperadminPassword } from './env'
import { normalizeEmail, normalizeUsername } from './identity'
import { getDb } from './mongodb'
import { getInternalOrganization } from './organizations'
import { hashPassword } from './password'
import {
  sanitizeRoles,
  type AccountScope,
  type Role,
  type UserStatus,
} from './roles'

export type UserDoc = {
  _id: ObjectId
  email: string
  /** Immutable canonical account identifier used by authentication. */
  username: string
  /** Lower-cased username used only for case-insensitive uniqueness. */
  usernameKey: string
  usernameChangedAt?: Date
  name?: string
  dateOfBirth?: string
  language?: SupportedLanguage
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

  // --- Tenancy ------------------------------------------------------------
  /** Every account belongs to exactly one organization. */
  organizationId: ObjectId
  /** Denormalized so listings and emails do not need a join. */
  organizationCode: string
  organizationName: string
  /** `platform` accounts act across tenants; `organization` accounts do not. */
  scope: AccountScope

  // --- Position in the organization ---------------------------------------
  departmentId?: ObjectId
  departmentName?: string
  designationId?: ObjectId
  designationTitle?: string
  /** Reporting line. Drives the org chart; must stay inside the same tenant. */
  managerId?: ObjectId
  employeeId?: string
  employmentType?: EmploymentType
  jobTitle?: string
  phone?: string
  location?: string
  timezone?: string
  joinedAt?: Date

  // --- Access -------------------------------------------------------------
  /** Effective, fully resolved module access. This is what is enforced. */
  modulePermissions: ModuleKey[]
  /** Direct grants made by an administrator, before resolution. */
  grantedModules: ModuleKey[]
  /** Explicit removals that beat both grants and designation defaults. */
  deniedModules?: ModuleKey[]
  /** Effective per-module action refinement. */
  moduleActions?: ModuleActionMap
  /** Action overrides set directly on the account. */
  grantedModuleActions?: ModuleActionMap

  isSystemOwner?: boolean

  // --- Lifecycle ----------------------------------------------------------
  /** Set for provisioned accounts until the member picks their own password. */
  mustChangePassword?: boolean
  invitedBy?: ObjectId
  invitedAt?: Date
  activatedAt?: Date
  suspendedAt?: Date
  suspendedReason?: string
  deactivatedAt?: Date
  lastPasswordChangeAt?: Date
  /** Free-form administrative note, visible only in Account Control. */
  adminNotes?: string

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
  name?: string
  hiddenSidebarItems: ModuleKey[]
  role: Role[]
  status: UserStatus
  firstName?: string
  lastName?: string
  mfaEnabled: boolean
  modulePermissions: ModuleKey[]
  moduleActions: ModuleActionMap
  organizationId: string
  organizationCode: string
  organizationName: string
  scope: AccountScope
  designationTitle?: string
  departmentName?: string
  jobTitle?: string
  isSystemOwner: boolean
  mustChangePassword: boolean
}

export function toPublicUser(user: UserDoc): PublicUser {
  return {
    id: user._id.toHexString(),
    accountNo: user.accountNo,
    email: user.email,
    username: user.username,
    displayEmail: user.displayEmail ?? user.email,
    name:
      user.name ??
      ([user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
        undefined),
    hiddenSidebarItems: sanitizeModulePermissions(user.hiddenSidebarItems),
    role: sanitizeRoles(user.role),
    status: user.status ?? 'active',
    firstName: user.firstName,
    lastName: user.lastName,
    mfaEnabled: Boolean(user.mfaEnabled),
    modulePermissions: sanitizeModulePermissions(user.modulePermissions),
    moduleActions: sanitizeModuleActions(user.moduleActions),
    organizationId: user.organizationId?.toHexString() ?? '',
    organizationCode: user.organizationCode ?? '',
    organizationName: user.organizationName ?? '',
    scope: user.scope ?? 'organization',
    designationTitle: user.designationTitle,
    departmentName: user.departmentName,
    jobTitle: user.jobTitle,
    isSystemOwner: Boolean(user.isSystemOwner),
    mustChangePassword: Boolean(user.mustChangePassword),
  }
}

/**
 * The administrative view of an account. Richer than PublicUser because
 * Account Management needs the unresolved grants and the lifecycle timestamps,
 * and never leaves the Account Management endpoints.
 */
export type ManagedAccount = {
  id: string
  accountNo: string
  email: string
  username: string
  name: string
  role: Role
  status: UserStatus
  scope: AccountScope
  organizationId: string
  organizationCode: string
  organizationName: string
  departmentId: string | null
  departmentName: string
  designationId: string | null
  designationTitle: string
  managerId: string | null
  employeeId: string
  employmentType: EmploymentType | ''
  jobTitle: string
  phone: string
  location: string
  timezone: string
  joinedAt: string | null
  modulePermissions: ModuleKey[]
  grantedModules: ModuleKey[]
  deniedModules: ModuleKey[]
  moduleActions: ModuleActionMap
  grantedModuleActions: ModuleActionMap
  mfaEnabled: boolean
  isSystemOwner: boolean
  mustChangePassword: boolean
  adminNotes: string
  suspendedReason: string
  lastLoginAt: string | null
  invitedAt: string | null
  activatedAt: string | null
  suspendedAt: string | null
  createdAt: string
  updatedAt: string
}

export function toManagedAccount(user: UserDoc): ManagedAccount {
  return {
    id: user._id.toHexString(),
    accountNo: user.accountNo,
    email: user.email,
    username: user.username,
    name: getUserDisplayName(user),
    role: sanitizeRoles(user.role)[0] as Role,
    status: user.status ?? 'active',
    scope: user.scope ?? 'organization',
    organizationId: user.organizationId?.toHexString() ?? '',
    organizationCode: user.organizationCode ?? '',
    organizationName: user.organizationName ?? '',
    departmentId: user.departmentId?.toHexString() ?? null,
    departmentName: user.departmentName ?? '',
    designationId: user.designationId?.toHexString() ?? null,
    designationTitle: user.designationTitle ?? '',
    managerId: user.managerId?.toHexString() ?? null,
    employeeId: user.employeeId ?? '',
    employmentType: user.employmentType ?? '',
    jobTitle: user.jobTitle ?? '',
    phone: user.phone ?? '',
    location: user.location ?? '',
    timezone: user.timezone ?? '',
    joinedAt: user.joinedAt?.toISOString() ?? null,
    modulePermissions: sanitizeModulePermissions(user.modulePermissions),
    grantedModules: sanitizeModulePermissions(user.grantedModules),
    deniedModules: sanitizeModulePermissions(user.deniedModules),
    moduleActions: sanitizeModuleActions(user.moduleActions),
    grantedModuleActions: sanitizeModuleActions(user.grantedModuleActions),
    mfaEnabled: Boolean(user.mfaEnabled),
    isSystemOwner: Boolean(user.isSystemOwner),
    mustChangePassword: Boolean(user.mustChangePassword),
    adminNotes: user.adminNotes ?? '',
    suspendedReason: user.suspendedReason ?? '',
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    invitedAt: user.invitedAt?.toISOString() ?? null,
    activatedAt: user.activatedAt?.toISOString() ?? null,
    suspendedAt: user.suspendedAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }
}

export { normalizeEmail, normalizeUsername } from './identity'

/** "First Last", falling back to the email when no name is on file. */
export function getUserDisplayName(user: UserDoc): string {
  const name =
    user.name ??
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
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

/** Human account number, unique enough to be quoted in support requests. */
export function generateAccountNo(organizationCode: string): string {
  return `${organizationCode}-${randomBytes(4).toString('hex').toUpperCase()}`
}

let collectionReady: Promise<void> | undefined

async function prepareUsersCollection(
  users: Collection<UserDoc>
): Promise<void> {
  await users.createIndex({ email: 1 }, { unique: true })

  const now = new Date()
  const email = normalizeEmail(getSuperadminEmail())

  // The internal tenant must exist before any account can be attached to one.
  const internal = await getInternalOrganization()

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
    users.createIndex({ organizationId: 1, email: 1 }),
    users.createIndex({ organizationId: 1, status: 1 }),
    users.createIndex({ managerId: 1 }),
  ])

  // Only the configured owner address may hold platform authority. This is
  // scoped to documents that actually claim it, so organization administrators
  // created through Account Management are never demoted on boot.
  await users.updateMany(
    {
      email: { $ne: email },
      $or: [{ role: 'superadmin' }, { isSystemOwner: true }],
    },
    { $set: { role: ['user'], isSystemOwner: false, scope: 'organization' } }
  )

  // Accounts that predate multi-tenancy join the internal organization.
  await users.updateMany(
    { organizationId: { $exists: false } },
    {
      $set: {
        organizationId: internal._id,
        organizationCode: internal.code,
        organizationName: internal.name,
        scope: 'organization',
      },
    }
  )
  await users.updateMany(
    { organizationId: internal._id, organizationName: { $ne: internal.name } },
    { $set: { organizationName: internal.name } }
  )
  await users.updateMany(
    { modulePermissions: { $exists: false } },
    { $set: { modulePermissions: [] } }
  )
  // Direct grants seed from whatever effective access the account already had,
  // so resolution is a no-op for every pre-existing account.
  await users.updateMany({ grantedModules: { $exists: false } }, [
    { $set: { grantedModules: { $ifNull: ['$modulePermissions', []] } } },
  ])
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
        grantedModules: [],
        createdAt: now,
      },
      $set: {
        email,
        role: ['superadmin'],
        status: 'active',
        mfaEnabled: true,
        isSystemOwner: true,
        organizationId: internal._id,
        organizationCode: internal.code,
        organizationName: internal.name,
        scope: 'platform',
        jobTitle: 'Platform Owner',
        mustChangePassword: false,
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

export async function findUserById(
  id: ObjectId | string
): Promise<UserDoc | null> {
  const objectId =
    typeof id === 'string'
      ? ObjectId.isValid(id)
        ? new ObjectId(id)
        : null
      : id
  if (!objectId) return null
  const users = await getUsersCollection()
  return users.findOne({ _id: objectId })
}
