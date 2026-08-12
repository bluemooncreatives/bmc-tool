import {
  type BillingPlan,
  type EmploymentType,
  type OrganizationSize,
  type OrganizationStatus,
  type OrganizationType,
} from '@/lib/organizations'
import {
  type ModuleActionMap,
  type ModuleKey,
} from '@/lib/permissions'

/** Mirrors the server serializers in @/server/organizations and users. */

export type AccountRole = 'superadmin' | 'org_admin' | 'user'

export type AccountStatus =
  | 'active'
  | 'inactive'
  | 'invited'
  | 'pending'
  | 'suspended'

export type OrganizationStats = {
  totalMembers: number
  activeMembers: number
  pendingMembers: number
  suspendedMembers: number
  admins: number
  seatsRemaining: number | null
}

export type OrganizationAddress = {
  line1: string
  line2: string
  city: string
  state: string
  postalCode: string
  country: string
}

export type OrganizationSettings = {
  allowSelfSignUp: boolean
  requireAdminApproval: boolean
  allowedEmailDomains: string[]
  enforceMfa: boolean
  seatLimit: number | null
}

export type Organization = {
  id: string
  code: string
  name: string
  slug: string
  type: OrganizationType
  status: OrganizationStatus
  description: string
  industry: string
  size: OrganizationSize | ''
  website: string
  logoUrl: string
  contactEmail: string
  contactPhone: string
  address: OrganizationAddress
  billing: {
    plan: BillingPlan
    currency: string
    renewalAt: string | null
    taxId: string
    notes: string
  }
  enabledModules: ModuleKey[]
  defaultMemberModules: ModuleKey[]
  settings: OrganizationSettings
  primaryAdminId: string | null
  isSystemOrg: boolean
  createdAt: string
  updatedAt: string
  archivedAt: string | null
  stats?: OrganizationStats
}

export type ManagedAccount = {
  id: string
  accountNo: string
  email: string
  username: string
  name: string
  role: AccountRole
  status: AccountStatus
  scope: 'platform' | 'organization'
  organizationId: string
  organizationCode: string
  organizationName: string
  departmentId: string | null
  departmentName: string
  designationId: string | null
  designationTitle: string
  managerId: string | null
  employeeId: string
  employmentType: EmploymentType | ''
  jobTitle: string
  phone: string
  location: string
  timezone: string
  joinedAt: string | null
  modulePermissions: ModuleKey[]
  grantedModules: ModuleKey[]
  deniedModules: ModuleKey[]
  moduleActions: ModuleActionMap
  grantedModuleActions: ModuleActionMap
  mfaEnabled: boolean
  isSystemOwner: boolean
  mustChangePassword: boolean
  adminNotes: string
  suspendedReason: string
  lastLoginAt: string | null
  invitedAt: string | null
  activatedAt: string | null
  suspendedAt: string | null
  createdAt: string
  updatedAt: string
}

export type Department = {
  id: string
  organizationId: string
  name: string
  code: string
  description: string
  parentDepartmentId: string | null
  headUserId: string | null
  memberCount?: number
  createdAt: string
  updatedAt: string
}

export type Designation = {
  id: string
  organizationId: string
  title: string
  code: string
  level: number
  departmentId: string | null
  description: string
  defaultModules: ModuleKey[]
  defaultModuleActions: ModuleActionMap
  isDefault: boolean
  memberCount?: number
  createdAt: string
  updatedAt: string
}

export type ManagerOption = {
  id: string
  name: string
  email: string
  designationTitle: string
  isAdmin: boolean
}

export type DirectoryResponse = {
  organization: Organization
  departments: Department[]
  designations: Designation[]
  managers: ManagerOption[]
}

export type OrgChartNode = {
  id: string
  name: string
  email: string
  role: AccountRole
  status: AccountStatus
  designationTitle: string
  departmentName: string
  jobTitle: string
  managerId: string | null
  totalReports: number
  children: OrgChartNode[]
}

export type OrgChart = {
  organizationId: string
  roots: OrgChartNode[]
  detached: OrgChartNode[]
  totals: {
    accounts: number
    admins: number
    active: number
    withoutManager: number
    maxDepth: number
  }
}

export type AuditEntry = {
  id: string
  action: string
  actorEmail: string
  organizationId: string | null
  targetLabel: string
  summary: string
  createdAt: string
}

/**
 * Provisioning responses carry the generated password only when the invite
 * email could not be delivered, so the administrator can pass it on manually.
 */
export type ProvisioningResult = {
  account: ManagedAccount
  emailDelivered: boolean
  temporaryPassword?: string
}
