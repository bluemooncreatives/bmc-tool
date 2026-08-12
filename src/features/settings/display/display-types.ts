import { type AuthUser } from '@/stores/auth-store'

export type DisplayPreferenceItem = {
  id: string
  label: string
  description: string
  group: string
  required: boolean
}

export type DisplayPreferences = {
  availableItems: DisplayPreferenceItem[]
  selectedItems: string[]
  updatedAt: string
}

export type DisplayPreferencesResponse = {
  preferences: DisplayPreferences
  user?: AuthUser
}
