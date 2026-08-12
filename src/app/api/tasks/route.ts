import { ObjectId } from 'mongodb'
import { NextResponse } from 'next/server'
import {
  assertSameOrigin,
  AuthorizationError,
  requireAnyModulePermission,
  requireModulePermission,
} from '@/server/authorization'
import { createTaskSchema } from '@/server/task-schemas'
import {
  activeTaskFilter,
  getTasksCollection,
  toPublicTask,
  type TaskDoc,
} from '@/server/tasks'
import { getUserDisplayName } from '@/server/users'
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
    if (scope === 'active') {
      await requireAnyModulePermission(['tasks', 'tasks_active'])
    } else {
      await requireModulePermission('tasks')
    }

    const tasks = await getTasksCollection()
    const results = await tasks
      .find(scope === 'active' ? activeTaskFilter() : {})
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
      taskNumber: parsed.data.id,
      title: parsed.data.title,
      description: parsed.data.description,
      status: parsed.data.status,
      label: parsed.data.label,
      priority: parsed.data.priority,
      taggedBy: getUserDisplayName(user),
      taggedTo: parsed.data.taggedTo,
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
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
      return NextResponse.json(
        { error: `A task numbered "${parsed.data.id}" already exists.` },
        { status: 409 }
      )
    }
    return errorResponse(error)
  }
}
