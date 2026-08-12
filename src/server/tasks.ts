import { type Collection, type Filter, type ObjectId } from 'mongodb'
import { TERMINAL_TASK_STATUS_PATTERN } from '@/lib/tasks'
import { getDb } from './mongodb'
import { getInternalOrganization } from './organizations'

export type TaskDoc = {
  _id: ObjectId
  /** Tenant boundary. Every read and write is filtered by this. */
  organizationId: ObjectId
  taskNumber: string
  title: string
  description?: string
  status: string
  label: string
  priority: string
  /** Display name/email of the user who created the task. Set once, server-side. */
  taggedBy: string
  /** Display name/email of the assignee, if any. Client-editable. */
  taggedTo?: string
  createdBy: ObjectId
  createdAt: Date
  updatedAt: Date
}

/** The shape sent to the client. `id` is the human task number, not `_id`. */
export type PublicTask = {
  id: string
  title: string
  description: string
  status: string
  label: string
  priority: string
  taggedBy: string
  taggedTo: string
  createdAt: string
  updatedAt: string
}

export function toPublicTask(task: TaskDoc): PublicTask {
  return {
    id: task.taskNumber,
    title: task.title,
    description: task.description ?? '',
    status: task.status,
    label: task.label,
    priority: task.priority,
    taggedBy: task.taggedBy,
    taggedTo: task.taggedTo ?? '',
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  }
}

export function activeTaskFilter(): Filter<TaskDoc> {
  return { status: { $not: TERMINAL_TASK_STATUS_PATTERN } }
}

/**
 * Every task query starts here. Task numbers are only unique inside an
 * organization, so the tenant is part of the identity of a task, not a filter
 * bolted on afterwards.
 */
export function organizationTaskFilter(
  organizationId: ObjectId,
  scope?: 'active' | null
): Filter<TaskDoc> {
  return {
    organizationId,
    ...(scope === 'active' ? activeTaskFilter() : {}),
  }
}

let collectionReady: Promise<void> | undefined

async function prepareTasksCollection(
  tasks: Collection<TaskDoc>
): Promise<void> {
  // Tasks created before multi-tenancy belong to the internal workspace.
  const internal = await getInternalOrganization()
  await tasks.updateMany(
    { organizationId: { $exists: false } },
    { $set: { organizationId: internal._id } }
  )

  // The old global unique index on taskNumber would stop two organizations
  // from independently numbering their own work, so it is replaced with a
  // per-tenant one.
  const indexes = await tasks.indexes()
  const legacy = indexes.find(
    (index) => index.name === 'taskNumber_1' && index.unique
  )
  if (legacy) await tasks.dropIndex('taskNumber_1')

  await Promise.all([
    tasks.createIndex({ organizationId: 1, taskNumber: 1 }, { unique: true }),
    tasks.createIndex({ organizationId: 1, createdAt: -1 }),
  ])
}

export async function getTasksCollection(): Promise<Collection<TaskDoc>> {
  const db = await getDb()
  const tasks = db.collection<TaskDoc>('tasks')

  if (!collectionReady) {
    collectionReady = prepareTasksCollection(tasks).catch((error) => {
      collectionReady = undefined
      throw error
    })
  }
  await collectionReady

  return tasks
}
