export const ROLES = ['superadmin', 'org_admin', 'user'] as const

export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  superadmin: 'Super Admin',
  org_admin: 'Organization Admin',
  user: 'Member',
}

/**
 * `platform` accounts belong to Blue Moon Creatives and can act across every
 * organization. `organization` accounts are confined to their own tenant.
 */
export const ACCOUNT_SCOPES = ['platform', 'organization'] as const

export type AccountScope = (typeof ACCOUNT_SCOPES)[number]

export const USER_STATUSES = [
  'active',
  'inactive',
  'invited',
  'pending',
  'suspended',
] as const

export type UserStatus = (typeof USER_STATUSES)[number]

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  invited: 'Invited',
  pending: 'Pending approval',
  suspended: 'Suspended',
}

export function isRole(value: unknown): value is Role {
  return (
    typeof value === 'string' && (ROLES as readonly string[]).includes(value)
  )
}

export function isUserStatus(value: unknown): value is UserStatus {
  return (
    typeof value === 'string' &&
    (USER_STATUSES as readonly string[]).includes(value)
  )
}

/**
 * Collapses a stored role array to exactly one effective role, highest wins.
 * Legacy admin/manager/cashier values from the dashboard template fall through
 * to `user`.
 */
export function sanitizeRoles(value: unknown): Role[] {
  if (!Array.isArray(value)) return ['user']
  if (value.includes('superadmin')) return ['superadmin']
  if (value.includes('org_admin')) return ['org_admin']
  return ['user']
}

export function primaryRole(value: unknown): Role {
  return sanitizeRoles(value)[0] as Role
}

/** The system owner always uses email MFA. */
export function requiresMfa(roles: readonly string[]): boolean {
  return roles.includes('superadmin')
}

export function isActiveStatus(status: unknown): status is 'active' {
  return status === 'active'
}

/**
 * Statuses that may hold a session.
 *
 * `invited` is included on purpose: a provisioned account has to be able to
 * sign in with its temporary password, and it becomes `active` the moment the
 * holder sets a password of their own.
 */
export function canSignIn(status: unknown): boolean {
  const value = status ?? 'active'
  return value === 'active' || value === 'invited'
}
