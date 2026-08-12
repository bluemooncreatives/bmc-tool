import { ObjectId } from 'mongodb'
import {
  hasModuleAction,
  hasModulePermission,
  isOrgAdmin,
  isSuperadmin,
  type ModuleKey,
  type PermissionAction,
} from '@/lib/permissions'
import { getCurrentUser } from './session'
import { type UserDoc } from './users'

export class AuthorizationError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403 | 404
  ) {
    super(message)
    this.name = 'AuthorizationError'
  }
}

export async function requireAuthenticatedUser(): Promise<UserDoc> {
  const user = await getCurrentUser()
  if (!user) throw new AuthorizationError('Not authenticated.', 401)
  return user
}

export async function requireSuperadmin(): Promise<UserDoc> {
  const user = await requireAuthenticatedUser()
  if (!user.role.includes('superadmin') || !user.isSystemOwner) {
    throw new AuthorizationError(
      'Only the Super Admin can perform this action.',
      403
    )
  }
  return user
}

export async function requireModulePermission(
  module: ModuleKey
): Promise<UserDoc> {
  const user = await requireAuthenticatedUser()
  if (!hasModulePermission(user, module)) {
    throw new AuthorizationError('You do not have access to this module.', 403)
  }
  return user
}

export async function requireAnyModulePermission(
  modules: readonly ModuleKey[]
): Promise<UserDoc> {
  const user = await requireAuthenticatedUser()
  if (!modules.some((module) => hasModulePermission(user, module))) {
    throw new AuthorizationError('You do not have access to this module.', 403)
  }
  return user
}

/** Module access plus a specific verb, for writes inside a granted module. */
export async function requireModuleAction(
  module: ModuleKey,
  action: PermissionAction
): Promise<UserDoc> {
  const user = await requireAuthenticatedUser()
  if (!hasModuleAction(user, module, action)) {
    throw new AuthorizationError(
      'You do not have permission to perform this action.',
      403
    )
  }
  return user
}

/**
 * Account Management endpoints are reachable by the Super Admin (every tenant)
 * and by an organization administrator (their own tenant only). Holding the
 * module is not enough — an ordinary member can never administer accounts.
 */
export async function requireAccountAdmin(
  module: ModuleKey
): Promise<UserDoc> {
  const user = await requireAuthenticatedUser()
  if (isSuperadmin(user)) return user

  if (!isOrgAdmin(user) || !hasModulePermission(user, module)) {
    throw new AuthorizationError(
      'Only an administrator can manage accounts.',
      403
    )
  }
  return user
}

export function isPlatformAdmin(user: UserDoc): boolean {
  return isSuperadmin(user) && Boolean(user.isSystemOwner)
}

/**
 * Resolves which organization a request may act on.
 *
 * The Super Admin may name any organization; an organization administrator is
 * pinned to their own, and asking for another one is refused rather than
 * silently rewritten, so a mistyped id never leaks a different tenant's data.
 */
export function resolveScopedOrganizationId(
  actor: UserDoc,
  requestedOrganizationId?: string | null
): ObjectId {
  if (isSuperadmin(actor)) {
    if (!requestedOrganizationId) return actor.organizationId
    if (!ObjectId.isValid(requestedOrganizationId)) {
      throw new AuthorizationError('That organization does not exist.', 404)
    }
    return new ObjectId(requestedOrganizationId)
  }

  if (
    requestedOrganizationId &&
    requestedOrganizationId !== actor.organizationId?.toHexString()
  ) {
    throw new AuthorizationError(
      'You can only manage your own organization.',
      403
    )
  }
  return actor.organizationId
}

/** `null` for the Super Admin, meaning "every organization". */
export function organizationScopeFilter(actor: UserDoc): ObjectId | null {
  return isSuperadmin(actor) ? null : actor.organizationId
}

/**
 * Central rule set for one account acting on another. Everything that mutates
 * a user goes through this so the protections cannot drift between endpoints.
 */
export function assertCanManageAccount(
  actor: UserDoc,
  target: UserDoc,
  options: { allowSelf?: boolean } = {}
): void {
  if (target.isSystemOwner) {
    throw new AuthorizationError(
      'The Super Admin account cannot be modified from here.',
      403
    )
  }

  if (!options.allowSelf && actor._id.equals(target._id)) {
    throw new AuthorizationError(
      'You cannot perform this action on your own account.',
      403
    )
  }

  if (isSuperadmin(actor)) return

  if (!isOrgAdmin(actor)) {
    throw new AuthorizationError(
      'Only an administrator can manage accounts.',
      403
    )
  }

  if (!actor.organizationId?.equals(target.organizationId)) {
    throw new AuthorizationError(
      'You can only manage accounts inside your own organization.',
      403
    )
  }

  if (isSuperadmin(target)) {
    throw new AuthorizationError(
      'You cannot manage a platform administrator.',
      403
    )
  }
}

/**
 * Cookie auth plus JSON already blocks ordinary form CSRF. This additionally
 * rejects cross-site fetches and mismatched Origin headers on sensitive writes.
 */
export function assertSameOrigin(request: Request): void {
  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite === 'cross-site') {
    throw new AuthorizationError('Cross-site requests are not allowed.', 403)
  }

  const origin = request.headers.get('origin')
  if (origin && new URL(origin).origin !== new URL(request.url).origin) {
    throw new AuthorizationError('Request origin is not allowed.', 403)
  }
}
