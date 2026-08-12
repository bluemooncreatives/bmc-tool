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
    title: 'All Tasks',
    description: 'View and manage every task, including completed work.',
    path: '/tasks',
    group: 'Operations',
  },
  {
    key: 'tasks_active',
    title: 'Active Tasks',
    description: 'View and manage tasks that are still in progress.',
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
    title: 'Profile & account settings',
    description: 'Identity, contact, and account preferences.',
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
  {
    key: 'account_organizations',
    title: 'Organizations',
    description:
      'Create, update, and retire the organizations connected to the platform.',
    path: '/account-management/organizations',
    group: 'Account Management',
  },
  {
    key: 'account_users',
    title: 'Create User',
    description:
      'Provision accounts, assign designations, and grant module access.',
    path: '/account-management/create-user',
    group: 'Account Management',
  },
  {
    key: 'account_control',
    title: 'Account Control',
    description:
      'Org chart, account lifecycle, reporting lines, and access auditing.',
    path: '/account-management/account-control',
    group: 'Account Management',
  },
] as const

export type ModuleKey = (typeof MODULE_DEFINITIONS)[number]['key']

export const MODULE_KEYS = MODULE_DEFINITIONS.map((module) => module.key) as [
  ModuleKey,
  ...ModuleKey[],
]

/**
 * Modules that belong to the platform operator and can never be delegated to
 * an organization, no matter what an entitlement document says.
 */
export const PLATFORM_ONLY_MODULES: readonly ModuleKey[] = [
  'account_organizations',
]

/** Everything an organization may be entitled to when it is first created. */
export const DEFAULT_ORGANIZATION_MODULES: readonly ModuleKey[] =
  MODULE_KEYS.filter((key) => !PLATFORM_ONLY_MODULES.includes(key))

/**
 * What an ordinary new member receives before anyone grants them anything.
 * Deliberately limited to their own account surface — access to real work
 * modules is always an explicit decision by an administrator.
 */
export const DEFAULT_MEMBER_MODULES: readonly ModuleKey[] = [
  'settings_profile',
  'settings_account',
  'settings_appearance',
  'settings_notifications',
  'settings_display',
]

/** The module set an organization administrator needs to run their own org. */
export const ORG_ADMIN_BASELINE_MODULES: readonly ModuleKey[] = [
  'home',
  'account_users',
  'account_control',
  ...DEFAULT_MEMBER_MODULES,
]

export const PERMISSION_ACTIONS = [
  'view',
  'create',
  'update',
  'delete',
  'export',
  'approve',
  'manage',
] as const

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number]

export const PERMISSION_ACTION_LABELS: Record<PermissionAction, string> = {
  view: 'View',
  create: 'Create',
  update: 'Edit',
  delete: 'Delete',
  export: 'Export',
  approve: 'Approve',
  manage: 'Manage settings',
}

/**
 * Per-module action refinement. A module absent from the map keeps every
 * action, which is what every account created before granular actions existed
 * expects.
 */
export type ModuleActionMap = Partial<Record<ModuleKey, PermissionAction[]>>

export type PermissionSubject = {
  role: readonly string[]
  modulePermissions?: readonly string[]
  moduleActions?: Readonly<Record<string, readonly string[]>> | null
}

export function isModuleKey(value: unknown): value is ModuleKey {
  return (
    typeof value === 'string' &&
    (MODULE_KEYS as readonly string[]).includes(value)
  )
}

export function isPermissionAction(value: unknown): value is PermissionAction {
  return (
    typeof value === 'string' &&
    (PERMISSION_ACTIONS as readonly string[]).includes(value)
  )
}

/** Drops unknown keys, removes duplicates, and restores canonical ordering. */
export function sanitizeModulePermissions(value: unknown): ModuleKey[] {
  if (!Array.isArray(value)) return []
  const requested = new Set(value.filter(isModuleKey))
  return MODULE_KEYS.filter((key) => requested.has(key))
}

export function sanitizeModuleActions(value: unknown): ModuleActionMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const result: ModuleActionMap = {}
  for (const [module, actions] of Object.entries(
    value as Record<string, unknown>
  )) {
    if (!isModuleKey(module) || !Array.isArray(actions)) continue
    const allowed = new Set(actions.filter(isPermissionAction))
    if (allowed.size === 0) continue
    result[module] = PERMISSION_ACTIONS.filter((action) => allowed.has(action))
  }
  return result
}

export function isSuperadmin(subject: PermissionSubject): boolean {
  return subject.role.includes('superadmin')
}

export function isOrgAdmin(subject: PermissionSubject): boolean {
  return subject.role.includes('org_admin')
}

/** Anyone allowed to open the Account Management area for some scope. */
export function isAccountAdministrator(subject: PermissionSubject): boolean {
  return isSuperadmin(subject) || isOrgAdmin(subject)
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

/**
 * Action-level check layered on top of the module grant. A granted module with
 * no recorded action list keeps every action, so existing grants are unchanged.
 */
export function hasModuleAction(
  subject: PermissionSubject,
  module: ModuleKey,
  action: PermissionAction
): boolean {
  if (isSuperadmin(subject)) return true
  if (!hasModulePermission(subject, module)) return false

  const actions = sanitizeModuleActions(subject.moduleActions)[module]
  if (!actions || actions.length === 0) return true
  return actions.includes(action) || actions.includes('manage')
}

export type EffectiveModuleInput = {
  role: readonly string[]
  /** Modules granted to this account directly by an administrator. */
  grantedModules?: readonly string[]
  /** Modules inherited from the account's designation template. */
  designationModules?: readonly string[]
  /** Explicit removals that win over both grants and designation defaults. */
  deniedModules?: readonly string[]
  /**
   * The ceiling the organization itself is entitled to. `null` means the
   * subject is not bound by an organization (platform scope).
   */
  organizationModules?: readonly string[] | null
}

/**
 * Collapses every source of authority into the flat list that is persisted on
 * the user document and enforced on every request.
 *
 * Resolution runs when a grant, designation, or entitlement changes rather
 * than on read, so authorization checks stay a single in-memory array test and
 * an organization losing a module immediately narrows all of its members.
 */
export function resolveEffectiveModules(
  input: EffectiveModuleInput
): ModuleKey[] {
  if (input.role.includes('superadmin')) return [...MODULE_KEYS]

  const denied = new Set(sanitizeModulePermissions(input.deniedModules))
  const granted = new Set([
    ...sanitizeModulePermissions(input.designationModules),
    ...sanitizeModulePermissions(input.grantedModules),
  ])
  const ceiling =
    input.organizationModules === null || input.organizationModules === undefined
      ? null
      : new Set(sanitizeModulePermissions(input.organizationModules))

  return MODULE_KEYS.filter(
    (key) =>
      granted.has(key) &&
      !denied.has(key) &&
      !PLATFORM_ONLY_MODULES.includes(key) &&
      (!ceiling || ceiling.has(key))
  )
}

/** An organization can never be entitled to a platform-operator module. */
export function sanitizeOrganizationModules(value: unknown): ModuleKey[] {
  return sanitizeModulePermissions(value).filter(
    (key) => !PLATFORM_ONLY_MODULES.includes(key)
  )
}

export function hasAccountSettingsAccess(subject: PermissionSubject): boolean {
  return (
    hasModulePermission(subject, 'settings_profile') ||
    hasModulePermission(subject, 'settings_account')
  )
}

export function hasActiveTasksAccess(subject: PermissionSubject): boolean {
  return (
    hasModulePermission(subject, 'tasks') ||
    hasModulePermission(subject, 'tasks_active')
  )
}

export function hasAccountManagementAccess(
  subject: PermissionSubject
): boolean {
  return (
    hasModulePermission(subject, 'account_organizations') ||
    hasModulePermission(subject, 'account_users') ||
    hasModulePermission(subject, 'account_control')
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

  if (pathname === '/settings' || pathname === '/settings/account') {
    return hasAccountSettingsAccess(subject)
  }

  if (pathname === '/tasks') return hasActiveTasksAccess(subject)

  const module = moduleForPath(pathname)

  // The Account Management index has no module of its own; landing on it must
  // still require one of its children rather than falling through to "allow".
  if (!module && pathname.startsWith('/account-management')) {
    return hasAccountManagementAccess(subject)
  }

  return module ? hasModulePermission(subject, module) : true
}
