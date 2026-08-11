import { type ObjectId } from 'mongodb'
import { type ModuleKey } from '@/lib/permissions'
import { getDb } from './mongodb'

type PermissionAuditDoc = {
  actorId: ObjectId
  targetUserId: ObjectId
  before: ModuleKey[]
  after: ModuleKey[]
  createdAt: Date
  userAgent?: string
}

let indexReady: Promise<string> | undefined

export async function recordPermissionAudit(input: PermissionAuditDoc) {
  const db = await getDb()
  const audit = db.collection<PermissionAuditDoc>('permission_audit_logs')
  if (!indexReady) {
    indexReady = audit.createIndex({ createdAt: -1 })
  }
  await indexReady
  await audit.insertOne(input)
}
