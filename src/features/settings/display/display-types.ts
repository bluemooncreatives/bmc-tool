import { type AuthUser } from '@/stores/auth-store'
import { type ModuleKey } from '@/lib/permissions'

export type DisplayPreferenceItem = {
  id: ModuleKey
  label: string
  description: string
  group: string
  required: boolean
}

export type DisplayPreferences = {
  availableItems: DisplayPreferenceItem[]
  selectedItems: ModuleKey[]
  updatedAt: string
}

export type DisplayPreferencesResponse = {
  preferences: DisplayPreferences
  user?: AuthUser
}
