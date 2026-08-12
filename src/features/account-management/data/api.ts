import { apiFetch } from '@/lib/api-client'
import {
  type AuditEntry,
  type Department,
  type Designation,
  type DirectoryResponse,
  type ManagedAccount,
  type OrgChart,
  type Organization,
  type ProvisioningResult,
} from './types'

/** Drops empty values so the query string only carries real filters. */
function query(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const serialized = search.toString()
  return serialized ? `?${serialized}` : ''
}

// --- Organizations ---------------------------------------------------------

export function listOrganizations(filters: {
  search?: string
  status?: string
  type?: string
  includeArchived?: boolean
}) {
  return apiFetch<{ organizations: Organization[] }>(
    `/api/admin/organizations${query({
      search: filters.search,
      status: filters.status === 'all' ? undefined : filters.status,
      type: filters.type === 'all' ? undefined : filters.type,
      includeArchived: filters.includeArchived ? 'true' : undefined,
    })}`
  )
}

export function createOrganization(body: unknown) {
  return apiFetch<{
    organization: Organization
    admin: {
      created: boolean
      email?: string
      temporaryPassword?: string
      emailDelivered?: boolean
      error?: string
    }
  }>('/api/admin/organizations', { method: 'POST', body })
}

export function updateOrganization(id: string, body: unknown) {
  return apiFetch<{ organization: Organization; warnings?: string[] }>(
    `/api/admin/organizations/${id}`,
    { method: 'PATCH', body }
  )
}

export function deleteOrganization(id: string, mode: 'archive' | 'purge') {
  return apiFetch<{ deleted: boolean; mode: string; memberCount?: number }>(
    `/api/admin/organizations/${id}${query({ mode })}`,
    { method: 'DELETE' }
  )
}

export function createOrganizationAdmin(id: string, body: unknown) {
  return apiFetch<ProvisioningResult>(
    `/api/admin/organizations/${id}/admins`,
    { method: 'POST', body }
  )
}

// --- Accounts --------------------------------------------------------------

export function listAccounts(filters: {
  organizationId?: string
  search?: string
  status?: string
  role?: string
  designationId?: string
  departmentId?: string
}) {
  return apiFetch<{ accounts: ManagedAccount[]; total: number }>(
    `/api/admin/accounts${query({
      organizationId: filters.organizationId,
      search: filters.search,
      status: filters.status === 'all' ? undefined : filters.status,
      role: filters.role === 'all' ? undefined : filters.role,
      designationId: filters.designationId,
      departmentId: filters.departmentId,
    })}`
  )
}

export function createAccount(body: unknown) {
  return apiFetch<ProvisioningResult>('/api/admin/accounts', {
    method: 'POST',
    body,
  })
}

export function updateAccount(id: string, body: unknown) {
  return apiFetch<{ account: ManagedAccount }>(`/api/admin/accounts/${id}`, {
    method: 'PATCH',
    body,
  })
}

export function deleteAccount(id: string) {
  return apiFetch<{ deleted: boolean; reassignedReports: number }>(
    `/api/admin/accounts/${id}`,
    { method: 'DELETE' }
  )
}

export type AccountActionBody =
  | { action: 'reset-password'; sendEmail: boolean }
  | { action: 'force-signout' }
  | { action: 'resend-invite' }
  | { action: 'suspend'; reason?: string }
  | { action: 'activate' }
  | { action: 'deactivate' }
  | { action: 'transfer'; organizationId: string }

export function runAccountAction(id: string, body: AccountActionBody) {
  return apiFetch<{
    ok: boolean
    account?: ManagedAccount | null
    emailDelivered?: boolean
    temporaryPassword?: string
  }>(`/api/admin/accounts/${id}/actions`, { method: 'POST', body })
}

// --- Directory -------------------------------------------------------------

export function loadDirectory(organizationId?: string) {
  return apiFetch<DirectoryResponse>(
    `/api/admin/directory${query({ organizationId })}`
  )
}

export function createDepartment(body: unknown) {
  return apiFetch<{ department: Department }>(
    '/api/admin/directory/departments',
    { method: 'POST', body }
  )
}

export function updateDepartment(id: string, body: unknown) {
  return apiFetch<{ department: Department }>(
    `/api/admin/directory/departments/${id}`,
    { method: 'PATCH', body }
  )
}

export function deleteDepartment(id: string) {
  return apiFetch<{ deleted: boolean; detachedAccounts: number }>(
    `/api/admin/directory/departments/${id}`,
    { method: 'DELETE' }
  )
}

export function createDesignation(body: unknown) {
  return apiFetch<{ designation: Designation }>(
    '/api/admin/directory/designations',
    { method: 'POST', body }
  )
}

export function updateDesignation(id: string, body: unknown) {
  return apiFetch<{ designation: Designation; recalculatedAccounts?: number }>(
    `/api/admin/directory/designations/${id}`,
    { method: 'PATCH', body }
  )
}

export function deleteDesignation(id: string) {
  return apiFetch<{ deleted: boolean; affectedAccounts: number }>(
    `/api/admin/directory/designations/${id}`,
    { method: 'DELETE' }
  )
}

// --- Insight ---------------------------------------------------------------

export function loadOrgChart(organizationId?: string) {
  return apiFetch<{ chart: OrgChart; organization: Organization }>(
    `/api/admin/org-chart${query({ organizationId })}`
  )
}

export function loadAuditTrail(filters: {
  organizationId?: string
  targetUserId?: string
  limit?: number
}) {
  return apiFetch<{ entries: AuditEntry[] }>(
    `/api/admin/audit${query({
      organizationId: filters.organizationId,
      targetUserId: filters.targetUserId,
      limit: filters.limit,
    })}`
  )
}
