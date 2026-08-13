import {
  assertSameOrigin,
  AuthorizationError,
  requireAnyModulePermission,
  requireModulePermission,
} from '@/server/authorization'
import { createTaskSchema } from '@/server/task-schemas'
import {
  getTasksCollection,
  nextTaskNumber,
  organizationTaskFilter,
  resolveAssignee,
  statusFields,
  toPublicTask,
  type TaskDoc,
} from '@/server/tasks'
import { getUserDisplayName } from '@/server/users'
import { ObjectId } from 'mongodb'
import { NextResponse } from 'next/server'
import { hasModulePermission } from '@/lib/permissions'
import { isTaskActive } from '@/lib/tasks'

export const runtime = 'nodejs'

function errorResponse(error: unknown) {
  if (error instanceof AuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  // eslint-disable-next-line no-console
  console.error('tasks request failed', error)
  return NextResponse.json(
    { error: 'Could not process the task request. Please try again.' },
    { status: 500 }
  )
}

export async function GET(request: Request) {
  try {
    const scope = new URL(request.url).searchParams.get('scope')
    if (scope !== null && scope !== 'active') {
      return NextResponse.json(
        { error: 'The requested task scope is invalid.' },
        { status: 400 }
      )
    }
    const user =
      scope === 'active'
        ? await requireAnyModulePermission(['tasks', 'tasks_active'])
        : await requireModulePermission('tasks')

    const tasks = await getTasksCollection()
    const results = await tasks
      .find(organizationTaskFilter(user.organizationId, scope))
      .sort({ createdAt: -1 })
      .toArray()

    return NextResponse.json(
      { tasks: results.map(toPublicTask) },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null)
  const parsed = createTaskSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid task.' },
      { status: 400 }
    )
  }

  try {
    assertSameOrigin(request)
    const user = await requireAnyModulePermission(['tasks', 'tasks_active'])
    if (
      !hasModulePermission(user, 'tasks') &&
      !isTaskActive(parsed.data.status)
    ) {
      return NextResponse.json(
        { error: 'Active Tasks access can only create active work.' },
        { status: 403 }
      )
    }

    const tasks = await getTasksCollection()
    const now = new Date()
    const doc: TaskDoc = {
      _id: new ObjectId(),
      organizationId: user.organizationId,
      taskNumber: await nextTaskNumber(user.organizationId),
      title: parsed.data.title,
      description: parsed.data.description,
      ...statusFields(parsed.data.status),
      label: parsed.data.label,
      priority: parsed.data.priority,
      taggedBy: getUserDisplayName(user),
      ...(await resolveAssignee(user.organizationId, parsed.data.taggedTo)),
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }

    await tasks.insertOne(doc)

    return NextResponse.json({ task: toPublicTask(doc) }, { status: 201 })
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 11000
    ) {
      // Numbers come from the tenant's counter, so this means the counter fell
      // behind the collection rather than that the caller picked a taken one.
      return NextResponse.json(
        { error: 'Could not allocate a task number. Please try again.' },
        { status: 409 }
      )
    }
    return errorResponse(error)
  }
}
