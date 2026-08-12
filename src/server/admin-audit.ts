import { type Collection, ObjectId } from 'mongodb'
import { getDb } from './mongodb'
import { type UserDoc } from './users'

export const ADMIN_AUDIT_ACTIONS = [
  'organization.create',
  'organization.update',
  'organization.entitlements',
  'organization.status',
  'organization.archive',
  'organization.delete',
  'organization.admin_created',
  'account.create',
  'account.update',
  'account.role',
  'account.permissions',
  'account.status',
  'account.reporting_line',
  'account.password_reset',
  'account.force_signout',
  'account.invite_resent',
  'account.delete',
  'account.transfer',
  'designation.create',
  'designation.update',
  'designation.delete',
  'department.create',
  'department.update',
  'department.delete',
] as const

export type AdminAuditAction = (typeof ADMIN_AUDIT_ACTIONS)[number]

export type AdminAuditDoc = {
  _id: ObjectId
  action: AdminAuditAction
  actorId: ObjectId
  actorEmail: string
  organizationId?: ObjectId
  targetUserId?: ObjectId
  /** Human label captured at write time so deleted targets stay readable. */
  targetLabel?: string
  summary: string
  before?: unknown
  after?: unknown
  metadata?: Record<string, unknown>
  userAgent?: string
  createdAt: Date
}

export type PublicAdminAudit = {
  id: string
  action: AdminAuditAction
  actorEmail: string
  organizationId: string | null
  targetLabel: string
  summary: string
  createdAt: string
}

export function toPublicAdminAudit(entry: AdminAuditDoc): PublicAdminAudit {
  return {
    id: entry._id.toHexString(),
    action: entry.action,
    actorEmail: entry.actorEmail,
    organizationId: entry.organizationId?.toHexString() ?? null,
    targetLabel: entry.targetLabel ?? '',
    summary: entry.summary,
    createdAt: entry.createdAt.toISOString(),
  }
}

let indexesReady: Promise<void> | undefined

export async function getAdminAuditCollection(): Promise<
  Collection<AdminAuditDoc>
> {
  const db = await getDb()
  const audit = db.collection<AdminAuditDoc>('admin_audit_logs')

  if (!indexesReady) {
    indexesReady = Promise.all([
      audit.createIndex({ createdAt: -1 }),
      audit.createIndex({ organizationId: 1, createdAt: -1 }),
      audit.createIndex({ targetUserId: 1, createdAt: -1 }),
    ])
      .then(() => undefined)
      .catch((error) => {
        indexesReady = undefined
        throw error
      })
  }
  await indexesReady

  return audit
}

/**
 * Appends an administrative action to the immutable audit trail.
 *
 * Audit writes are best effort by design: the action they describe is already
 * committed, so a logging outage is reported to operators rather than turned
 * into a failed request the administrator would retry.
 */
export async function recordAdminAudit(input: {
  action: AdminAuditAction
  actor: Pick<UserDoc, '_id' | 'email'>
  organizationId?: ObjectId | null
  targetUserId?: ObjectId | null
  targetLabel?: string
  summary: string
  before?: unknown
  after?: unknown
  metadata?: Record<string, unknown>
  request?: Request
}): Promise<void> {
  try {
    const audit = await getAdminAuditCollection()
    await audit.insertOne({
      _id: new ObjectId(),
      action: input.action,
      actorId: input.actor._id,
      actorEmail: input.actor.email,
      ...(input.organizationId ? { organizationId: input.organizationId } : {}),
      ...(input.targetUserId ? { targetUserId: input.targetUserId } : {}),
      ...(input.targetLabel ? { targetLabel: input.targetLabel } : {}),
      summary: input.summary,
      ...(input.before === undefined ? {} : { before: input.before }),
      ...(input.after === undefined ? {} : { after: input.after }),
      ...(input.metadata ? { metadata: input.metadata } : {}),
      ...(input.request
        ? {
            userAgent:
              input.request.headers.get('user-agent')?.slice(0, 300) ??
              undefined,
          }
        : {}),
      createdAt: new Date(),
    })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('admin audit write failed', input.action, error)
  }
}
