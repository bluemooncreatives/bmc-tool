import {
  hasModulePermission,
  isSuperadmin,
  type PermissionSubject,
} from '@/lib/permissions'
import { type NavGroup, type NavItem } from '../types'

function canSee(item: NavItem, subject: PermissionSubject): boolean {
  if (item.superadminOnly && !isSuperadmin(subject)) return false
  return !item.permission || hasModulePermission(subject, item.permission)
}

export function filterNavGroups(
  groups: NavGroup[],
  subject: PermissionSubject
): NavGroup[] {
  return groups.flatMap((group) => {
    const items = group.items.flatMap<NavItem>((item) => {
      if (item.items) {
        const visibleChildren = item.items.filter((child) =>
          canSee(child, subject)
        )
        return visibleChildren.length > 0
          ? [{ ...item, items: visibleChildren }]
          : []
      }
      return canSee(item, subject) ? [item] : []
    })

    return items.length > 0 ? [{ ...group, items }] : []
  })
}
