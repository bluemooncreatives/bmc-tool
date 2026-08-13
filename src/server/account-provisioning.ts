import { ObjectId } from 'mongodb'
import { randomInt } from 'node:crypto'
import {
  isEmailDomainAllowed,
  isOrganizationUsable,
  type EmploymentType,
} from '@/lib/organizations'
import {
  type ModuleActionMap,
  type ModuleKey,
} from '@/lib/permissions'
import { resolveAccess } from './access-control'
import { type DesignationDoc } from './directory'
import { normalizeEmail, normalizeUsername } from './identity'
import { sendAccountInviteEmail } from './mailer'
import { createNotifications } from './notifications'
import { type OrganizationDoc } from './organizations'
import { hashPassword } from './password'
import { ROLE_LABELS, type Role, type UserStatus } from './roles'
import {
  generateAccountNo,
  getUsersCollection,
  type UserDoc,
} from './users'

export class ProvisioningError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 409 | 502
  ) {
    super(message)
    this.name = 'ProvisioningError'
  }
}

const LOWER = 'abcdefghijkmnopqrstuvwxyz'
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const DIGITS = '23456789'
const SYMBOLS = '!@#$%*?'

function pick(alphabet: string): string {
  return alphabet[randomInt(0, alphabet.length)] as string
}

/**
 * Builds a 16-character password that always satisfies the account password
 * policy. Ambiguous glyphs (0/O, 1/l/I) are excluded because these are read
 * out of an email and typed by hand.
 */
export function generateTemporaryPassword(): string {
  const all = LOWER + UPPER + DIGITS + SYMBOLS
  const characters = [
    pick(LOWER),
    pick(UPPER),
    pick(DIGITS),
    pick(SYMBOLS),
    ...Array.from({ length: 12 }, () => pick(all)),
  ]

  // Fisher-Yates with a CSPRNG so the guaranteed classes are not positional.
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swap = randomInt(0, index + 1)
    ;[characters[index], characters[swap]] = [
      characters[swap] as string,
      characters[index] as string,
    ]
  }

  return characters.join('')
}

function usernameCandidate(seed: string): string {
  const cleaned = seed
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '')
  return (cleaned || 'member').slice(0, 24)
}

/** Finds a free username near the requested one rather than failing outright. */
export async function reserveUsername(seed: string): Promise<string> {
  const users = await getUsersCollection()
  const base = usernameCandidate(seed)

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`
    const taken = await users.findOne(
      { usernameKey: normalizeUsername(candidate) },
      { projection: { _id: 1 } }
    )
    if (!taken) return candidate
  }

  return `${base}-${new ObjectId().toHexString().slice(-6)}`
}

/** Accounts that consume a seat. Deactivated accounts are excluded. */
export const SEAT_CONSUMING_STATUSES: readonly UserStatus[] = [
  'active',
  'invited',
  'pending',
  'suspended',
]

export async function assertSeatAvailable(
  organization: OrganizationDoc
): Promise<void> {
  const limit = organization.settings?.seatLimit
  if (!limit || limit <= 0) return

  const users = await getUsersCollection()
  const used = await users.countDocuments({
    organizationId: organization._id,
    status: { $in: SEAT_CONSUMING_STATUSES },
  })

  if (used >= limit) {
    throw new ProvisioningError(
      `${organization.name} has used all ${limit} of its seats. Raise the seat limit before adding another account.`,
      409
    )
  }
}

export type CreateAccountInput = {
  actor: Pick<UserDoc, '_id' | 'email'>
  organization: OrganizationDoc
  email: string
  name: string
  username?: string
  role: Role
  status?: UserStatus
  designation?: DesignationDoc | null
  departmentId?: ObjectId
  departmentName?: string
  managerId?: ObjectId
  employeeId?: string
  employmentType?: EmploymentType
  jobTitle?: string
  phone?: string
  location?: string
  timezone?: string
  joinedAt?: Date
  grantedModules?: readonly ModuleKey[]
  grantedModuleActions?: ModuleActionMap
  deniedModules?: readonly ModuleKey[]
  mfaEnabled?: boolean
  adminNotes?: string
  /** When false the caller takes responsibility for delivering credentials. */
  sendInvite?: boolean
  /** The request being handled, so the invite link points back to its origin. */
  request?: Request
  /** Skips the domain allow-list. Only administrators creating accounts do. */
  bypassDomainPolicy?: boolean
}

export type CreatedAccount = {
  user: UserDoc
  temporaryPassword: string
  /** False when SMTP is unconfigured; the caller must reveal the password. */
  emailDelivered: boolean
}

/**
 * The one place accounts are created by an administrator, shared by the
 * "create organization admin" and "create user" flows.
 *
 * The account is written first and the invite is sent afterwards: a mail
 * outage must not leave a half-created tenant, and the caller can still show
 * the generated password to whoever asked for the account.
 */
export async function createManagedAccount(
  input: CreateAccountInput
): Promise<CreatedAccount> {
  const organization = input.organization
  const email = normalizeEmail(input.email)

  if (!isOrganizationUsable(organization.status)) {
    throw new ProvisioningError(
      `${organization.name} is ${organization.status}. Reactivate it before adding accounts.`,
      409
    )
  }

  if (
    !input.bypassDomainPolicy &&
    !isEmailDomainAllowed(
      email,
      organization.settings?.allowedEmailDomains ?? []
    )
  ) {
    throw new ProvisioningError(
      `${email} is not on the allowed email domain list for ${organization.name}.`,
      400
    )
  }

  await assertSeatAvailable(organization)

  const users = await getUsersCollection()
  const existing = await users.findOne(
    { $or: [{ email }, { 'emails.address': email }] },
    { projection: { _id: 1, organizationName: 1 } }
  )
  if (existing) {
    throw new ProvisioningError(
      `An account already exists for ${email}${
        existing.organizationName ? ` in ${existing.organizationName}` : ''
      }. An email address can belong to only one organization.`,
      409
    )
  }

  const temporaryPassword = generateTemporaryPassword()
  const username = await reserveUsername(
    input.username?.trim() || email.split('@')[0] || input.name
  )
  const now = new Date()
  const status: UserStatus = input.status ?? 'invited'

  const access = resolveAccess({
    role: [input.role],
    grantedModules: input.grantedModules,
    deniedModules: input.deniedModules,
    grantedModuleActions: input.grantedModuleActions,
    designation: input.designation,
    organization,
  })

  const [firstName = '', ...restName] = input.name.trim().split(/\s+/)
  const user: UserDoc = {
    _id: new ObjectId(),
    email,
    username,
    usernameKey: normalizeUsername(username),
    usernameChangedAt: now,
    name: input.name.trim(),
    firstName: firstName || undefined,
    lastName: restName.join(' ') || undefined,
    emails: [{ address: email, addedAt: now }],
    displayEmail: email,
    passwordHash: await hashPassword(temporaryPassword),
    role: [input.role],
    status,
    accountNo: generateAccountNo(organization.code),
    mfaEnabled: input.mfaEnabled ?? organization.settings?.enforceMfa ?? false,

    organizationId: organization._id,
    organizationCode: organization.code,
    organizationName: organization.name,
    scope: 'organization',

    ...(input.departmentId ? { departmentId: input.departmentId } : {}),
    ...(input.departmentName ? { departmentName: input.departmentName } : {}),
    ...(input.designation
      ? {
          designationId: input.designation._id,
          designationTitle: input.designation.title,
        }
      : {}),
    ...(input.managerId ? { managerId: input.managerId } : {}),
    ...(input.employeeId ? { employeeId: input.employeeId } : {}),
    ...(input.employmentType ? { employmentType: input.employmentType } : {}),
    ...(input.jobTitle ? { jobTitle: input.jobTitle } : {}),
    ...(input.phone ? { phone: input.phone } : {}),
    ...(input.location ? { location: input.location } : {}),
    ...(input.timezone ? { timezone: input.timezone } : {}),
    joinedAt: input.joinedAt ?? now,

    modulePermissions: access.modulePermissions,
    moduleActions: access.moduleActions,
    grantedModules: [...(input.grantedModules ?? [])],
    ...(input.deniedModules?.length
      ? { deniedModules: [...input.deniedModules] }
      : {}),
    ...(input.grantedModuleActions
      ? { grantedModuleActions: input.grantedModuleActions }
      : {}),

    mustChangePassword: true,
    invitedBy: input.actor._id,
    invitedAt: now,
    ...(status === 'active' ? { activatedAt: now } : {}),
    ...(input.adminNotes ? { adminNotes: input.adminNotes } : {}),

    failedSignInAttempts: 0,
    tokenVersion: 0,
    createdAt: now,
    updatedAt: now,
  }

  try {
    await users.insertOne(user)
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      throw new ProvisioningError(
        'An account with that email or username already exists.',
        409
      )
    }
    throw error
  }

  let emailDelivered = false
  if (input.sendInvite !== false) {
    try {
      emailDelivered = await sendAccountInviteEmail({
        to: email,
        name: user.name ?? email,
        organizationName: organization.name,
        organizationCode: organization.code,
        temporaryPassword,
        roleLabel: ROLE_LABELS[input.role],
        invitedByEmail: input.actor.email,
        request: input.request,
      })
    } catch (error) {
      // The account exists; surface the delivery failure without rolling back
      // so the administrator can hand over the password another way.
      // eslint-disable-next-line no-console
      console.error('invite email failed', email, error)
      emailDelivered = false
    }
  }

  await notifyProvisionedAccount({
    user,
    actorId: input.actor._id,
    organizationName: organization.name,
  })

  return { user, temporaryPassword, emailDelivered }
}

async function notifyProvisionedAccount(input: {
  user: UserDoc
  actorId: ObjectId
  organizationName: string
}): Promise<void> {
  try {
    await createNotifications([
      {
        recipientId: input.user._id,
        actorId: input.actorId,
        category: 'system',
        level: 'success',
        title: `Welcome to ${input.organizationName}`,
        message:
          'Your account was created by an administrator. Set your own password from Profile settings the first time you sign in.',
        dedupeKey: `account-provisioned:${input.user._id.toHexString()}`,
      },
      {
        recipientId: input.actorId,
        actorId: input.actorId,
        category: 'permissions',
        level: 'info',
        title: 'Account created',
        message: `${input.user.email} was added to ${input.organizationName}.`,
        actionUrl: '/account-management/account-control',
        dedupeKey: `account-created-by:${input.user._id.toHexString()}`,
      },
    ])
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('provisioning notification failed', error)
  }
}
