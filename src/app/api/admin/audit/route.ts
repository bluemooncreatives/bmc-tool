import { ObjectId, type Filter } from 'mongodb'
import { NextResponse } from 'next/server'
import { isSuperadmin } from '@/lib/permissions'
import {
  getAdminAuditCollection,
  toPublicAdminAudit,
  type AdminAuditDoc,
} from '@/server/admin-audit'
import { errorResponse } from '@/server/api-errors'
import {
  requireAccountAdmin,
  resolveScopedOrganizationId,
} from '@/server/authorization'

export const runtime = 'nodejs'

/**
 * Administrative history. The Super Admin can read the whole platform; an
 * organization administrator only ever sees entries recorded against their own
 * tenant.
 */
export async function GET(request: Request) {
  try {
    const actor = await requireAccountAdmin('account_control')
    const params = new URL(request.url).searchParams
    const requestedOrg = params.get('organizationId')

    const filter: Filter<AdminAuditDoc> = {}
    if (isSuperadmin(actor)) {
      if (requestedOrg && requestedOrg !== 'all' && ObjectId.isValid(requestedOrg)) {
        filter.organizationId = new ObjectId(requestedOrg)
      }
    } else {
      filter.organizationId = resolveScopedOrganizationId(actor, requestedOrg)
    }

    const targetUserId = params.get('targetUserId')
    if (targetUserId && ObjectId.isValid(targetUserId)) {
      filter.targetUserId = new ObjectId(targetUserId)
    }

    const limit = Math.min(
      Math.max(Number(params.get('limit') ?? 100) || 100, 1),
      300
    )

    const audit = await getAdminAuditCollection()
    const entries = await audit
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()

    return NextResponse.json(
      { entries: entries.map(toPublicAdminAudit) },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    return errorResponse(error, 'audit listing')
  }
}
