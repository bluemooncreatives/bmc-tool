import { type Filter, type ObjectId } from 'mongodb'
import { normalizeTaskStatus, TERMINAL_TASK_STATUS_KEYS } from '@/lib/tasks'
import { type TaskDoc } from './tasks'

/**
 * Pure query builders for the task collection.
 *
 * These live apart from `tasks.ts` so they can be imported — and tested —
 * without pulling in the MongoDB driver and the connection it opens.
 */

/** Equality against the stored key, so the status index can serve the query. */
export function activeTaskFilter(): Filter<TaskDoc> {
  return { statusKey: { $nin: [...TERMINAL_TASK_STATUS_KEYS] } }
}

/** The fields that must move together whenever a status is written. */
export function statusFields(
  status: string
): Pick<TaskDoc, 'status' | 'statusKey'> {
  return { status, statusKey: normalizeTaskStatus(status) }
}

/**
 * Every task query starts here. Task numbers are only unique inside an
 * organization, so the tenant is part of the identity of a task, not a filter
 * bolted on afterwards. Soft-deleted tasks are excluded everywhere.
 */
export function organizationTaskFilter(
  organizationId: ObjectId,
  scope?: 'active' | null
): Filter<TaskDoc> {
  return {
    organizationId,
    deletedAt: null,
    ...(scope === 'active' ? activeTaskFilter() : {}),
  }
}
