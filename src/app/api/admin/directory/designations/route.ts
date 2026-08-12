import { ObjectId } from 'mongodb'
import { NextResponse } from 'next/server'
import { sanitizeModuleActions } from '@/lib/permissions'
import { assertGrantableModules } from '@/server/account-admin'
import { recordAdminAudit } from '@/server/admin-audit'
import { createDesignationSchema } from '@/server/admin-schemas'
import { badRequest, errorResponse, notFound } from '@/server/api-errors'
import { parseJsonBody } from '@/server/auth-schemas'
import {
  assertSameOrigin,
  requireAccountAdmin,
  resolveScopedOrganizationId,
} from '@/server/authorization'
import {
  findDepartment,
  getDesignationsCollection,
  toPublicDesignation,
  type DesignationDoc,
} from '@/server/directory'
import { findOrganizationById } from '@/server/organizations'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const body = await parseJsonBody(request, createDesignationSchema)
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

    if (body.data.departmentId) {
      if (
        !ObjectId.isValid(body.data.departmentId) ||
        !(await findDepartment(
          organizationId,
          new ObjectId(body.data.departmentId)
        ))
      ) {
        return notFound('That department does not exist.')
      }
    }

    // A designation is a template for future grants, so it is held to exactly
    // the same ceiling as a direct grant.
    const defaultModules = assertGrantableModules({
      actor,
      organization,
      requested: body.data.defaultModules ?? [],
    })

    const now = new Date()
    const designation: DesignationDoc = {
      _id: new ObjectId(),
      organizationId,
      title: body.data.title,
      ...(body.data.code ? { code: body.data.code } : {}),
      level: body.data.level,
      ...(body.data.departmentId
        ? { departmentId: new ObjectId(body.data.departmentId) }
        : {}),
      ...(body.data.description ? { description: body.data.description } : {}),
      defaultModules,
      ...(body.data.defaultModuleActions
        ? {
            defaultModuleActions: sanitizeModuleActions(
              body.data.defaultModuleActions
            ),
          }
        : {}),
      isDefault: Boolean(body.data.isDefault),
      createdBy: actor._id,
      createdAt: now,
      updatedAt: now,
    }

    const designations = await getDesignationsCollection()
    await designations.insertOne(designation)

    // Exactly one designation per organization can be the default.
    if (designation.isDefault) {
      await designations.updateMany(
        { organizationId, _id: { $ne: designation._id } },
        { $set: { isDefault: false } }
      )
    }

    await recordAdminAudit({
      action: 'designation.create',
      actor,
      organizationId,
      summary: `Created the ${designation.title} designation in ${organization.name}.`,
      after: { defaultModules },
      request,
    })

    return NextResponse.json(
      { designation: toPublicDesignation(designation, 0) },
      { status: 201 }
    )
  } catch (error) {
    return errorResponse(error, 'designation creation')
  }
}
