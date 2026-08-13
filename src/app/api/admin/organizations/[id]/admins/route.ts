import { NextResponse } from 'next/server'
import {
  ORG_ADMIN_BASELINE_MODULES,
  sanitizeModulePermissions,
  sanitizeOrganizationModules,
} from '@/lib/permissions'
import { createManagedAccount } from '@/server/account-provisioning'
import { recordAdminAudit } from '@/server/admin-audit'
import { createOrganizationAdminSchema } from '@/server/admin-schemas'
import { badRequest, errorResponse, notFound } from '@/server/api-errors'
import { parseJsonBody } from '@/server/auth-schemas'
import { assertSameOrigin, requireSuperadmin } from '@/server/authorization'
import {
  getOrganizationsCollection,
  parseOrganizationId,
} from '@/server/organizations'
import { toManagedAccount } from '@/server/users'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * Creates an organization administrator from an email address.
 *
 * The account is provisioned with a generated password and an invite email.
 * When SMTP is unavailable the password comes back in the response so the
 * Super Admin can pass it on — it is never stored in readable form.
 */
export async function POST(request: Request, { params }: RouteContext) {
  const body = await parseJsonBody(request, createOrganizationAdminSchema)
  if (!body.ok) return badRequest(body.error)

  try {
    assertSameOrigin(request)
    const actor = await requireSuperadmin()
    const { id } = await params
    const organizationId = parseOrganizationId(id)
    if (!organizationId) return notFound('That organization does not exist.')

    const organizations = await getOrganizationsCollection()
    const organization = await organizations.findOne({ _id: organizationId })
    if (!organization) return notFound('That organization does not exist.')

    const enabled = new Set(
      sanitizeOrganizationModules(organization.enabledModules)
    )
    const requested = body.data.grantedModules
      ? sanitizeModulePermissions(body.data.grantedModules)
      : sanitizeModulePermissions(ORG_ADMIN_BASELINE_MODULES)
    // An administrator can never be handed a module the tenant does not own.
    const grantedModules = requested.filter((module) => enabled.has(module))

    const created = await createManagedAccount({
      actor,
      organization,
      email: body.data.email,
      name: body.data.name,
      username: body.data.username,
      role: 'org_admin',
      status: 'invited',
      jobTitle: body.data.jobTitle || 'Organization Admin',
      phone: body.data.phone,
      grantedModules,
      sendInvite: body.data.sendInvite,
      // The administrator is created by the platform owner, so the tenant's own
      // domain allow-list does not apply to them.
      bypassDomainPolicy: true,
      request,
    })

    if (body.data.makePrimaryAdmin) {
      await organizations.updateOne(
        { _id: organizationId },
        { $set: { primaryAdminId: created.user._id, updatedAt: new Date() } }
      )
    }

    await recordAdminAudit({
      action: 'organization.admin_created',
      actor,
      organizationId,
      targetUserId: created.user._id,
      targetLabel: created.user.email,
      summary: `Created organization admin ${created.user.email} for ${organization.name}.`,
      after: { grantedModules },
      request,
    })

    return NextResponse.json(
      {
        account: toManagedAccount(created.user),
        emailDelivered: created.emailDelivered,
        // Revealed only when the invite could not be delivered.
        ...(created.emailDelivered
          ? {}
          : { temporaryPassword: created.temporaryPassword }),
      },
      { status: 201 }
    )
  } catch (error) {
    return errorResponse(error, 'organization admin creation')
  }
}
