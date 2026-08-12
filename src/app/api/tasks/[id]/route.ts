import { NextResponse } from 'next/server'
import {
  assertSameOrigin,
  AuthorizationError,
  requireModulePermission,
} from '@/server/authorization'
import { updateTaskSchema } from '@/server/task-schemas'
import { getTasksCollection, toPublicTask, type TaskDoc } from '@/server/tasks'

export const runtime = 'nodejs'

function errorResponse(error: unknown) {
  if (error instanceof AuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  // eslint-disable-next-line no-console
  console.error('task request failed', error)
  return NextResponse.json(
    { error: 'Could not process the task request. Please try again.' },
    { status: 500 }
  )
}

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params
  const raw = await request.json().catch(() => null)
  const parsed = updateTaskSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid task.' },
      { status: 400 }
    )
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json(
      { error: 'No fields to update were provided.' },
      { status: 400 }
    )
  }

  try {
    assertSameOrigin(request)
    await requireModulePermission('tasks')

    const tasks = await getTasksCollection()
    const now = new Date()
    const setFields: Partial<TaskDoc> = { updatedAt: now }
    if (parsed.data.id !== undefined) setFields.taskNumber = parsed.data.id
    if (parsed.data.title !== undefined) setFields.title = parsed.data.title
    if (parsed.data.description !== undefined)
      setFields.description = parsed.data.description
    if (parsed.data.status !== undefined) setFields.status = parsed.data.status
    if (parsed.data.label !== undefined) setFields.label = parsed.data.label
    if (parsed.data.priority !== undefined)
      setFields.priority = parsed.data.priority
    if (parsed.data.taggedTo !== undefined)
      setFields.taggedTo = parsed.data.taggedTo

    const updated = await tasks.findOneAndUpdate(
      { taskNumber: id },
      { $set: setFields },
      { returnDocument: 'after' }
    )

    if (!updated) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 })
    }

    return NextResponse.json({ task: toPublicTask(updated) })
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

export async function DELETE(request: Request, { params }: RouteContext) {
  const { id } = await params
  try {
    assertSameOrigin(request)
    await requireModulePermission('tasks')

    const tasks = await getTasksCollection()
    const result = await tasks.deleteOne({ taskNumber: id })
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return errorResponse(error)
  }
}
