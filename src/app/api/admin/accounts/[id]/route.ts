import { ObjectId } from 'mongodb'
import { type UpdateFields } from '@/server/mongo-types'
import { NextResponse } from 'next/server'
import {
  isSuperadmin,
  sanitizeModuleActions,
  sanitizeModulePermissions,
} from '@/lib/permissions'
import { resolveAccess } from '@/server/access-control'
import {
  assertGrantableModules,
  assertNotLastActiveAdmin,
  resolvePlacement,
} from '@/server/account-admin'
import { recordAdminAudit } from '@/server/admin-audit'
import { updateAccountSchema } from '@/server/admin-schemas'
import {
  badRequest,
  errorResponse,
  notFound,
  staleRecord,
} from '@/server/api-errors'
import { parseJsonBody } from '@/server/auth-schemas'
import {
  assertCanManageAccount,
  assertSameOrigin,
  requireAccountAdmin,
} from '@/server/authorization'
import { notifyPermissionsChanged } from '@/server/notification-events'
import {
  findOrganizationById,
  getOrganizationsCollection,
} from '@/server/organizations'
import {
  getUsersCollection,
  toManagedAccount,
  type UserDoc,
} from '@/server/users'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

async function loadTarget(
  id: string,
  actor: UserDoc
): Promise<UserDoc | null> {
  if (!ObjectId.isValid(id)) return null
  const users = await getUsersCollection()
  const target = await users.findOne({ _id: new ObjectId(id) })
  if (!target) return null
  // A tenant administrator must not be able to probe ids outside their org.
  if (!isSuperadmin(actor) && !actor.organizationId.equals(target.organizationId)) {
    return null
  }
  return target
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const actor = await requireAccountAdmin('account_control')
    const { id } = await params
    const target = await loadTarget(id, actor)
    if (!target) return notFound('That account does not exist.')

    const users = await getUsersCollection()
    const [manager, directReports] = await Promise.all([
      target.managerId
        ? users.findOne({ _id: target.managerId })
        : Promise.resolve(null),
      users
        .find({ managerId: target._id })
        .project<{ _id: ObjectId; name?: string; email: string }>({
          name: 1,
          email: 1,
        })
        .limit(200)
        .toArray(),
    ])

    return NextResponse.json(
      {
        account: toManagedAccount(target),
        manager: manager
          ? { id: manager._id.toHexString(), name: manager.name ?? '', email: manager.email }
          : null,
        directReports: directReports.map((report) => ({
          id: report._id.toHexString(),
          name: report.name ?? '',
          email: report.email,
        })),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    return errorResponse(error, 'account read')
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const body = await parseJsonBody(request, updateAccountSchema)
  if (!body.ok) return badRequest(body.error)

  try {
    assertSameOrigin(request)
    const actor = await requireAccountAdmin('account_users')
    const { id } = await params
    const target = await loadTarget(id, actor)
    if (!target) return notFound('That account does not exist.')

    const input = body.data
    const changesSelf = actor._id.equals(target._id)

    // Editing your own profile fields is fine; changing your own authority is
    // how an administrator accidentally locks themselves out.
    assertCanManageAccount(actor, target, { allowSelf: true })
    if (changesSelf && (input.role || input.status)) {
      return NextResponse.json(
        { error: 'You cannot change your own role or status.' },
        { status: 403 }
      )
    }

    const organization = await findOrganizationById(target.organizationId)
    if (!organization) return notFound('That organization does not exist.')

    const changes: UpdateFields<UserDoc> = {}
    const unset: Record<string, ''> = {}
    const now = new Date()

    if (input.name && input.name !== target.name) {
      const [firstName = '', ...rest] = input.name.trim().split(/\s+/)
      changes.name = input.name.trim()
      changes.firstName = firstName
      changes.lastName = rest.join(' ')
    }

    for (const field of [
      'employeeId',
      'jobTitle',
      'phone',
      'location',
      'timezone',
      'adminNotes',
    ] as const) {
      if (input[field] !== undefined) changes[field] = input[field] as never
    }

    if (input.employmentType !== undefined) {
      if (input.employmentType === '') unset.employmentType = ''
      else changes.employmentType = input.employmentType
    }

    if (input.joinedAt !== undefined) {
      if (input.joinedAt === '') unset.joinedAt = ''
      else changes.joinedAt = new Date(input.joinedAt)
    }

    // --- Placement --------------------------------------------------------
    const placement = await resolvePlacement({
      organizationId: target.organizationId,
      designationId: input.designationId,
      departmentId: input.departmentId,
      managerId: input.managerId,
      accountId: target._id,
    })

    if (input.designationId !== undefined) {
      if (placement.designation) {
        changes.designationId = placement.designation._id
        changes.designationTitle = placement.designation.title
      } else {
        unset.designationId = ''
        unset.designationTitle = ''
      }
    }

    if (input.departmentId !== undefined) {
      if (placement.department) {
        changes.departmentId = placement.department._id
        changes.departmentName = placement.department.name
      } else {
        unset.departmentId = ''
        unset.departmentName = ''
      }
    }

    if (input.managerId !== undefined) {
      if (placement.manager) changes.managerId = placement.manager._id
      else unset.managerId = ''
    }

    // --- Role -------------------------------------------------------------
    let roleChanged = false
    if (input.role && !target.role.includes(input.role)) {
      if (target.role.includes('org_admin') && input.role !== 'org_admin') {
        await assertNotLastActiveAdmin({
          organizationId: target.organizationId,
          accountId: target._id,
          action: 'demote',
        })
      }
      changes.role = [input.role]
      roleChanged = true
    }

    // --- Status -----------------------------------------------------------
    let statusChanged = false
    if (input.status && input.status !== target.status) {
      if (
        target.role.includes('org_admin') &&
        target.status === 'active' &&
        input.status !== 'active'
      ) {
        await assertNotLastActiveAdmin({
          organizationId: target.organizationId,
          accountId: target._id,
          action: 'deactivate',
        })
      }
      changes.status = input.status
      statusChanged = true

      if (input.status === 'active') {
        changes.activatedAt = now
        unset.suspendedAt = ''
        unset.suspendedReason = ''
        unset.lockedUntil = ''
        changes.failedSignInAttempts = 0
      } else if (input.status === 'suspended') {
        changes.suspendedAt = now
        if (input.statusReason) changes.suspendedReason = input.statusReason
      } else if (input.status === 'inactive') {
        changes.deactivatedAt = now
      }
    }

    if (input.mfaEnabled !== undefined) {
      changes.mfaEnabled = organization.settings?.enforceMfa
        ? true
        : input.mfaEnabled
    }

    // --- Access -----------------------------------------------------------
    const beforeModules = sanitizeModulePermissions(target.modulePermissions)
    let accessTouched = false

    if (
      input.grantedModules !== undefined ||
      input.deniedModules !== undefined ||
      input.grantedModuleActions !== undefined ||
      input.designationId !== undefined ||
      roleChanged
    ) {
      accessTouched = true

      const grantedModules =
        input.grantedModules === undefined
          ? sanitizeModulePermissions(target.grantedModules)
          : assertGrantableModules({
              actor,
              organization,
              requested: input.grantedModules,
            })

      const deniedModules =
        input.deniedModules === undefined
          ? sanitizeModulePermissions(target.deniedModules)
          : sanitizeModulePermissions(input.deniedModules)

      const grantedModuleActions =
        input.grantedModuleActions === undefined
          ? sanitizeModuleActions(target.grantedModuleActions)
          : sanitizeModuleActions(input.grantedModuleActions)

      const designation =
        input.designationId === undefined
          ? target.designationId
            ? await resolvePlacement({
                organizationId: target.organizationId,
                designationId: target.designationId.toHexString(),
              }).then((result) => result.designation)
            : null
          : placement.designation

      const resolved = resolveAccess({
        role: (changes.role as string[] | undefined) ?? target.role,
        grantedModules,
        deniedModules,
        grantedModuleActions,
        designation,
        organization,
      })

      changes.grantedModules = grantedModules
      changes.deniedModules = deniedModules
      changes.grantedModuleActions = grantedModuleActions
      changes.modulePermissions = resolved.modulePermissions
      changes.moduleActions = resolved.moduleActions
    }

    if (Object.keys(changes).length === 0 && Object.keys(unset).length === 0) {
      return NextResponse.json({ account: toManagedAccount(target) })
    }

    // Any change to authority or account state must invalidate live sessions.
    const revokeSessions =
      roleChanged ||
      statusChanged ||
      (accessTouched &&
        (changes.modulePermissions as string[] | undefined)?.join(',') !==
          beforeModules.join(','))

    const users = await getUsersCollection()
    const updated = await users.findOneAndUpdate(
      { _id: target._id, updatedAt: new Date(input.expectedUpdatedAt) },
      {
        $set: { ...changes, updatedAt: now },
        ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
        ...(revokeSessions ? { $inc: { tokenVersion: 1 } } : {}),
      },
      { returnDocument: 'after' }
    )
    if (!updated) return staleRecord()

    await recordAdminAudit({
      action: roleChanged
        ? 'account.role'
        : statusChanged
          ? 'account.status'
          : accessTouched
            ? 'account.permissions'
            : 'account.update',
      actor,
      organizationId: target.organizationId,
      targetUserId: target._id,
      targetLabel: target.email,
      summary: `Updated ${target.email}${
        roleChanged ? ` role to ${input.role}` : ''
      }${statusChanged ? ` status to ${input.status}` : ''}.`,
      before: {
        role: target.role,
        status: target.status,
        modulePermissions: beforeModules,
      },
      after: {
        role: updated.role,
        status: updated.status,
        modulePermissions: updated.modulePermissions,
      },
      request,
    })

    if (
      accessTouched &&
      sanitizeModulePermissions(updated.modulePermissions).join(',') !==
        beforeModules.join(',')
    ) {
      await notifyPermissionsChanged({
        actor,
        target: updated,
        before: beforeModules,
        after: sanitizeModulePermissions(updated.modulePermissions),
        changedAt: now,
      })
    }

    return NextResponse.json({ account: toManagedAccount(updated) })
  } catch (error) {
    return errorResponse(error, 'account update')
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    assertSameOrigin(request)
    const actor = await requireAccountAdmin('account_control')
    const { id } = await params
    const target = await loadTarget(id, actor)
    if (!target) return notFound('That account does not exist.')

    assertCanManageAccount(actor, target)

    if (target.role.includes('org_admin')) {
      await assertNotLastActiveAdmin({
        organizationId: target.organizationId,
        accountId: target._id,
        action: 'delete',
      })
    }

    const users = await getUsersCollection()

    // Direct reports are re-pointed at the deleted account's own manager so the
    // org chart never sprouts a detached branch.
    const reassigned = await users.updateMany(
      { managerId: target._id },
      target.managerId
        ? { $set: { managerId: target.managerId, updatedAt: new Date() } }
        : { $unset: { managerId: '' }, $set: { updatedAt: new Date() } }
    )

    await users.deleteOne({ _id: target._id })

    // A deleted account must not stay listed as the organization's primary
    // administrator.
    const organizations = await getOrganizationsCollection()
    await organizations.updateOne(
      { primaryAdminId: target._id },
      { $unset: { primaryAdminId: '' }, $set: { updatedAt: new Date() } }
    )

    await recordAdminAudit({
      action: 'account.delete',
      actor,
      organizationId: target.organizationId,
      targetUserId: target._id,
      targetLabel: target.email,
      summary: `Deleted ${target.email} from ${target.organizationName}. ${reassigned.modifiedCount} direct report(s) were reassigned.`,
      before: { role: target.role, status: target.status },
      request,
    })

    return NextResponse.json({
      deleted: true,
      reassignedReports: reassigned.modifiedCount,
    })
  } catch (error) {
    return errorResponse(error, 'account delete')
  }
}
