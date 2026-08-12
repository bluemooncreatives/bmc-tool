import { type ObjectId } from 'mongodb'
import { NextResponse } from 'next/server'
import { errorResponse, notFound } from '@/server/api-errors'
import {
  requireAccountAdmin,
  resolveScopedOrganizationId,
} from '@/server/authorization'
import {
  getDepartmentsCollection,
  getDesignationsCollection,
  toPublicDepartment,
  toPublicDesignation,
} from '@/server/directory'
import {
  findOrganizationById,
  toPublicOrganization,
} from '@/server/organizations'
import { getUsersCollection } from '@/server/users'

export const runtime = 'nodejs'

async function countBy(
  organizationId: ObjectId,
  field: 'departmentId' | 'designationId'
): Promise<Map<string, number>> {
  const users = await getUsersCollection()
  const rows = (await users
    .aggregate([
      { $match: { organizationId, [field]: { $exists: true } } },
      { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    ])
    .toArray()) as { _id: ObjectId; count: number }[]
  return new Map(rows.map((row) => [row._id.toHexString(), row.count]))
}

/**
 * Everything the Create User and Account Control forms need to describe one
 * organization: its departments, its designations, and the accounts that can
 * be picked as a manager.
 */
export async function GET(request: Request) {
  try {
    const actor = await requireAccountAdmin('account_users')
    const organizationId = resolveScopedOrganizationId(
      actor,
      new URL(request.url).searchParams.get('organizationId')
    )

    const organization = await findOrganizationById(organizationId)
    if (!organization) return notFound('That organization does not exist.')

    const [departments, designations, users] = await Promise.all([
      getDepartmentsCollection(),
      getDesignationsCollection(),
      getUsersCollection(),
    ])

    const [
      departmentDocs,
      designationDocs,
      managerDocs,
      departmentCounts,
      designationCounts,
    ] = await Promise.all([
      departments.find({ organizationId }).sort({ name: 1 }).toArray(),
      designations
        .find({ organizationId })
        .sort({ level: 1, title: 1 })
        .toArray(),
      users
        .find(
          { organizationId, status: { $in: ['active', 'invited'] } },
          {
            projection: {
              name: 1,
              email: 1,
              designationTitle: 1,
              role: 1,
            },
          }
        )
        .sort({ email: 1 })
        .limit(1_000)
        .toArray(),
      countBy(organizationId, 'departmentId'),
      countBy(organizationId, 'designationId'),
    ])

    return NextResponse.json(
      {
        organization: toPublicOrganization(organization),
        departments: departmentDocs.map((department) =>
          toPublicDepartment(
            department,
            departmentCounts.get(department._id.toHexString()) ?? 0
          )
        ),
        designations: designationDocs.map((designation) =>
          toPublicDesignation(
            designation,
            designationCounts.get(designation._id.toHexString()) ?? 0
          )
        ),
        managers: managerDocs.map((manager) => ({
          id: manager._id.toHexString(),
          name: manager.name ?? manager.email,
          email: manager.email,
          designationTitle: manager.designationTitle ?? '',
          isAdmin: manager.role?.includes('org_admin') ?? false,
        })),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    return errorResponse(error, 'directory listing')
  }
}
