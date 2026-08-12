import { describe, expect, it } from 'vitest'
import { type NavGroup } from '../types'
import { filterNavGroups } from './filter-sidebar-data'

const groups: NavGroup[] = [
  {
    title: 'Operations',
    items: [
      { title: 'Home', url: '/', permission: 'home' },
      { title: 'Tasks', url: '/tasks', permission: 'tasks' },
    ],
  },
  {
    title: 'Other',
    items: [
      {
        title: 'Settings',
        items: [
          {
            title: 'Profile & Account',
            url: '/settings',
            permission: 'settings_profile',
            permissionAnyOf: ['settings_profile', 'settings_account'],
          },
          {
            title: 'Display',
            url: '/settings/display',
            permission: 'settings_display',
          },
        ],
      },
    ],
  },
]

const user = {
  role: ['user'],
  modulePermissions: ['home', 'tasks', 'settings_profile', 'settings_display'],
}

describe('filterNavGroups display preferences', () => {
  it('hides selected permitted modules without changing authorization', () => {
    const result = filterNavGroups(groups, user, ['tasks', 'settings_profile'])
    expect(result[0]?.items.map((item) => item.title)).toEqual(['Home'])
    expect(result[1]?.items[0]?.items?.map((item) => item.title)).toEqual([
      'Display',
    ])
  })

  it('never hides Display settings', () => {
    const result = filterNavGroups(groups, user, ['settings_display'])
    expect(result[1]?.items[0]?.items?.map((item) => item.title)).toContain(
      'Display'
    )
  })

  it('shows the unified destination to legacy account-only users', () => {
    const result = filterNavGroups(groups, {
      role: ['user'],
      modulePermissions: ['settings_account'],
    })
    expect(result).toHaveLength(1)
    expect(result[0]?.items[0]?.items?.map((item) => item.title)).toEqual([
      'Profile & Account',
    ])
  })
})
