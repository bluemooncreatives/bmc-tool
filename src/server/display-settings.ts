import { z } from 'zod'
import {
  hasModulePermission,
  hasAccountSettingsAccess,
  isModuleKey,
  MODULE_DEFINITIONS,
  sanitizeModulePermissions,
  type ModuleKey,
} from '@/lib/permissions'
import { type UserDoc } from './users'

export const REQUIRED_SIDEBAR_ITEM: ModuleKey = 'settings_display'

const moduleKeySchema = z.custom<ModuleKey>(isModuleKey, {
  message: 'The sidebar selection contains an unknown item.',
})

export const displaySettingsSchema = z.object({
  selectedItems: z
    .array(moduleKeySchema)
    .max(MODULE_DEFINITIONS.length)
    .refine((items) => new Set(items).size === items.length, {
      message: 'Duplicate sidebar items are not allowed.',
    }),
  expectedUpdatedAt: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), {
      message: 'The display-preferences version is invalid.',
    }),
})

export function availableSidebarItems(user: UserDoc) {
  return MODULE_DEFINITIONS.filter(
    (item) =>
      item.key !== 'settings_account' &&
      (item.key === 'settings_profile'
        ? hasAccountSettingsAccess(user)
        : hasModulePermission(user, item.key))
  ).map((item) => ({
    id: item.key,
    label: item.title,
    description: item.description,
    group: item.group,
    required: item.key === REQUIRED_SIDEBAR_ITEM,
  }))
}

export function serializeDisplaySettings(user: UserDoc) {
  const availableItems = availableSidebarItems(user)
  const hidden = new Set(sanitizeModulePermissions(user.hiddenSidebarItems))
  return {
    availableItems,
    selectedItems: availableItems
      .filter((item) => item.required || !hidden.has(item.id))
      .map((item) => item.id),
    updatedAt: user.updatedAt.toISOString(),
  }
}

export function mergeHiddenSidebarItems(
  user: UserDoc,
  selectedItems: ModuleKey[]
): ModuleKey[] {
  const available = availableSidebarItems(user).map((item) => item.id)
  const availableSet = new Set<ModuleKey>(available)
  const selectedSet = new Set<ModuleKey>(selectedItems)
  const preserved = sanitizeModulePermissions(user.hiddenSidebarItems).filter(
    (item) => !availableSet.has(item)
  )
  const newlyHidden = available.filter(
    (item) => item !== REQUIRED_SIDEBAR_ITEM && !selectedSet.has(item)
  )
  return [...new Set([...preserved, ...newlyHidden])]
}
