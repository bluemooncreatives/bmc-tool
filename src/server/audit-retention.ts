import { type Collection, type Document } from 'mongodb'
import { getAuditRetentionDays } from './env'

const TTL_INDEX_NAME = 'createdAt_ttl'

/**
 * Brings an audit collection's TTL index in line with `AUDIT_RETENTION_DAYS`.
 *
 * MongoDB will not change `expireAfterSeconds` through `createIndex`, so a
 * changed retention window means dropping the index and building it again.
 * Setting the variable back to 0 removes the index entirely, which stops the
 * deletions rather than merely slowing them.
 */
export async function applyAuditRetention<T extends Document>(
  collection: Collection<T>
): Promise<void> {
  const days = getAuditRetentionDays()
  const expireAfterSeconds = days * 24 * 60 * 60

  const existing = (await collection.indexes()).find(
    (index) => index.name === TTL_INDEX_NAME
  )

  if (days === 0) {
    if (existing) await collection.dropIndex(TTL_INDEX_NAME)
    return
  }

  if (existing) {
    if (existing.expireAfterSeconds === expireAfterSeconds) return
    await collection.dropIndex(TTL_INDEX_NAME)
  }

  await collection.createIndex(
    { createdAt: 1 },
    { name: TTL_INDEX_NAME, expireAfterSeconds }
  )
}
