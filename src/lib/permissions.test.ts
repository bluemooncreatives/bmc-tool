import { describe, expect, it } from 'vitest'
import {
  canAccessPath,
  hasModulePermission,
  moduleForPath,
  sanitizeModulePermissions,
} from './permissions'

const user = {
  role: ['user'],
  modulePermissions: ['tasks', 'settings_account'],
}

describe('module permissions', () => {
  it('uses a deny-by-default allowlist for ordinary users', () => {
    expect(hasModulePermission(user, 'tasks')).toBe(true)
    expect(hasModulePermission(user, 'leads')).toBe(false)
    expect(canAccessPath(user, '/tasks')).toBe(true)
    expect(canAccessPath(user, '/leads')).toBe(false)
  })

  it('matches the most specific nested settings module', () => {
    expect(moduleForPath('/settings')).toBe('settings_profile')
    expect(moduleForPath('/settings/account')).toBe('settings_account')
    expect(moduleForPath('/settings/account/security')).toBe(
      'settings_account'
    )
  })

  it('grants the owner every module and the permission manager', () => {
    const owner = { role: ['superadmin'], modulePermissions: [] }
    expect(canAccessPath(owner, '/reports-analytics')).toBe(true)
    expect(canAccessPath(owner, '/permission-manager')).toBe(true)
  })

  it('never grants ordinary users administration routes', () => {
    expect(canAccessPath(user, '/permission-manager')).toBe(false)
    expect(canAccessPath(user, '/users')).toBe(false)
  })

  it('drops unknown and duplicate permission values', () => {
    expect(
      sanitizeModulePermissions(['tasks', 'unknown', 'tasks', 42])
    ).toEqual(['tasks'])
  })
})
