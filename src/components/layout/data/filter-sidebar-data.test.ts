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
            title: 'Profile',
            url: '/settings',
            permission: 'settings_profile',
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
})
