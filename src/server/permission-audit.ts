import { type ObjectId } from 'mongodb'
import { type ModuleKey } from '@/lib/permissions'
import { applyAuditRetention } from './audit-retention'
import { getDb } from './mongodb'

type PermissionAuditDoc = {
  actorId: ObjectId
  targetUserId: ObjectId
  before: ModuleKey[]
  after: ModuleKey[]
  createdAt: Date
  userAgent?: string
}

let indexReady: Promise<unknown> | undefined

export async function recordPermissionAudit(input: PermissionAuditDoc) {
  const db = await getDb()
  const audit = db.collection<PermissionAuditDoc>('permission_audit_logs')
  if (!indexReady) {
    indexReady = Promise.all([
      audit.createIndex({ createdAt: -1 }),
      applyAuditRetention(audit),
    ]).catch((error) => {
      indexReady = undefined
      throw error
    })
  }
  await indexReady
  await audit.insertOne(input)
}
