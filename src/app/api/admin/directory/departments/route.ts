import { ObjectId } from 'mongodb'
import { NextResponse } from 'next/server'
import { recordAdminAudit } from '@/server/admin-audit'
import { createDepartmentSchema } from '@/server/admin-schemas'
import { badRequest, errorResponse, notFound } from '@/server/api-errors'
import { parseJsonBody } from '@/server/auth-schemas'
import {
  assertSameOrigin,
  requireAccountAdmin,
  resolveScopedOrganizationId,
} from '@/server/authorization'
import {
  findDepartment,
  getDepartmentsCollection,
  toPublicDepartment,
  type DepartmentDoc,
} from '@/server/directory'
import { findOrganizationById } from '@/server/organizations'
import { getUsersCollection } from '@/server/users'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const body = await parseJsonBody(request, createDepartmentSchema)
  if (!body.ok) return badRequest(body.error)

  try {
    assertSameOrigin(request)
    const actor = await requireAccountAdmin('account_control')
    const organizationId = resolveScopedOrganizationId(
      actor,
      body.data.organizationId
    )

    const organization = await findOrganizationById(organizationId)
    if (!organization) return notFound('That organization does not exist.')

    // Both references must already live in this tenant.
    if (body.data.parentDepartmentId) {
      if (
        !ObjectId.isValid(body.data.parentDepartmentId) ||
        !(await findDepartment(
          organizationId,
          new ObjectId(body.data.parentDepartmentId)
        ))
      ) {
        return notFound('The parent department does not exist.')
      }
    }
    if (body.data.headUserId) {
      const users = await getUsersCollection()
      const head =
        ObjectId.isValid(body.data.headUserId) &&
        (await users.findOne({
          _id: new ObjectId(body.data.headUserId),
          organizationId,
        }))
      if (!head) {
        return notFound('The chosen department head is not in this organization.')
      }
    }

    const now = new Date()
    const department: DepartmentDoc = {
      _id: new ObjectId(),
      organizationId,
      name: body.data.name,
      ...(body.data.code ? { code: body.data.code } : {}),
      ...(body.data.description ? { description: body.data.description } : {}),
      ...(body.data.parentDepartmentId
        ? { parentDepartmentId: new ObjectId(body.data.parentDepartmentId) }
        : {}),
      ...(body.data.headUserId
        ? { headUserId: new ObjectId(body.data.headUserId) }
        : {}),
      createdBy: actor._id,
      createdAt: now,
      updatedAt: now,
    }

    const departments = await getDepartmentsCollection()
    await departments.insertOne(department)

    await recordAdminAudit({
      action: 'department.create',
      actor,
      organizationId,
      summary: `Created the ${department.name} department in ${organization.name}.`,
      request,
    })

    return NextResponse.json(
      { department: toPublicDepartment(department, 0) },
      { status: 201 }
    )
  } catch (error) {
    return errorResponse(error, 'department creation')
  }
}
