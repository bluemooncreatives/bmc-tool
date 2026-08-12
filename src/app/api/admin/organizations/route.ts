import { ObjectId, type Filter } from 'mongodb'
import { NextResponse } from 'next/server'
import {
  DEFAULT_MEMBER_MODULES,
  DEFAULT_ORGANIZATION_MODULES,
  ORG_ADMIN_BASELINE_MODULES,
  sanitizeModulePermissions,
  sanitizeOrganizationModules,
  isOrgAdmin,
  isSuperadmin,
} from '@/lib/permissions'
import {
  ORGANIZATION_STATUSES,
  ORGANIZATION_TYPES,
  type OrganizationStatus,
  type OrganizationType,
} from '@/lib/organizations'
import { createManagedAccount } from '@/server/account-provisioning'
import { recordAdminAudit } from '@/server/admin-audit'
import { createOrganizationSchema } from '@/server/admin-schemas'
import { badRequest, conflict, errorResponse } from '@/server/api-errors'
import { parseJsonBody } from '@/server/auth-schemas'
import {
  assertSameOrigin,
  requireAuthenticatedUser,
  requireSuperadmin,
} from '@/server/authorization'
import { seedDefaultDesignations } from '@/server/directory'
import { getOrganizationStats } from '@/server/organization-stats'
import {
  defaultOrganizationSettings,
  getOrganizationsCollection,
  reserveOrganizationSlug,
  toPublicOrganization,
  type OrganizationDoc,
} from '@/server/organizations'

export const runtime = 'nodejs'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * The Super Admin sees every tenant. An organization administrator can read
 * only their own, because the Create User and Account Control screens need the
 * organization's entitlements to render.
 */
export async function GET(request: Request) {
  try {
    const actor = await requireAuthenticatedUser()
    if (!isSuperadmin(actor) && !isOrgAdmin(actor)) {
      return NextResponse.json(
        { error: 'Only an administrator can view organizations.' },
        { status: 403 }
      )
    }

    const params = new URL(request.url).searchParams
    const search = params.get('search')?.trim().slice(0, 100)
    const status = params.get('status')
    const type = params.get('type')
    const includeArchived = params.get('includeArchived') === 'true'

    const filter: Filter<OrganizationDoc> = isSuperadmin(actor)
      ? {}
      : { _id: actor.organizationId }

    if (status && (ORGANIZATION_STATUSES as readonly string[]).includes(status)) {
      filter.status = status as OrganizationStatus
    } else if (!includeArchived) {
      filter.status = { $ne: 'archived' }
    }

    if (type && (ORGANIZATION_TYPES as readonly string[]).includes(type)) {
      filter.type = type as OrganizationType
    }

    if (search) {
      const pattern = { $regex: escapeRegExp(search), $options: 'i' }
      filter.$or = [
        { name: pattern },
        { code: pattern },
        { contactEmail: pattern },
        { industry: pattern },
      ]
    }

    const organizations = await getOrganizationsCollection()
    const results = await organizations
      .find(filter)
      .sort({ isSystemOrg: -1, name: 1 })
      .limit(200)
      .toArray()

    const stats = await getOrganizationStats(results)

    return NextResponse.json(
      {
        organizations: results.map((organization) =>
          toPublicOrganization(
            organization,
            stats.get(organization._id.toHexString())
          )
        ),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    return errorResponse(error, 'organization listing')
  }
}

export async function POST(request: Request) {
  const body = await parseJsonBody(request, createOrganizationSchema)
  if (!body.ok) return badRequest(body.error)

  try {
    assertSameOrigin(request)
    const actor = await requireSuperadmin()
    const input = body.data

    const organizations = await getOrganizationsCollection()
    const duplicate = await organizations.findOne(
      { code: input.code },
      { projection: { _id: 1 } }
    )
    if (duplicate) {
      return conflict(`The organization code ${input.code} is already in use.`)
    }

    const now = new Date()
    const enabledModules = sanitizeOrganizationModules(
      input.enabledModules ?? DEFAULT_ORGANIZATION_MODULES
    )
    // Members can never default into a module the organization does not hold.
    const enabledSet = new Set(enabledModules)
    const defaultMemberModules = sanitizeModulePermissions(
      input.defaultMemberModules ?? DEFAULT_MEMBER_MODULES
    ).filter((module) => enabledSet.has(module))

    const organization: OrganizationDoc = {
      _id: new ObjectId(),
      code: input.code,
      name: input.name,
      slug: await reserveOrganizationSlug(input.name),
      type: input.type,
      status: input.status,
      ...(input.description ? { description: input.description } : {}),
      ...(input.industry ? { industry: input.industry } : {}),
      ...(input.size ? { size: input.size } : {}),
      ...(input.website ? { website: input.website } : {}),
      ...(input.logoUrl ? { logoUrl: input.logoUrl } : {}),
      ...(input.contactEmail ? { contactEmail: input.contactEmail } : {}),
      ...(input.contactPhone ? { contactPhone: input.contactPhone } : {}),
      ...(input.address ? { address: input.address } : {}),
      billing: {
        plan: input.billing?.plan ?? 'trial',
        ...(input.billing?.currency ? { currency: input.billing.currency } : {}),
        ...(input.billing?.renewalAt
          ? { renewalAt: new Date(input.billing.renewalAt) }
          : {}),
        ...(input.billing?.taxId ? { taxId: input.billing.taxId } : {}),
        ...(input.billing?.notes ? { notes: input.billing.notes } : {}),
      },
      enabledModules,
      defaultMemberModules,
      settings: { ...defaultOrganizationSettings(), ...input.settings },
      isSystemOrg: false,
      createdBy: actor._id,
      createdAt: now,
      updatedAt: now,
    }

    await organizations.insertOne(organization)
    await seedDefaultDesignations({
      organizationId: organization._id,
      enabledModules,
      createdBy: actor._id,
    })

    await recordAdminAudit({
      action: 'organization.create',
      actor,
      organizationId: organization._id,
      summary: `Created organization ${organization.name} (${organization.code}).`,
      after: { code: organization.code, type: organization.type },
      request,
    })

    // An administrator can be provisioned in the same request. A failure here
    // is reported alongside the created organization rather than rolling it
    // back, so the Super Admin can retry just the invite.
    let admin: {
      created: boolean
      email?: string
      temporaryPassword?: string
      emailDelivered?: boolean
      error?: string
    } = { created: false }

    if (input.admin) {
      try {
        const created = await createManagedAccount({
          actor,
          organization,
          email: input.admin.email,
          name: input.admin.name,
          role: 'org_admin',
          status: 'invited',
          grantedModules: sanitizeModulePermissions(
            ORG_ADMIN_BASELINE_MODULES
          ).filter((module) => enabledSet.has(module)),
          jobTitle: 'Organization Admin',
          sendInvite: input.admin.sendInvite,
          bypassDomainPolicy: true,
        })

        await organizations.updateOne(
          { _id: organization._id },
          { $set: { primaryAdminId: created.user._id, updatedAt: new Date() } }
        )
        organization.primaryAdminId = created.user._id

        await recordAdminAudit({
          action: 'organization.admin_created',
          actor,
          organizationId: organization._id,
          targetUserId: created.user._id,
          targetLabel: created.user.email,
          summary: `Created organization admin ${created.user.email} for ${organization.name}.`,
          request,
        })

        admin = {
          created: true,
          email: created.user.email,
          emailDelivered: created.emailDelivered,
          // Only revealed when the email could not be delivered.
          ...(created.emailDelivered
            ? {}
            : { temporaryPassword: created.temporaryPassword }),
        }
      } catch (adminError) {
        admin = {
          created: false,
          error:
            adminError instanceof Error
              ? adminError.message
              : 'Could not create the organization administrator.',
        }
      }
    }

    const stats = await getOrganizationStats([organization])

    return NextResponse.json(
      {
        organization: toPublicOrganization(
          organization,
          stats.get(organization._id.toHexString())
        ),
        admin,
      },
      { status: 201 }
    )
  } catch (error) {
    return errorResponse(error, 'organization creation')
  }
}
