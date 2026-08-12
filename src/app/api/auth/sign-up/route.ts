import { resolveAccess } from '@/server/access-control'
import {
  assertSeatAvailable,
  ProvisioningError,
} from '@/server/account-provisioning'
import { parseJsonBody, signUpSchema } from '@/server/auth-schemas'
import { getDesignationsCollection } from '@/server/directory'
import { notifyAccountCreated } from '@/server/notification-events'
import { createNotifications } from '@/server/notifications'
import { findOrganizationByCode } from '@/server/organizations'
import { hashPassword } from '@/server/password'
import { enforceRateLimit, RateLimitError } from '@/server/rate-limit'
import { startSession } from '@/server/session'
import {
  generateAccountNo,
  getUsersCollection,
  normalizeEmail,
  normalizeUsername,
  type UserDoc,
} from '@/server/users'
import { ObjectId } from 'mongodb'
import { NextResponse } from 'next/server'
import { acceptsPublicSignUp, isEmailDomainAllowed } from '@/lib/organizations'
import { sanitizeModulePermissions } from '@/lib/permissions'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const body = await parseJsonBody(request, signUpSchema)
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: 400 })
  }

  const email = normalizeEmail(body.data.email)

  try {
    await enforceRateLimit({
      request,
      action: 'sign-up',
      max: 10,
      windowSeconds: 60 * 60,
    })

    // --- Tenant resolution -------------------------------------------------
    const organization = await findOrganizationByCode(
      body.data.organizationCode
    )
    // A tenant that does not accept self sign-up is reported the same way as a
    // tenant that does not exist, so the endpoint is not an org-code oracle.
    if (
      !organization ||
      !acceptsPublicSignUp({
        code: organization.code,
        type: organization.type,
        status: organization.status,
        isSystemOrg: organization.isSystemOrg,
        allowSelfSignUp: organization.settings?.allowSelfSignUp,
      })
    ) {
      return NextResponse.json(
        {
          error:
            'That organization is not accepting sign-ups. Ask your administrator for an invitation.',
        },
        { status: 403 }
      )
    }

    if (
      !isEmailDomainAllowed(
        email,
        organization.settings.allowedEmailDomains ?? []
      )
    ) {
      return NextResponse.json(
        {
          error: `${organization.name} only accepts sign-ups from an approved email domain. Use your work email or ask your administrator for an invitation.`,
        },
        { status: 403 }
      )
    }

    await assertSeatAvailable(organization)

    // --- Starting access ---------------------------------------------------
    const designations = await getDesignationsCollection()
    const defaultDesignation = await designations.findOne({
      organizationId: organization._id,
      isDefault: true,
    })

    const grantedModules = sanitizeModulePermissions(
      organization.defaultMemberModules
    )
    const access = resolveAccess({
      role: ['user'],
      grantedModules,
      designation: defaultDesignation,
      organization,
    })

    // Organizations that vet their members hold the account until an admin
    // approves it; a pending account is never given a session.
    const requiresApproval =
      organization.settings.requireAdminApproval !== false
    const users = await getUsersCollection()
    const now = new Date()
    const user: UserDoc = {
      _id: new ObjectId(),
      email,
      username: body.data.username,
      usernameKey: normalizeUsername(body.data.username),
      usernameChangedAt: now,
      emails: [{ address: email, addedAt: now }],
      displayEmail: email,
      passwordHash: await hashPassword(body.data.password),
      role: ['user'],
      status: requiresApproval ? 'pending' : 'active',
      accountNo: generateAccountNo(organization.code),
      mfaEnabled: Boolean(organization.settings.enforceMfa),
      organizationId: organization._id,
      organizationCode: organization.code,
      organizationName: organization.name,
      scope: 'organization',
      ...(defaultDesignation
        ? {
            designationId: defaultDesignation._id,
            designationTitle: defaultDesignation.title,
          }
        : {}),
      modulePermissions: access.modulePermissions,
      moduleActions: access.moduleActions,
      grantedModules,
      joinedAt: now,
      ...(requiresApproval ? {} : { activatedAt: now }),
      failedSignInAttempts: 0,
      tokenVersion: 0,
      createdAt: now,
      updatedAt: now,
    }

    await users.insertOne(user)
    await notifyAccountCreated(user)
    await notifyOrganizationAdmins(user, requiresApproval)

    if (requiresApproval) {
      return NextResponse.json(
        {
          pendingApproval: true,
          message: `Your request to join ${organization.name} was sent. You can sign in once an administrator approves the account.`,
        },
        { status: 202 }
      )
    }

    return NextResponse.json(
      { user: await startSession(user) },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: error.message },
        {
          status: 429,
          headers: { 'Retry-After': String(error.retryAfter) },
        }
      )
    }
    if (error instanceof ProvisioningError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    }
    // 11000 is a unique email or username index rejecting a duplicate.
    if (
      error instanceof Error &&
      (error as Error & { code?: number }).code === 11000
    ) {
      const duplicateField = String(
        (error as Error & { keyPattern?: Record<string, number> }).keyPattern
          ? Object.keys(
              (error as Error & { keyPattern: Record<string, number> })
                .keyPattern
            )[0]
          : ''
      )
      return NextResponse.json(
        {
          error: duplicateField.includes('username')
            ? 'That username is already taken.'
            : 'An account with that email already exists.',
        },
        { status: 409 }
      )
    }

    // eslint-disable-next-line no-console
    console.error('sign-up failed', error)
    return NextResponse.json(
      { error: 'Could not create the account. Please try again.' },
      { status: 500 }
    )
  }
}

/** Tells the tenant's own administrators that someone is waiting on them. */
async function notifyOrganizationAdmins(
  user: UserDoc,
  requiresApproval: boolean
): Promise<void> {
  try {
    const users = await getUsersCollection()
    const admins = await users
      .find({
        organizationId: user.organizationId,
        role: 'org_admin',
        status: 'active',
      })
      .project<{ _id: ObjectId }>({ _id: 1 })
      .limit(25)
      .toArray()

    if (admins.length === 0) return

    await createNotifications(
      admins.map((admin) => ({
        recipientId: admin._id,
        actorId: user._id,
        category: 'permissions' as const,
        level: requiresApproval ? ('warning' as const) : ('info' as const),
        title: requiresApproval
          ? 'A new member is waiting for approval'
          : 'A new member joined your organization',
        message: `${user.email} signed up for ${user.organizationName}.`,
        actionUrl: '/account-management/account-control',
        dedupeKey: `org-signup:${user._id.toHexString()}:${admin._id.toHexString()}`,
      }))
    )
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('organization admin signup notification failed', error)
  }
}
