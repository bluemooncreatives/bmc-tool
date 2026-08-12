import { ObjectId, type Filter } from 'mongodb'
import { NextResponse } from 'next/server'
import { isSuperadmin, sanitizeModuleActions } from '@/lib/permissions'
import { isRole, isUserStatus } from '@/server/roles'
import {
  assertGrantableModules,
  resolvePlacement,
} from '@/server/account-admin'
import { createManagedAccount } from '@/server/account-provisioning'
import { recordAdminAudit } from '@/server/admin-audit'
import { createAccountSchema } from '@/server/admin-schemas'
import { badRequest, errorResponse, notFound } from '@/server/api-errors'
import { parseJsonBody } from '@/server/auth-schemas'
import {
  assertSameOrigin,
  requireAccountAdmin,
  resolveScopedOrganizationId,
} from '@/server/authorization'
import { findOrganizationById } from '@/server/organizations'
import {
  getUsersCollection,
  toManagedAccount,
  type UserDoc,
} from '@/server/users'

export const runtime = 'nodejs'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Account listing for Account Control, always scoped to one tenant or all. */
export async function GET(request: Request) {
  try {
    const actor = await requireAccountAdmin('account_control')
    const params = new URL(request.url).searchParams

    const requestedOrg = params.get('organizationId')
    const filter: Filter<UserDoc> = {}

    if (isSuperadmin(actor)) {
      // "all" is deliberately explicit; the default stays a single tenant so a
      // mis-typed request never dumps the whole platform.
      if (requestedOrg && requestedOrg !== 'all') {
        if (!ObjectId.isValid(requestedOrg)) {
          return notFound('That organization does not exist.')
        }
        filter.organizationId = new ObjectId(requestedOrg)
      }
    } else {
      filter.organizationId = resolveScopedOrganizationId(actor, requestedOrg)
    }

    const status = params.get('status')
    if (status && status !== 'all' && isUserStatus(status)) {
      filter.status = status
    }

    const role = params.get('role')
    if (role && role !== 'all' && isRole(role)) {
      filter.role = role
    }

    const designationId = params.get('designationId')
    if (designationId && ObjectId.isValid(designationId)) {
      filter.designationId = new ObjectId(designationId)
    }

    const departmentId = params.get('departmentId')
    if (departmentId && ObjectId.isValid(departmentId)) {
      filter.departmentId = new ObjectId(departmentId)
    }

    const search = params.get('search')?.trim().slice(0, 100)
    if (search) {
      const pattern = { $regex: escapeRegExp(search), $options: 'i' }
      filter.$or = [
        { email: pattern },
        { name: pattern },
        { username: pattern },
        { accountNo: pattern },
        { employeeId: pattern },
        { designationTitle: pattern },
      ]
    }

    const limit = Math.min(
      Math.max(Number(params.get('limit') ?? 200) || 200, 1),
      500
    )

    const users = await getUsersCollection()
    const [results, total] = await Promise.all([
      users
        .find(filter)
        .sort({ isSystemOwner: -1, role: 1, email: 1 })
        .limit(limit)
        .toArray(),
      users.countDocuments(filter),
    ])

    return NextResponse.json(
      { accounts: results.map(toManagedAccount), total },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    return errorResponse(error, 'account listing')
  }
}

export async function POST(request: Request) {
  const body = await parseJsonBody(request, createAccountSchema)
  if (!body.ok) return badRequest(body.error)

  try {
    assertSameOrigin(request)
    const actor = await requireAccountAdmin('account_users')
    const input = body.data

    const organizationId = resolveScopedOrganizationId(
      actor,
      input.organizationId
    )
    const organization = await findOrganizationById(organizationId)
    if (!organization) return notFound('That organization does not exist.')

    // Only the platform owner may mint another platform-scoped administrator,
    // and even then it happens through the internal organization.
    if (input.role === 'org_admin' && !isSuperadmin(actor)) {
      const canDelegate = actor.role.includes('org_admin')
      if (!canDelegate) {
        return NextResponse.json(
          { error: 'You cannot create an administrator account.' },
          { status: 403 }
        )
      }
    }

    const placement = await resolvePlacement({
      organizationId,
      designationId: input.designationId,
      departmentId: input.departmentId,
      managerId: input.managerId,
    })

    const grantedModules = assertGrantableModules({
      actor,
      organization,
      requested:
        input.grantedModules ??
        (placement.designation
          ? []
          : (organization.defaultMemberModules ?? [])),
    })

    const created = await createManagedAccount({
      actor,
      organization,
      email: input.email,
      name: input.name,
      username: input.username,
      role: input.role,
      status: input.status,
      designation: placement.designation,
      departmentId: placement.department?._id,
      departmentName: placement.department?.name,
      managerId: placement.manager?._id,
      employeeId: input.employeeId,
      employmentType: input.employmentType,
      jobTitle: input.jobTitle,
      phone: input.phone,
      location: input.location,
      timezone: input.timezone,
      joinedAt: input.joinedAt ? new Date(input.joinedAt) : undefined,
      grantedModules,
      grantedModuleActions: sanitizeModuleActions(input.grantedModuleActions),
      deniedModules: input.deniedModules,
      mfaEnabled: input.mfaEnabled,
      adminNotes: input.adminNotes,
      sendInvite: input.sendInvite,
      bypassDomainPolicy: true,
    })

    await recordAdminAudit({
      action: 'account.create',
      actor,
      organizationId,
      targetUserId: created.user._id,
      targetLabel: created.user.email,
      summary: `Created ${input.role === 'org_admin' ? 'organization admin' : 'member'} ${created.user.email} in ${organization.name}.`,
      after: {
        role: input.role,
        status: input.status,
        grantedModules,
        designation: placement.designation?.title,
      },
      request,
    })

    return NextResponse.json(
      {
        account: toManagedAccount(created.user),
        emailDelivered: created.emailDelivered,
        ...(created.emailDelivered
          ? {}
          : { temporaryPassword: created.temporaryPassword }),
      },
      { status: 201 }
    )
  } catch (error) {
    return errorResponse(error, 'account creation')
  }
}
