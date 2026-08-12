import { describe, expect, it } from 'vitest'
import {
  availableSidebarItems,
  displaySettingsSchema,
  mergeHiddenSidebarItems,
  serializeDisplaySettings,
} from './display-settings'
import { type UserDoc } from './users'

function user(overrides: Partial<UserDoc> = {}) {
  return {
    role: ['user'],
    modulePermissions: ['home', 'tasks', 'settings_display'],
    hiddenSidebarItems: [],
    updatedAt: new Date('2026-08-12T10:00:00.000Z'),
    ...overrides,
  } as UserDoc
}

describe('display settings', () => {
  it('only exposes modules the user can access', () => {
    expect(availableSidebarItems(user()).map((item) => item.id)).toEqual([
      'home',
      'tasks',
      'settings_display',
    ])
  })

  it('keeps Display selected even if stale data tried to hide it', () => {
    const preferences = serializeDisplaySettings(
      user({ hiddenSidebarItems: ['tasks', 'settings_display'] })
    )
    expect(preferences.selectedItems).toEqual(['home', 'settings_display'])
  })

  it('preserves hidden preferences for temporarily unavailable modules', () => {
    expect(
      mergeHiddenSidebarItems(user({ hiddenSidebarItems: ['leads'] }), [
        'home',
        'settings_display',
      ])
    ).toEqual(['leads', 'tasks'])
  })

  it('rejects duplicate and unknown module keys', () => {
    const base = { expectedUpdatedAt: '2026-08-12T10:00:00.000Z' }
    expect(
      displaySettingsSchema.safeParse({
        ...base,
        selectedItems: ['home', 'home'],
      }).success
    ).toBe(false)
    expect(
      displaySettingsSchema.safeParse({
        ...base,
        selectedItems: ['not-real'],
      }).success
    ).toBe(false)
  })
})
