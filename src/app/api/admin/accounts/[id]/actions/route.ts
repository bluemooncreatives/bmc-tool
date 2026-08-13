import { ObjectId } from 'mongodb'
import { NextResponse } from 'next/server'
import { isSuperadmin } from '@/lib/permissions'
import { resolveAccess } from '@/server/access-control'
import { assertNotLastActiveAdmin } from '@/server/account-admin'
import {
  assertSeatAvailable,
  generateTemporaryPassword,
  ProvisioningError,
} from '@/server/account-provisioning'
import { recordAdminAudit } from '@/server/admin-audit'
import { accountActionSchema } from '@/server/admin-schemas'
import {
  badRequest,
  conflict,
  errorResponse,
  notFound,
} from '@/server/api-errors'
import { parseJsonBody } from '@/server/auth-schemas'
import {
  assertCanManageAccount,
  assertSameOrigin,
  requireAccountAdmin,
} from '@/server/authorization'
import {
  sendAccountInviteEmail,
  sendPasswordResetByAdminEmail,
} from '@/server/mailer'
import { findOrganizationById } from '@/server/organizations'
import { hashPassword } from '@/server/password'
import { ROLE_LABELS, primaryRole } from '@/server/roles'
import {
  getUserDisplayName,
  getUsersCollection,
  toManagedAccount,
} from '@/server/users'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * Lifecycle operations on a single account. These are separated from PATCH
 * because each one has its own side effect — a new secret, a revoked session,
 * an email — and none of them are a field edit.
 */
export async function POST(request: Request, { params }: RouteContext) {
  const body = await parseJsonBody(request, accountActionSchema)
  if (!body.ok) return badRequest(body.error)

  try {
    assertSameOrigin(request)
    const actor = await requireAccountAdmin('account_control')
    const { id } = await params
    if (!ObjectId.isValid(id)) return notFound('That account does not exist.')

    const users = await getUsersCollection()
    const target = await users.findOne({ _id: new ObjectId(id) })
    if (
      !target ||
      (!isSuperadmin(actor) &&
        !actor.organizationId.equals(target.organizationId))
    ) {
      return notFound('That account does not exist.')
    }

    assertCanManageAccount(actor, target)

    const organization = await findOrganizationById(target.organizationId)
    if (!organization) return notFound('That organization does not exist.')

    const now = new Date()
    const input = body.data

    switch (input.action) {
      case 'reset-password': {
        const temporaryPassword = generateTemporaryPassword()
        await users.updateOne(
          { _id: target._id },
          {
            $set: {
              passwordHash: await hashPassword(temporaryPassword),
              mustChangePassword: true,
              lastPasswordChangeAt: now,
              failedSignInAttempts: 0,
              updatedAt: now,
            },
            $unset: { lockedUntil: '' },
            // Every existing session dies with the old password.
            $inc: { tokenVersion: 1 },
          }
        )

        let emailDelivered = false
        if (input.sendEmail) {
          try {
            emailDelivered = await sendPasswordResetByAdminEmail({
              to: target.email,
              name: getUserDisplayName(target),
              organizationName: organization.name,
              temporaryPassword,
              actorEmail: actor.email,
              request,
            })
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error('admin password reset email failed', error)
          }
        }

        await recordAdminAudit({
          action: 'account.password_reset',
          actor,
          organizationId: target.organizationId,
          targetUserId: target._id,
          targetLabel: target.email,
          summary: `Reset the password for ${target.email} and revoked their sessions.`,
          request,
        })

        return NextResponse.json({
          ok: true,
          emailDelivered,
          ...(emailDelivered ? {} : { temporaryPassword }),
        })
      }

      case 'force-signout': {
        await users.updateOne(
          { _id: target._id },
          { $inc: { tokenVersion: 1 }, $set: { updatedAt: now } }
        )
        await recordAdminAudit({
          action: 'account.force_signout',
          actor,
          organizationId: target.organizationId,
          targetUserId: target._id,
          targetLabel: target.email,
          summary: `Signed ${target.email} out of every device.`,
          request,
        })
        return NextResponse.json({ ok: true })
      }

      case 'resend-invite': {
        if (target.status === 'active' && !target.mustChangePassword) {
          return conflict(
            `${target.email} has already activated their account. Use "Reset password" instead.`
          )
        }

        const temporaryPassword = generateTemporaryPassword()
        await users.updateOne(
          { _id: target._id },
          {
            $set: {
              passwordHash: await hashPassword(temporaryPassword),
              mustChangePassword: true,
              invitedAt: now,
              invitedBy: actor._id,
              updatedAt: now,
            },
            $inc: { tokenVersion: 1 },
          }
        )

        let emailDelivered = false
        try {
          emailDelivered = await sendAccountInviteEmail({
            to: target.email,
            name: getUserDisplayName(target),
            organizationName: organization.name,
            organizationCode: organization.code,
            temporaryPassword,
            roleLabel: ROLE_LABELS[primaryRole(target.role)],
            invitedByEmail: actor.email,
            request,
          })
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('invite resend failed', error)
        }

        await recordAdminAudit({
          action: 'account.invite_resent',
          actor,
          organizationId: target.organizationId,
          targetUserId: target._id,
          targetLabel: target.email,
          summary: `Re-issued the invitation for ${target.email}.`,
          request,
        })

        return NextResponse.json({
          ok: true,
          emailDelivered,
          ...(emailDelivered ? {} : { temporaryPassword }),
        })
      }

      case 'suspend':
      case 'deactivate': {
        const status = input.action === 'suspend' ? 'suspended' : 'inactive'
        if (target.status === status) {
          return NextResponse.json({
            ok: true,
            account: toManagedAccount(target),
          })
        }
        if (target.role.includes('org_admin') && target.status === 'active') {
          await assertNotLastActiveAdmin({
            organizationId: target.organizationId,
            accountId: target._id,
            action: input.action,
          })
        }

        const updated = await users.findOneAndUpdate(
          { _id: target._id },
          {
            $set: {
              status,
              updatedAt: now,
              ...(status === 'suspended'
                ? {
                    suspendedAt: now,
                    ...(input.action === 'suspend' && input.reason
                      ? { suspendedReason: input.reason }
                      : {}),
                  }
                : { deactivatedAt: now }),
            },
            $inc: { tokenVersion: 1 },
          },
          { returnDocument: 'after' }
        )

        await recordAdminAudit({
          action: 'account.status',
          actor,
          organizationId: target.organizationId,
          targetUserId: target._id,
          targetLabel: target.email,
          summary: `Set ${target.email} to ${status}.`,
          before: { status: target.status },
          after: { status },
          request,
        })

        return NextResponse.json({
          ok: true,
          account: updated ? toManagedAccount(updated) : null,
        })
      }

      case 'activate': {
        const updated = await users.findOneAndUpdate(
          { _id: target._id },
          {
            $set: {
              status: 'active',
              activatedAt: now,
              failedSignInAttempts: 0,
              updatedAt: now,
            },
            $unset: {
              suspendedAt: '',
              suspendedReason: '',
              deactivatedAt: '',
              lockedUntil: '',
            },
          },
          { returnDocument: 'after' }
        )

        await recordAdminAudit({
          action: 'account.status',
          actor,
          organizationId: target.organizationId,
          targetUserId: target._id,
          targetLabel: target.email,
          summary: `Activated ${target.email}.`,
          before: { status: target.status },
          after: { status: 'active' },
          request,
        })

        return NextResponse.json({
          ok: true,
          account: updated ? toManagedAccount(updated) : null,
        })
      }

      case 'transfer': {
        if (!isSuperadmin(actor)) {
          return NextResponse.json(
            { error: 'Only the Super Admin can move an account between organizations.' },
            { status: 403 }
          )
        }
        if (!ObjectId.isValid(input.organizationId)) {
          return notFound('That organization does not exist.')
        }
        const destinationId = new ObjectId(input.organizationId)
        if (destinationId.equals(target.organizationId)) {
          return conflict('The account is already in that organization.')
        }

        const destination = await findOrganizationById(destinationId)
        if (!destination) return notFound('That organization does not exist.')
        if (destination.status !== 'active') {
          return conflict(
            `${destination.name} is ${destination.status}, so accounts cannot be moved into it.`
          )
        }
        if (target.role.includes('org_admin')) {
          await assertNotLastActiveAdmin({
            organizationId: target.organizationId,
            accountId: target._id,
            action: 'move',
          })
        }
        await assertSeatAvailable(destination)

        // Designation, department, and manager all belong to the old tenant,
        // so the move clears them rather than pointing across organizations.
        const access = resolveAccess({
          role: target.role,
          grantedModules: target.grantedModules,
          deniedModules: target.deniedModules,
          grantedModuleActions: target.grantedModuleActions,
          designation: null,
          organization: destination,
        })

        const updated = await users.findOneAndUpdate(
          { _id: target._id },
          {
            $set: {
              organizationId: destination._id,
              organizationCode: destination.code,
              organizationName: destination.name,
              modulePermissions: access.modulePermissions,
              moduleActions: access.moduleActions,
              updatedAt: now,
            },
            $unset: {
              designationId: '',
              designationTitle: '',
              departmentId: '',
              departmentName: '',
              managerId: '',
            },
            $inc: { tokenVersion: 1 },
          },
          { returnDocument: 'after' }
        )

        // Anyone reporting to the moved account stays behind without a manager.
        await users.updateMany(
          { managerId: target._id, organizationId: target.organizationId },
          { $unset: { managerId: '' }, $set: { updatedAt: now } }
        )

        await recordAdminAudit({
          action: 'account.transfer',
          actor,
          organizationId: destination._id,
          targetUserId: target._id,
          targetLabel: target.email,
          summary: `Moved ${target.email} from ${target.organizationName} to ${destination.name}.`,
          before: { organization: target.organizationName },
          after: { organization: destination.name },
          request,
        })

        return NextResponse.json({
          ok: true,
          account: updated ? toManagedAccount(updated) : null,
        })
      }

      default: {
        // The schema is a closed union, so this is unreachable by construction.
        const exhaustive: never = input
        throw new ProvisioningError(
          `Unsupported action: ${JSON.stringify(exhaustive)}`,
          400
        )
      }
    }
  } catch (error) {
    return errorResponse(error, 'account action')
  }
}
