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
  if (
    item.permission &&
    item.permission !== 'settings_display' &&
    hiddenPermissions.has(item.permission)
  ) {
    return false
  }
  return !item.permission || hasModulePermission(subject, item.permission)
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
