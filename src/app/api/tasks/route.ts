import { ObjectId } from 'mongodb'
import { NextResponse } from 'next/server'
import {
  assertSameOrigin,
  AuthorizationError,
  requireModulePermission,
} from '@/server/authorization'
import { createTaskSchema } from '@/server/task-schemas'
import { getTasksCollection, toPublicTask, type TaskDoc } from '@/server/tasks'
import { getUserDisplayName } from '@/server/users'

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

export async function GET() {
  try {
    await requireModulePermission('tasks')

    const tasks = await getTasksCollection()
    const results = await tasks.find({}).sort({ createdAt: -1 }).toArray()

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
    const user = await requireModulePermission('tasks')

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
