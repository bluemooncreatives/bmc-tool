export const ROLES = ['superadmin', 'user'] as const

export type Role = (typeof ROLES)[number]

export const USER_STATUSES = [
  'active',
  'inactive',
  'invited',
  'suspended',
] as const

export type UserStatus = (typeof USER_STATUSES)[number]

export function isRole(value: unknown): value is Role {
  return (
    typeof value === 'string' &&
    (ROLES as readonly string[]).includes(value)
  )
}

/** Legacy admin/manager/cashier values deliberately collapse to user. */
export function sanitizeRoles(value: unknown): Role[] {
  return Array.isArray(value) && value.includes('superadmin')
    ? ['superadmin']
    : ['user']
}

/** The system owner always uses email MFA. */
export function requiresMfa(roles: readonly string[]): boolean {
  return roles.includes('superadmin')
}

export function isActiveStatus(status: unknown): status is 'active' {
  return status === 'active'
}
