import {
  hasModulePermission,
  isSuperadmin,
  type PermissionSubject,
} from '@/lib/permissions'
import { type NavGroup, type NavItem } from '../types'

function canSee(
  item: NavItem,
  subject: PermissionSubject,
  hiddenPermissions: ReadonlySet<string>
): boolean {
  if (item.superadminOnly && !isSuperadmin(subject)) return false
  const permissions =
    item.permissionAnyOf ?? (item.permission ? [item.permission] : [])
  if (
    permissions.length > 0 &&
    !permissions.includes('settings_display') &&
    permissions.some((permission) => hiddenPermissions.has(permission))
  ) {
    return false
  }
  return (
    permissions.length === 0 ||
    permissions.some((permission) => hasModulePermission(subject, permission))
  )
}

export function filterNavGroups(
  groups: NavGroup[],
  subject: PermissionSubject,
  hiddenItems: readonly string[] = []
): NavGroup[] {
  const hiddenPermissions = new Set(hiddenItems)
  return groups.flatMap((group) => {
    const items = group.items.flatMap<NavItem>((item) => {
      if (item.items) {
        const visibleChildren = item.items.filter((child) =>
          canSee(child, subject, hiddenPermissions)
        )
        return visibleChildren.length > 0
          ? [{ ...item, items: visibleChildren }]
          : []
      }
      return canSee(item, subject, hiddenPermissions) ? [item] : []
    })

    return items.length > 0 ? [{ ...group, items }] : []
  })
}
