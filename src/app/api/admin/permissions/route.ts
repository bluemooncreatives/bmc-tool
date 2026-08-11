import { ObjectId, type Filter } from 'mongodb'
import { NextResponse } from 'next/server'
import {
  MODULE_KEYS,
  sanitizeModulePermissions,
} from '@/lib/permissions'
import {
  assertSameOrigin,
  AuthorizationError,
  requireSuperadmin,
} from '@/server/authorization'
import { parseJsonBody } from '@/server/auth-schemas'
import { recordPermissionAudit } from '@/server/permission-audit'
import { updatePermissionsSchema } from '@/server/permission-schemas'
import { getUsersCollection, type UserDoc } from '@/server/users'

export const runtime = 'nodejs'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function toPermissionUser(user: UserDoc) {
  return {
    id: user._id.toHexString(),
    email: user.email,
    firstName: user.firstName ?? '',
    lastName: user.lastName ?? '',
    role: user.role.includes('superadmin') ? 'superadmin' : 'user',
    status: user.status ?? 'active',
    modulePermissions: sanitizeModulePermissions(user.modulePermissions),
    isSystemOwner: Boolean(user.isSystemOwner),
    lastLoginAt: user.lastLoginAt?.toISOString(),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }
}

function errorResponse(error: unknown) {
  if (error instanceof AuthorizationError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status }
    )
  }
  // eslint-disable-next-line no-console
  console.error('permission manager request failed', error)
  return NextResponse.json(
    { error: 'Could not manage permissions. Please try again.' },
    { status: 500 }
  )
}

export async function GET(request: Request) {
  try {
    await requireSuperadmin()
    const search = new URL(request.url).searchParams
      .get('search')
      ?.trim()
      .slice(0, 100)
    const filter: Filter<UserDoc> = search
      ? {
          $or: [
            { email: { $regex: escapeRegExp(search), $options: 'i' } },
            { firstName: { $regex: escapeRegExp(search), $options: 'i' } },
            { lastName: { $regex: escapeRegExp(search), $options: 'i' } },
          ],
        }
      : {}

    const users = await getUsersCollection()
    const results = await users
      .find(filter)
      .sort({ isSystemOwner: -1, email: 1 })
      .limit(200)
      .toArray()

    return NextResponse.json(
      { users: results.map(toPermissionUser) },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request) {
  const body = await parseJsonBody(request, updatePermissionsSchema)
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: 400 })
  }

  try {
    assertSameOrigin(request)
    const actor = await requireSuperadmin()
    const users = await getUsersCollection()
    const targetId = new ObjectId(body.data.userId)
    const target = await users.findOne({ _id: targetId })

    if (!target) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 })
    }
    if (target.isSystemOwner || target.role.includes('superadmin')) {
      return NextResponse.json(
        { error: 'The system owner permissions cannot be changed.' },
        { status: 403 }
      )
    }

    const requested = new Set(body.data.permissions)
    const permissions = MODULE_KEYS.filter((permission) =>
      requested.has(permission)
    )
    const before = sanitizeModulePermissions(target.modulePermissions)
    const unchanged =
      permissions.length === before.length &&
      permissions.every((permission, index) => permission === before[index])
    if (unchanged) {
      return NextResponse.json({ user: toPermissionUser(target) })
    }

    const now = new Date()
    const updated = await users.findOneAndUpdate(
      {
        _id: targetId,
        updatedAt: new Date(body.data.expectedUpdatedAt),
        isSystemOwner: { $ne: true },
        role: { $ne: 'superadmin' },
      },
      {
        $set: { modulePermissions: permissions, updatedAt: now },
        $inc: { tokenVersion: 1 },
      },
      { returnDocument: 'after' }
    )

    if (!updated) {
      return NextResponse.json(
        {
          error:
            'This user changed since you opened the page. Reload and try again.',
        },
        { status: 409 }
      )
    }

    try {
      await recordPermissionAudit({
        actorId: actor._id,
        targetUserId: targetId,
        before,
        after: permissions,
        createdAt: now,
        userAgent: request.headers.get('user-agent')?.slice(0, 300),
      })
    } catch (auditError) {
      // The authorization change is already atomic and committed. Surface the
      // audit outage to operators without lying to the UI about the result.
      // eslint-disable-next-line no-console
      console.error('permission audit write failed', auditError)
    }

    return NextResponse.json({ user: toPermissionUser(updated) })
  } catch (error) {
    return errorResponse(error)
  }
}
