import { ObjectId } from 'mongodb'
import { type UpdateFields } from '@/server/mongo-types'
import { NextResponse } from 'next/server'
import { isSuperadmin, sanitizeModuleActions } from '@/lib/permissions'
import {
  recomputeDesignationHolders,
  recomputeOrganizationAccess,
} from '@/server/access-control'
import { assertGrantableModules } from '@/server/account-admin'
import { recordAdminAudit } from '@/server/admin-audit'
import { updateDesignationSchema } from '@/server/admin-schemas'
import { badRequest, errorResponse, notFound } from '@/server/api-errors'
import { parseJsonBody } from '@/server/auth-schemas'
import { assertSameOrigin, requireAccountAdmin } from '@/server/authorization'
import {
  findDepartment,
  getDesignationsCollection,
  toPublicDesignation,
  type DesignationDoc,
} from '@/server/directory'
import { findOrganizationById } from '@/server/organizations'
import { getUsersCollection } from '@/server/users'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

async function loadDesignation(
  id: string,
  actorOrganizationId: ObjectId | null
): Promise<DesignationDoc | null> {
  if (!ObjectId.isValid(id)) return null
  const designations = await getDesignationsCollection()
  const designation = await designations.findOne({ _id: new ObjectId(id) })
  if (!designation) return null
  if (
    actorOrganizationId &&
    !designation.organizationId.equals(actorOrganizationId)
  ) {
    return null
  }
  return designation
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const body = await parseJsonBody(request, updateDesignationSchema)
  if (!body.ok) return badRequest(body.error)

  try {
    assertSameOrigin(request)
    const actor = await requireAccountAdmin('account_control')
    const { id } = await params
    const designation = await loadDesignation(
      id,
      isSuperadmin(actor) ? null : actor.organizationId
    )
    if (!designation) return notFound('That designation does not exist.')

    const organization = await findOrganizationById(designation.organizationId)
    if (!organization) return notFound('That organization does not exist.')

    const changes: UpdateFields<DesignationDoc> = {}
    const unset: Record<string, ''> = {}

    if (body.data.title) changes.title = body.data.title
    if (body.data.code !== undefined) changes.code = body.data.code
    if (body.data.level !== undefined) changes.level = body.data.level
    if (body.data.description !== undefined) {
      changes.description = body.data.description
    }

    if (body.data.departmentId !== undefined) {
      if (!body.data.departmentId) {
        unset.departmentId = ''
      } else {
        if (
          !ObjectId.isValid(body.data.departmentId) ||
          !(await findDepartment(
            designation.organizationId,
            new ObjectId(body.data.departmentId)
          ))
        ) {
          return notFound('That department does not exist.')
        }
        changes.departmentId = new ObjectId(body.data.departmentId)
      }
    }

    let templateChanged = false
    if (body.data.defaultModules !== undefined) {
      changes.defaultModules = assertGrantableModules({
        actor,
        organization,
        requested: body.data.defaultModules,
      })
      templateChanged = true
    }
    if (body.data.defaultModuleActions !== undefined) {
      changes.defaultModuleActions = sanitizeModuleActions(
        body.data.defaultModuleActions
      )
      templateChanged = true
    }
    if (body.data.isDefault !== undefined) {
      changes.isDefault = body.data.isDefault
    }

    if (Object.keys(changes).length === 0 && Object.keys(unset).length === 0) {
      return NextResponse.json({ designation: toPublicDesignation(designation) })
    }

    const designations = await getDesignationsCollection()
    const updated = await designations.findOneAndUpdate(
      { _id: designation._id },
      {
        $set: { ...changes, updatedAt: new Date() },
        ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
      },
      { returnDocument: 'after' }
    )
    if (!updated) return notFound('That designation does not exist.')

    if (updated.isDefault) {
      await designations.updateMany(
        {
          organizationId: designation.organizationId,
          _id: { $ne: designation._id },
        },
        { $set: { isDefault: false } }
      )
    }

    if (changes.title) {
      const users = await getUsersCollection()
      await users.updateMany(
        { designationId: designation._id },
        { $set: { designationTitle: updated.title } }
      )
    }

    // Everyone holding this designation inherits the new template right away.
    const affected = templateChanged
      ? await recomputeDesignationHolders(
          designation.organizationId,
          designation._id
        )
      : 0

    await recordAdminAudit({
      action: 'designation.update',
      actor,
      organizationId: designation.organizationId,
      summary: `Updated the ${updated.title} designation. ${affected} account(s) had their access recalculated.`,
      before: { defaultModules: designation.defaultModules },
      after: { defaultModules: updated.defaultModules },
      request,
    })

    return NextResponse.json({
      designation: toPublicDesignation(updated),
      recalculatedAccounts: affected,
    })
  } catch (error) {
    return errorResponse(error, 'designation update')
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    assertSameOrigin(request)
    const actor = await requireAccountAdmin('account_control')
    const { id } = await params
    const designation = await loadDesignation(
      id,
      isSuperadmin(actor) ? null : actor.organizationId
    )
    if (!designation) return notFound('That designation does not exist.')

    const designations = await getDesignationsCollection()
    const users = await getUsersCollection()

    // Holders keep their direct grants but lose the inherited template, so
    // their effective access has to be recalculated after the detach.
    const holders = await users
      .find({ designationId: designation._id })
      .project<{ _id: ObjectId }>({ _id: 1 })
      .toArray()

    await users.updateMany(
      { designationId: designation._id },
      { $unset: { designationId: '', designationTitle: '' } }
    )
    await designations.deleteOne({ _id: designation._id })

    if (holders.length > 0) {
      await recomputeOrganizationAccess(designation.organizationId)
    }

    await recordAdminAudit({
      action: 'designation.delete',
      actor,
      organizationId: designation.organizationId,
      summary: `Deleted the ${designation.title} designation. ${holders.length} account(s) lost its inherited access.`,
      request,
    })

    return NextResponse.json({
      deleted: true,
      affectedAccounts: holders.length,
    })
  } catch (error) {
    return errorResponse(error, 'designation delete')
  }
}
