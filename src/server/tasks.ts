import { type Collection, type Filter, type ObjectId } from 'mongodb'
import { TERMINAL_TASK_STATUS_PATTERN } from '@/lib/tasks'
import { getDb } from './mongodb'

export type TaskDoc = {
  _id: ObjectId
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

let collectionReady: Promise<void> | undefined

async function prepareTasksCollection(
  tasks: Collection<TaskDoc>
): Promise<void> {
  await Promise.all([
    tasks.createIndex({ taskNumber: 1 }, { unique: true }),
    tasks.createIndex({ createdAt: -1 }),
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
