import { ObjectId } from 'mongodb'
import { type UpdateFields } from '@/server/mongo-types'
import { NextResponse } from 'next/server'
import { isSuperadmin } from '@/lib/permissions'
import { recordAdminAudit } from '@/server/admin-audit'
import { updateDepartmentSchema } from '@/server/admin-schemas'
import {
  badRequest,
  conflict,
  errorResponse,
  notFound,
} from '@/server/api-errors'
import { parseJsonBody } from '@/server/auth-schemas'
import {
  assertSameOrigin,
  requireAccountAdmin,
} from '@/server/authorization'
import {
  getDepartmentsCollection,
  toPublicDepartment,
  wouldCreateDepartmentCycle,
  type DepartmentDoc,
} from '@/server/directory'
import { getUsersCollection } from '@/server/users'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

async function loadDepartment(
  id: string,
  actorOrganizationId: ObjectId | null
): Promise<DepartmentDoc | null> {
  if (!ObjectId.isValid(id)) return null
  const departments = await getDepartmentsCollection()
  const department = await departments.findOne({ _id: new ObjectId(id) })
  if (!department) return null
  if (
    actorOrganizationId &&
    !department.organizationId.equals(actorOrganizationId)
  ) {
    return null
  }
  return department
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const body = await parseJsonBody(request, updateDepartmentSchema)
  if (!body.ok) return badRequest(body.error)

  try {
    assertSameOrigin(request)
    const actor = await requireAccountAdmin('account_control')
    const { id } = await params
    const department = await loadDepartment(
      id,
      isSuperadmin(actor) ? null : actor.organizationId
    )
    if (!department) return notFound('That department does not exist.')

    const changes: UpdateFields<DepartmentDoc> = {}
    const unset: Record<string, ''> = {}

    if (body.data.name) changes.name = body.data.name
    if (body.data.code !== undefined) changes.code = body.data.code
    if (body.data.description !== undefined) {
      changes.description = body.data.description
    }

    if (body.data.parentDepartmentId !== undefined) {
      if (!body.data.parentDepartmentId) {
        unset.parentDepartmentId = ''
      } else {
        if (!ObjectId.isValid(body.data.parentDepartmentId)) {
          return notFound('The parent department does not exist.')
        }
        const candidateParentId = new ObjectId(body.data.parentDepartmentId)
        const cycle = await wouldCreateDepartmentCycle({
          organizationId: department.organizationId,
          departmentId: department._id,
          candidateParentId,
        })
        if (cycle) {
          return conflict(
            'That parent would create a loop in the department hierarchy.'
          )
        }
        changes.parentDepartmentId = candidateParentId
      }
    }

    if (body.data.headUserId !== undefined) {
      if (!body.data.headUserId) {
        unset.headUserId = ''
      } else {
        const users = await getUsersCollection()
        const head =
          ObjectId.isValid(body.data.headUserId) &&
          (await users.findOne({
            _id: new ObjectId(body.data.headUserId),
            organizationId: department.organizationId,
          }))
        if (!head) {
          return notFound(
            'The chosen department head is not in this organization.'
          )
        }
        changes.headUserId = head._id
      }
    }

    if (Object.keys(changes).length === 0 && Object.keys(unset).length === 0) {
      return NextResponse.json({ department: toPublicDepartment(department) })
    }

    const departments = await getDepartmentsCollection()
    const updated = await departments.findOneAndUpdate(
      { _id: department._id },
      {
        $set: { ...changes, updatedAt: new Date() },
        ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
      },
      { returnDocument: 'after' }
    )
    if (!updated) return notFound('That department does not exist.')

    // The department name is denormalized onto every member for listings.
    if (changes.name) {
      const users = await getUsersCollection()
      await users.updateMany(
        { departmentId: department._id },
        { $set: { departmentName: updated.name } }
      )
    }

    await recordAdminAudit({
      action: 'department.update',
      actor,
      organizationId: department.organizationId,
      summary: `Updated the ${updated.name} department.`,
      request,
    })

    return NextResponse.json({ department: toPublicDepartment(updated) })
  } catch (error) {
    return errorResponse(error, 'department update')
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    assertSameOrigin(request)
    const actor = await requireAccountAdmin('account_control')
    const { id } = await params
    const department = await loadDepartment(
      id,
      isSuperadmin(actor) ? null : actor.organizationId
    )
    if (!department) return notFound('That department does not exist.')

    const departments = await getDepartmentsCollection()
    const users = await getUsersCollection()

    // Child departments move up to this department's own parent, and members
    // simply lose their department — neither is deleted along with it.
    await departments.updateMany(
      { parentDepartmentId: department._id },
      department.parentDepartmentId
        ? { $set: { parentDepartmentId: department.parentDepartmentId } }
        : { $unset: { parentDepartmentId: '' } }
    )
    const detached = await users.updateMany(
      { departmentId: department._id },
      { $unset: { departmentId: '', departmentName: '' } }
    )
    await departments.deleteOne({ _id: department._id })

    await recordAdminAudit({
      action: 'department.delete',
      actor,
      organizationId: department.organizationId,
      summary: `Deleted the ${department.name} department. ${detached.modifiedCount} account(s) no longer have a department.`,
      request,
    })

    return NextResponse.json({
      deleted: true,
      detachedAccounts: detached.modifiedCount,
    })
  } catch (error) {
    return errorResponse(error, 'department delete')
  }
}
