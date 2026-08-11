import { describe, expect, it } from 'vitest'
import {
  NOTIFICATION_CATEGORIES,
  REQUIRED_NOTIFICATION_CATEGORIES,
  isNotificationCategory,
  sanitizeMutedCategories,
} from './notifications'

describe('notification categories', () => {
  it('covers system events and every permission-managed module', () => {
    expect(NOTIFICATION_CATEGORIES).toContain('system')
    expect(NOTIFICATION_CATEGORIES).toContain('security')
    expect(NOTIFICATION_CATEGORIES).toContain('permissions')
    expect(NOTIFICATION_CATEGORIES).toContain('tasks')
    expect(NOTIFICATION_CATEGORIES).toContain('reports_analytics')
    expect(NOTIFICATION_CATEGORIES).toContain('settings_notifications')
  })

  it('drops invalid, duplicate, and mandatory muted categories', () => {
    expect(
      sanitizeMutedCategories([
        'tasks',
        'tasks',
        'security',
        'system',
        'not-a-category',
      ])
    ).toEqual(['tasks'])
  })

  it('keeps mandatory categories valid but impossible to mute', () => {
    for (const category of REQUIRED_NOTIFICATION_CATEGORIES) {
      expect(isNotificationCategory(category)).toBe(true)
      expect(sanitizeMutedCategories([category])).toEqual([])
    }
  })
})
