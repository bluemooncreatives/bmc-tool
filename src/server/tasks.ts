import { type Collection, type ObjectId } from 'mongodb'
import { normalizeTaskStatus } from '@/lib/tasks'
import { getDb } from './mongodb'
import { getInternalOrganization } from './organizations'
import { normalizeEmail } from './identity'
import { getUsersCollection } from './users'

export type TaskDoc = {
  _id: ObjectId
  /** Tenant boundary. Every read and write is filtered by this. */
  organizationId: ObjectId
  taskNumber: string
  title: string
  description?: string
  /** As entered, for display. */
  status: string
  /**
   * `status` normalized. Stored rather than derived at query time so that
   * "is this task still open" is an indexed equality test, and so the server
   * and the client agree on statuses that differ only in case or separators.
   */
  statusKey: string
  label: string
  priority: string
  /** Display name/email of the user who created the task. Set once, server-side. */
  taggedBy: string
  /** The assignee's email, as picked in the UI. Denormalized for display. */
  taggedTo?: string
  /**
   * The authoritative assignee reference. `taggedTo` is a copy of their email
   * kept for rendering; this is what survives the user changing their name and
   * what "tasks assigned to me" is queried by. Null when the task is
   * unassigned or when the entered address matches nobody in the tenant.
   */
  assigneeId: ObjectId | null
  createdBy: ObjectId
  createdAt: Date
  updatedAt: Date
  /**
   * Null while the task is live. Deleting sets a timestamp instead of removing
   * the document, so the record survives for audit; task numbers are never
   * reused because numbering is sequential.
   */
  deletedAt: Date | null
  deletedBy?: ObjectId
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

export {
  activeTaskFilter,
  organizationTaskFilter,
  statusFields,
} from './task-queries'

/**
 * Resolves the assignee an email refers to, scoped to the tenant so a task can
 * never be pointed at an account in another organization. An address that
 * matches nobody is kept as display text with a null reference rather than
 * rejected, which preserves the existing free-text behaviour of the field.
 */
export async function resolveAssignee(
  organizationId: ObjectId,
  taggedTo: string | undefined
): Promise<Pick<TaskDoc, 'taggedTo' | 'assigneeId'>> {
  const trimmed = taggedTo?.trim()
  if (!trimmed) return { taggedTo: undefined, assigneeId: null }

  const users = await getUsersCollection()
  const match = await users.findOne(
    { organizationId, email: normalizeEmail(trimmed) },
    { projection: { _id: 1 } }
  )

  return { taggedTo: trimmed, assigneeId: match?._id ?? null }
}

type CounterDoc = { _id: string; seq: number }

function taskCounterKey(organizationId: ObjectId): string {
  return `tasks:${organizationId.toHexString()}`
}

/** Trailing digits of `TASK-1234`, so seeding can continue past legacy numbers. */
function taskNumberSequence(taskNumber: string): number {
  const digits = /(\d+)\s*$/.exec(taskNumber)
  return digits ? Number(digits[1]) : 0
}

/**
 * Allocates the next task number for a tenant.
 *
 * Numbers used to be minted in the browser as `TASK-<4 random digits>`, which
 * collides with better-than-even odds once an organization has a few hundred
 * tasks — the birthday problem over 9000 values. A counter document makes the
 * allocation atomic and server-side, so numbers are sequential, unguessable
 * only in the sense that they are not needed to be, and never duplicated.
 */
export async function nextTaskNumber(organizationId: ObjectId): Promise<string> {
  const db = await getDb()
  const counters = db.collection<CounterDoc>('counters')
  const key = taskCounterKey(organizationId)

  // Seed past whatever the random era already used, so a fresh counter cannot
  // hand out a number that is taken. Racing requests both attempt the insert;
  // the loser's duplicate key is ignored and the $inc below settles the order.
  const existing = await counters.findOne({ _id: key }, { projection: { _id: 1 } })
  if (!existing) {
    const tasks = await getTasksCollection()
    const highest = await tasks
      .find({ organizationId }, { projection: { taskNumber: 1 } })
      .toArray()
    const seed = highest.reduce(
      (max, task) => Math.max(max, taskNumberSequence(task.taskNumber)),
      0
    )
    await counters
      .insertOne({ _id: key, seq: seed })
      .catch((error: { code?: number }) => {
        if (error?.code !== 11000) throw error
      })
  }

  const updated = await counters.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { returnDocument: 'after', upsert: true }
  )

  return `TASK-${updated?.seq ?? 1}`
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

  // Live tasks carry an explicit null rather than an absent field: equality
  // against null uses an index, whereas `$exists: false` cannot.
  await tasks.updateMany({ deletedAt: { $exists: false } }, {
    $set: { deletedAt: null },
  })

  // Backfill the assignee reference from the email already stored in
  // `taggedTo`. The assignee picker has always submitted an address, so this
  // resolves exactly and does not have to guess at display names.
  await backfillAssignees(tasks)

  // Tasks written before `statusKey` existed carry only display text. The
  // normalization is JavaScript, so it is applied per document; this runs once
  // and then matches nothing.
  const unkeyed = await tasks
    .find({ statusKey: { $exists: false } }, { projection: { status: 1 } })
    .toArray()
  for (const task of unkeyed) {
    await tasks.updateOne(
      { _id: task._id },
      { $set: { statusKey: normalizeTaskStatus(task.status ?? '') } }
    )
  }

  await Promise.all([
    tasks.createIndex({ organizationId: 1, taskNumber: 1 }, { unique: true }),
    tasks.createIndex({ organizationId: 1, deletedAt: 1, createdAt: -1 }),
    // Serves the Active Tasks list: tenant, liveness, and status narrow the
    // scan, and the trailing createdAt lets Mongo read the sort from the index.
    tasks.createIndex({
      organizationId: 1,
      deletedAt: 1,
      statusKey: 1,
      createdAt: -1,
    }),
    // "Tasks assigned to me", by reference rather than by display text.
    tasks.createIndex({ organizationId: 1, assigneeId: 1, createdAt: -1 }),
  ])

  // A backstop is not worth failing every task request over: applying it needs
  // the `collMod` privilege, which a least-privilege database user may not
  // hold. Log and carry on — Zod still validates at the API edge.
  await applyTaskValidator(tasks).catch((error) => {
    // eslint-disable-next-line no-console
    console.warn('tasks schema validator not applied', error)
  })
}

/** One-time resolution of `taggedTo` emails into `assigneeId` references. */
async function backfillAssignees(tasks: Collection<TaskDoc>): Promise<void> {
  const pending = await tasks
    .find(
      { assigneeId: { $exists: false } },
      { projection: { organizationId: 1, taggedTo: 1 } }
    )
    .toArray()
  if (pending.length === 0) return

  const users = await getUsersCollection()
  // One lookup per distinct address rather than per task.
  const resolved = new Map<string, ObjectId | null>()

  for (const task of pending) {
    const email = task.taggedTo?.trim()
    if (!email) {
      await tasks.updateOne({ _id: task._id }, { $set: { assigneeId: null } })
      continue
    }

    const cacheKey = `${task.organizationId.toHexString()}:${normalizeEmail(email)}`
    if (!resolved.has(cacheKey)) {
      const match = await users.findOne(
        { organizationId: task.organizationId, email: normalizeEmail(email) },
        { projection: { _id: 1 } }
      )
      resolved.set(cacheKey, match?._id ?? null)
    }

    await tasks.updateOne(
      { _id: task._id },
      { $set: { assigneeId: resolved.get(cacheKey) ?? null } }
    )
  }
}

/**
 * Collection-level schema validation — the closest MongoDB equivalent to
 * NOT NULL and typed columns. It is a backstop under the Zod checks at the API
 * edge, catching anything written by a script, a migration, or a future code
 * path that skips them.
 *
 * The status, label, and priority vocabularies are deliberately constrained by
 * shape rather than by enumeration: they are user-editable in the client, so
 * pinning them to a fixed list here would reject a custom option the moment
 * someone adds one.
 *
 * `validationLevel: 'moderate'` applies the rules to inserts and to updates of
 * already-valid documents, so a legacy row that predates a field is left alone
 * rather than becoming unwritable.
 */
async function applyTaskValidator(tasks: Collection<TaskDoc>): Promise<void> {
  const db = await getDb()
  await db.command({
    collMod: tasks.collectionName,
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: [
          'organizationId',
          'taskNumber',
          'title',
          'status',
          'statusKey',
          'label',
          'priority',
          'taggedBy',
          'createdBy',
          'createdAt',
          'updatedAt',
          'deletedAt',
        ],
        properties: {
          organizationId: { bsonType: 'objectId' },
          taskNumber: { bsonType: 'string', minLength: 1, maxLength: 40 },
          title: { bsonType: 'string', minLength: 1, maxLength: 200 },
          description: { bsonType: 'string', maxLength: 2000 },
          status: { bsonType: 'string', minLength: 1, maxLength: 60 },
          statusKey: { bsonType: 'string', minLength: 1, maxLength: 60 },
          label: { bsonType: 'string', minLength: 1, maxLength: 60 },
          priority: { bsonType: 'string', minLength: 1, maxLength: 60 },
          taggedBy: { bsonType: 'string' },
          taggedTo: { bsonType: 'string' },
          assigneeId: { bsonType: ['objectId', 'null'] },
          createdBy: { bsonType: 'objectId' },
          createdAt: { bsonType: 'date' },
          updatedAt: { bsonType: 'date' },
          deletedAt: { bsonType: ['date', 'null'] },
          deletedBy: { bsonType: 'objectId' },
        },
      },
    },
    validationLevel: 'moderate',
  })
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
