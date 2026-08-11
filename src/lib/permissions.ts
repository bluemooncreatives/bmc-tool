export const MODULE_DEFINITIONS = [
  {
    key: 'home',
    title: 'Home',
    description: 'Operational overview and dashboard.',
    path: '/',
    group: 'Operations',
  },
  {
    key: 'tasks',
    title: 'Tasks',
    description: 'Task lists, ownership, and delivery status.',
    path: '/tasks',
    group: 'Operations',
  },
  {
    key: 'leads',
    title: 'Leads',
    description: 'Sales leads and pipeline qualification.',
    path: '/leads',
    group: 'Operations',
  },
  {
    key: 'quotations',
    title: 'Quotations',
    description: 'Client estimates and quotation follow-up.',
    path: '/quotations',
    group: 'Operations',
  },
  {
    key: 'calendars',
    title: 'Calendars',
    description: 'Shared meetings, events, and deadlines.',
    path: '/calenders',
    group: 'Operations',
  },
  {
    key: 'plans',
    title: 'Plans',
    description: 'Goals, milestones, and delivery plans.',
    path: '/plans',
    group: 'Operations',
  },
  {
    key: 'schedule',
    title: 'Schedule',
    description: 'Team assignments and upcoming work.',
    path: '/schedule',
    group: 'Operations',
  },
  {
    key: 'reports_analytics',
    title: 'Reports & Analytics',
    description: 'Performance, pipeline, and delivery reporting.',
    path: '/reports-analytics',
    group: 'Operations',
  },
  {
    key: 'settings_profile',
    title: 'Profile settings',
    description: 'Personal profile configuration.',
    path: '/settings',
    group: 'Settings',
  },
  {
    key: 'settings_account',
    title: 'Account settings',
    description: 'Account preferences and details.',
    path: '/settings/account',
    group: 'Settings',
  },
  {
    key: 'settings_appearance',
    title: 'Appearance settings',
    description: 'Theme and visual preferences.',
    path: '/settings/appearance',
    group: 'Settings',
  },
  {
    key: 'settings_notifications',
    title: 'Notification settings',
    description: 'Notification delivery preferences.',
    path: '/settings/notifications',
    group: 'Settings',
  },
  {
    key: 'settings_display',
    title: 'Display settings',
    description: 'Application display preferences.',
    path: '/settings/display',
    group: 'Settings',
  },
  {
    key: 'help_center',
    title: 'Help Center',
    description: 'Workspace help and support resources.',
    path: '/help-center',
    group: 'Other',
  },
] as const

export type ModuleKey = (typeof MODULE_DEFINITIONS)[number]['key']

export const MODULE_KEYS = MODULE_DEFINITIONS.map(
  (module) => module.key
) as [ModuleKey, ...ModuleKey[]]

export type PermissionSubject = {
  role: readonly string[]
  modulePermissions?: readonly string[]
}

export function isModuleKey(value: unknown): value is ModuleKey {
  return (
    typeof value === 'string' &&
    (MODULE_KEYS as readonly string[]).includes(value)
  )
}

export function sanitizeModulePermissions(value: unknown): ModuleKey[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter(isModuleKey))]
}

export function isSuperadmin(subject: PermissionSubject): boolean {
  return subject.role.includes('superadmin')
}

export function hasModulePermission(
  subject: PermissionSubject,
  module: ModuleKey
): boolean {
  return (
    isSuperadmin(subject) ||
    sanitizeModulePermissions(subject.modulePermissions).includes(module)
  )
}

/** Resolves nested routes by longest prefix so /settings/account beats /settings. */
export function moduleForPath(pathname: string): ModuleKey | null {
  if (pathname === '/') return 'home'

  const match = [...MODULE_DEFINITIONS]
    .filter((module) => module.path !== '/')
    .sort((a, b) => b.path.length - a.path.length)
    .find(
      (module) =>
        pathname === module.path || pathname.startsWith(`${module.path}/`)
    )

  return match?.key ?? null
}

export function canAccessPath(
  subject: PermissionSubject,
  pathname: string
): boolean {
  if (
    pathname.startsWith('/permission-manager') ||
    pathname.startsWith('/users')
  ) {
    return isSuperadmin(subject)
  }

  const module = moduleForPath(pathname)
  return module ? hasModulePermission(subject, module) : true
}
