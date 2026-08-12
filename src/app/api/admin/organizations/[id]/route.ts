import { type UpdateFields } from '@/server/mongo-types'
import { NextResponse } from 'next/server'
import {
  isOrgAdmin,
  isSuperadmin,
  sanitizeModulePermissions,
  sanitizeOrganizationModules,
} from '@/lib/permissions'
import { recomputeOrganizationAccess } from '@/server/access-control'
import { recordAdminAudit } from '@/server/admin-audit'
import { updateOrganizationSchema } from '@/server/admin-schemas'
import {
  badRequest,
  conflict,
  errorResponse,
  notFound,
  staleRecord,
} from '@/server/api-errors'
import { parseJsonBody } from '@/server/auth-schemas'
import {
  assertSameOrigin,
  requireAuthenticatedUser,
  requireSuperadmin,
} from '@/server/authorization'
import { getOrganizationStats } from '@/server/organization-stats'
import {
  findOrganizationById,
  getOrganizationsCollection,
  parseOrganizationId,
  reserveOrganizationSlug,
  toPublicOrganization,
  type OrganizationDoc,
} from '@/server/organizations'
import { getUsersCollection } from '@/server/users'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

async function respondWithOrganization(organization: OrganizationDoc) {
  const stats = await getOrganizationStats([organization])
  return NextResponse.json({
    organization: toPublicOrganization(
      organization,
      stats.get(organization._id.toHexString())
    ),
  })
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const actor = await requireAuthenticatedUser()
    const { id } = await params
    const organizationId = parseOrganizationId(id)
    if (!organizationId) return notFound('That organization does not exist.')

    if (
      !isSuperadmin(actor) &&
      (!isOrgAdmin(actor) || !actor.organizationId.equals(organizationId))
    ) {
      return NextResponse.json(
        { error: 'You can only view your own organization.' },
        { status: 403 }
      )
    }

    const organization = await findOrganizationById(organizationId)
    if (!organization) return notFound('That organization does not exist.')

    return respondWithOrganization(organization)
  } catch (error) {
    return errorResponse(error, 'organization read')
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const body = await parseJsonBody(request, updateOrganizationSchema)
  if (!body.ok) return badRequest(body.error)

  try {
    assertSameOrigin(request)
    const actor = await requireSuperadmin()
    const { id } = await params
    const organizationId = parseOrganizationId(id)
    if (!organizationId) return notFound('That organization does not exist.')

    const organizations = await getOrganizationsCollection()
    const existing = await organizations.findOne({ _id: organizationId })
    if (!existing) return notFound('That organization does not exist.')

    const input = body.data
    const changes: UpdateFields<OrganizationDoc> = {}
    const warnings: string[] = []

    // The internal tenant is the platform's own home: renaming it is fine,
    // re-coding or retiring it would orphan the Super Admin.
    if (existing.isSystemOrg) {
      if (input.code && input.code !== existing.code) {
        return conflict(
          'The internal organization code cannot be changed.'
        )
      }
      if (input.status && input.status !== 'active') {
        return conflict(
          'The internal organization must stay active.'
        )
      }
    }

    if (input.code && input.code !== existing.code) {
      const duplicate = await organizations.findOne(
        { code: input.code, _id: { $ne: organizationId } },
        { projection: { _id: 1 } }
      )
      if (duplicate) {
        return conflict(`The organization code ${input.code} is already in use.`)
      }
      changes.code = input.code
    }

    if (input.name && input.name !== existing.name) {
      changes.name = input.name
      changes.slug = await reserveOrganizationSlug(input.name, organizationId)
    }

    for (const field of [
      'type',
      'industry',
      'contactPhone',
      'description',
      'website',
      'logoUrl',
      'contactEmail',
    ] as const) {
      const value = input[field]
      if (value !== undefined) {
        changes[field] = value as never
      }
    }

    if (input.size !== undefined) {
      changes.size = (input.size === '' ? undefined : input.size) as never
    }

    if (input.address) {
      changes.address = { ...existing.address, ...input.address }
    }

    if (input.billing) {
      // renewalAt arrives as an ISO string and is the only field that has to
      // be widened back into a Date before it is stored.
      const { renewalAt, ...billing } = input.billing
      changes.billing = {
        ...existing.billing,
        ...billing,
        plan: billing.plan ?? existing.billing?.plan ?? 'trial',
        ...(renewalAt ? { renewalAt: new Date(renewalAt) } : {}),
      }
    }

    if (input.settings) {
      changes.settings = { ...existing.settings, ...input.settings }
      const seatLimit = changes.settings.seatLimit
      if (seatLimit) {
        const users = await getUsersCollection()
        const used = await users.countDocuments({
          organizationId,
          status: { $in: ['active', 'invited', 'pending', 'suspended'] },
        })
        if (used > seatLimit) {
          warnings.push(
            `${used} accounts already exist, which is above the new seat limit of ${seatLimit}. Existing accounts keep working; new ones are blocked until seats free up.`
          )
        }
      }
    }

    let entitlementsChanged = false
    if (input.enabledModules) {
      const enabledModules = sanitizeOrganizationModules(input.enabledModules)
      entitlementsChanged =
        enabledModules.join(',') !==
        sanitizeOrganizationModules(existing.enabledModules).join(',')
      changes.enabledModules = enabledModules
    }

    if (input.defaultMemberModules) {
      const ceiling = new Set(
        sanitizeOrganizationModules(
          input.enabledModules ?? existing.enabledModules
        )
      )
      changes.defaultMemberModules = sanitizeModulePermissions(
        input.defaultMemberModules
      ).filter((module) => ceiling.has(module))
    }

    let statusChanged = false
    if (input.status && input.status !== existing.status) {
      statusChanged = true
      changes.status = input.status
      changes.archivedAt = (
        input.status === 'archived' ? new Date() : undefined
      ) as never
    }

    if (Object.keys(changes).length === 0) {
      return respondWithOrganization(existing)
    }

    const updated = await organizations.findOneAndUpdate(
      { _id: organizationId, updatedAt: new Date(input.expectedUpdatedAt) },
      { $set: { ...changes, updatedAt: new Date() } },
      { returnDocument: 'after' }
    )
    if (!updated) return staleRecord()

    const users = await getUsersCollection()

    // Denormalized tenant labels live on every account for cheap listings, so
    // a rename or re-code has to be pushed down immediately.
    if (changes.code || changes.name) {
      await users.updateMany(
        { organizationId },
        {
          $set: {
            ...(changes.code ? { organizationCode: updated.code } : {}),
            ...(changes.name ? { organizationName: updated.name } : {}),
          },
        }
      )
    }

    if (entitlementsChanged) {
      await recomputeOrganizationAccess(organizationId)
    }

    // Losing active status must not leave live sessions behind, so every token
    // issued to the tenant is invalidated at the same moment.
    if (statusChanged && updated.status !== 'active') {
      await users.updateMany({ organizationId }, { $inc: { tokenVersion: 1 } })
    }

    await recordAdminAudit({
      action: entitlementsChanged
        ? 'organization.entitlements'
        : statusChanged
          ? 'organization.status'
          : 'organization.update',
      actor,
      organizationId,
      summary: `Updated ${updated.name}${
        statusChanged ? ` status to ${updated.status}` : ''
      }.`,
      before: {
        status: existing.status,
        enabledModules: existing.enabledModules,
      },
      after: { status: updated.status, enabledModules: updated.enabledModules },
      request,
    })

    const stats = await getOrganizationStats([updated])
    return NextResponse.json({
      organization: toPublicOrganization(
        updated,
        stats.get(updated._id.toHexString())
      ),
      warnings,
    })
  } catch (error) {
    return errorResponse(error, 'organization update')
  }
}

/**
 * Archiving is the default because an organization owns accounts, tasks, and
 * an audit history. A permanent delete is only offered once the tenant is
 * genuinely empty.
 */
export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    assertSameOrigin(request)
    const actor = await requireSuperadmin()
    const { id } = await params
    const organizationId = parseOrganizationId(id)
    if (!organizationId) return notFound('That organization does not exist.')

    const organizations = await getOrganizationsCollection()
    const existing = await organizations.findOne({ _id: organizationId })
    if (!existing) return notFound('That organization does not exist.')

    if (existing.isSystemOrg) {
      return NextResponse.json(
        { error: 'The internal organization cannot be deleted.' },
        { status: 403 }
      )
    }

    const mode =
      new URL(request.url).searchParams.get('mode') === 'purge'
        ? 'purge'
        : 'archive'

    const users = await getUsersCollection()
    const memberCount = await users.countDocuments({ organizationId })

    if (mode === 'purge') {
      if (memberCount > 0) {
        return conflict(
          `${existing.name} still has ${memberCount} account${
            memberCount === 1 ? '' : 's'
          }. Move or delete them first, or archive the organization instead.`
        )
      }
      await organizations.deleteOne({ _id: organizationId })
      await recordAdminAudit({
        action: 'organization.delete',
        actor,
        organizationId,
        summary: `Permanently deleted the empty organization ${existing.name} (${existing.code}).`,
        before: { code: existing.code, name: existing.name },
        request,
      })
      return NextResponse.json({ deleted: true, mode })
    }

    const now = new Date()
    await organizations.updateOne(
      { _id: organizationId },
      { $set: { status: 'archived', archivedAt: now, updatedAt: now } }
    )
    // Archiving revokes access for everyone inside it, immediately.
    await users.updateMany(
      { organizationId },
      { $inc: { tokenVersion: 1 }, $set: { updatedAt: now } }
    )

    await recordAdminAudit({
      action: 'organization.archive',
      actor,
      organizationId,
      summary: `Archived ${existing.name} (${existing.code}) with ${memberCount} account${
        memberCount === 1 ? '' : 's'
      }.`,
      request,
    })

    return NextResponse.json({ deleted: true, mode, memberCount })
  } catch (error) {
    return errorResponse(error, 'organization delete')
  }
}
