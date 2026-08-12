import { NextResponse } from 'next/server'
import { errorResponse, notFound } from '@/server/api-errors'
import {
  requireAccountAdmin,
  resolveScopedOrganizationId,
} from '@/server/authorization'
import { buildOrgChart } from '@/server/org-chart'
import {
  findOrganizationById,
  toPublicOrganization,
} from '@/server/organizations'

export const runtime = 'nodejs'

/** The reporting tree for one organization, always resolved server-side. */
export async function GET(request: Request) {
  try {
    const actor = await requireAccountAdmin('account_control')
    const organizationId = resolveScopedOrganizationId(
      actor,
      new URL(request.url).searchParams.get('organizationId')
    )

    const organization = await findOrganizationById(organizationId)
    if (!organization) return notFound('That organization does not exist.')

    const chart = await buildOrgChart(organizationId)

    return NextResponse.json(
      { chart, organization: toPublicOrganization(organization) },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    return errorResponse(error, 'org chart')
  }
}
