import { getCurrentUser } from './session'
import { type UserDoc } from './users'

export class AuthorizationError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403
  ) {
    super(message)
    this.name = 'AuthorizationError'
  }
}

export async function requireSuperadmin(): Promise<UserDoc> {
  const user = await getCurrentUser()
  if (!user) throw new AuthorizationError('Not authenticated.', 401)
  if (!user.role.includes('superadmin') || !user.isSystemOwner) {
    throw new AuthorizationError(
      'Only the superadmin can manage module access.',
      403
    )
  }
  return user
}

export async function requireModulePermission(
  module: ModuleKey
): Promise<UserDoc> {
  const user = await getCurrentUser()
  if (!user) throw new AuthorizationError('Not authenticated.', 401)
  if (!hasModulePermission(user, module)) {
    throw new AuthorizationError(
      'You do not have access to this module.',
      403
    )
  }
  return user
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
import {
  hasModulePermission,
  type ModuleKey,
} from '@/lib/permissions'
