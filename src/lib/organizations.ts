/**
 * Organization vocabulary shared by the browser and the API routes.
 *
 * Everything here is data-only so the sign-up page, the Account Management
 * screens, and the server can agree on the same enumerations without the
 * client pulling in MongoDB.
 */

export const ORGANIZATION_TYPES = [
  'internal',
  'client',
  'partner',
  'vendor',
] as const

export type OrganizationType = (typeof ORGANIZATION_TYPES)[number]

export const ORGANIZATION_TYPE_LABELS: Record<OrganizationType, string> = {
  internal: 'Internal (Blue Moon Creatives)',
  client: 'Client',
  partner: 'Partner',
  vendor: 'Vendor',
}

export const ORGANIZATION_STATUSES = [
  'active',
  'onboarding',
  'suspended',
  'archived',
] as const

export type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number]

export const ORGANIZATION_STATUS_LABELS: Record<OrganizationStatus, string> = {
  active: 'Active',
  onboarding: 'Onboarding',
  suspended: 'Suspended',
  archived: 'Archived',
}

/** Only an active organization may authenticate or accept new members. */
export function isOrganizationUsable(status: OrganizationStatus): boolean {
  return status === 'active'
}

export const EMPLOYMENT_TYPES = [
  'full_time',
  'part_time',
  'contract',
  'intern',
  'freelance',
  'consultant',
] as const

export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: 'Full time',
  part_time: 'Part time',
  contract: 'Contract',
  intern: 'Intern',
  freelance: 'Freelance',
  consultant: 'Consultant',
}

export const ORGANIZATION_SIZES = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '500+',
] as const

export type OrganizationSize = (typeof ORGANIZATION_SIZES)[number]

export const BILLING_PLANS = [
  'trial',
  'starter',
  'growth',
  'enterprise',
  'internal',
] as const

export type BillingPlan = (typeof BILLING_PLANS)[number]

/**
 * The workspace owner's own organization. It is seeded on first boot, can
 * never be deleted, and is the only organization allowed to hold platform
 * scoped accounts.
 */
export const INTERNAL_ORGANIZATION_CODE = 'BMC'

export function isExternalOrganization(organization: {
  code: string
  type: OrganizationType
  isSystemOrg?: boolean
}): boolean {
  return (
    normalizeOrganizationCode(organization.code) !==
      INTERNAL_ORGANIZATION_CODE &&
    organization.type !== 'internal' &&
    organization.isSystemOrg !== true
  )
}

export function acceptsPublicSignUp(organization: {
  code: string
  type: OrganizationType
  status: OrganizationStatus
  isSystemOrg?: boolean
  allowSelfSignUp?: boolean
}): boolean {
  return (
    isExternalOrganization(organization) &&
    organization.status === 'active' &&
    organization.allowSelfSignUp === true
  )
}

export const ORGANIZATION_CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{1,15}$/

/** Codes are compared upper-cased so "acme" and "ACME" are the same tenant. */
export function normalizeOrganizationCode(value: string): string {
  return value.trim().toUpperCase()
}

export function isValidOrganizationCode(value: string): boolean {
  return ORGANIZATION_CODE_PATTERN.test(normalizeOrganizationCode(value))
}

export function slugifyOrganizationName(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'organization'
  )
}

/** Derives a default code from a name, e.g. "Acme Studios" -> "ACMESTUDIOS". */
export function suggestOrganizationCode(name: string): string {
  const compact = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 16)
  return compact.length >= 2 ? compact : ''
}

/** Case-insensitive host part of an email, without the "@". */
export function emailDomain(email: string): string {
  return email.trim().toLowerCase().split('@')[1] ?? ''
}

/**
 * An empty allow-list means "any domain". Domains are stored without the "@"
 * and subdomains are not implied — an explicit entry is required.
 */
export function isEmailDomainAllowed(
  email: string,
  allowedDomains: readonly string[]
): boolean {
  if (allowedDomains.length === 0) return true
  const domain = emailDomain(email)
  return allowedDomains.some(
    (allowed) => allowed.trim().toLowerCase().replace(/^@/, '') === domain
  )
}

export type PublicOrganizationOption = {
  id: string
  code: string
  name: string
  type: OrganizationType
  /** False when the org only accepts members created by an administrator. */
  allowSelfSignUp: boolean
}
