import { type Collection, ObjectId } from 'mongodb'
import {
  DEFAULT_MEMBER_MODULES,
  DEFAULT_ORGANIZATION_MODULES,
  sanitizeModulePermissions,
  sanitizeOrganizationModules,
  type ModuleKey,
} from '@/lib/permissions'
import {
  INTERNAL_ORGANIZATION_CODE,
  normalizeOrganizationCode,
  slugifyOrganizationName,
  type BillingPlan,
  type OrganizationSize,
  type OrganizationStatus,
  type OrganizationType,
} from '@/lib/organizations'
import { getSuperadminEmail } from './env'
import { getDb } from './mongodb'

export type OrganizationAddress = {
  line1?: string
  line2?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
}

export type OrganizationSettings = {
  /** When false, the organization never appears on the public sign-up page. */
  allowSelfSignUp: boolean
  /** Self-registered accounts land as `pending` until an admin approves. */
  requireAdminApproval: boolean
  /** Empty means any email domain may join. Stored without the leading "@". */
  allowedEmailDomains: string[]
  /** Forces email MFA for every member of the organization. */
  enforceMfa: boolean
  /** Hard ceiling on non-archived accounts. `null` means unlimited. */
  seatLimit: number | null
}

export type OrganizationBilling = {
  plan: BillingPlan
  currency?: string
  renewalAt?: Date
  taxId?: string
  notes?: string
}

export type OrganizationDoc = {
  _id: ObjectId
  /** Upper-cased tenant code. Unique, and used at sign-up and in emails. */
  code: string
  name: string
  /** Lower-cased unique key derived from the name. */
  slug: string
  type: OrganizationType
  status: OrganizationStatus
  description?: string
  industry?: string
  size?: OrganizationSize
  website?: string
  logoUrl?: string
  contactEmail?: string
  contactPhone?: string
  address?: OrganizationAddress
  billing: OrganizationBilling
  /** The ceiling of modules any member of this organization may hold. */
  enabledModules: ModuleKey[]
  /** Applied to accounts created inside the organization with no designation. */
  defaultMemberModules: ModuleKey[]
  settings: OrganizationSettings
  primaryAdminId?: ObjectId
  /** Blue Moon Creatives' own tenant. Never deletable, never suspendable. */
  isSystemOrg: boolean
  createdBy?: ObjectId
  createdAt: Date
  updatedAt: Date
  archivedAt?: Date
}

export type PublicOrganization = {
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
  address: Required<OrganizationAddress>
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
  /** Populated by the listing endpoints; absent on writes. */
  stats?: OrganizationStats
}

export type OrganizationStats = {
  totalMembers: number
  activeMembers: number
  pendingMembers: number
  suspendedMembers: number
  admins: number
  seatsRemaining: number | null
}

export const EMPTY_ADDRESS: Required<OrganizationAddress> = {
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
}

export function defaultOrganizationSettings(): OrganizationSettings {
  return {
    allowSelfSignUp: false,
    requireAdminApproval: true,
    allowedEmailDomains: [],
    enforceMfa: false,
    seatLimit: null,
  }
}

export function toPublicOrganization(
  organization: OrganizationDoc,
  stats?: OrganizationStats
): PublicOrganization {
  const settings = { ...defaultOrganizationSettings(), ...organization.settings }
  return {
    id: organization._id.toHexString(),
    code: organization.code,
    name: organization.name,
    slug: organization.slug,
    type: organization.type,
    status: organization.status,
    description: organization.description ?? '',
    industry: organization.industry ?? '',
    size: organization.size ?? '',
    website: organization.website ?? '',
    logoUrl: organization.logoUrl ?? '',
    contactEmail: organization.contactEmail ?? '',
    contactPhone: organization.contactPhone ?? '',
    address: { ...EMPTY_ADDRESS, ...organization.address },
    billing: {
      plan: organization.billing?.plan ?? 'trial',
      currency: organization.billing?.currency ?? '',
      renewalAt: organization.billing?.renewalAt?.toISOString() ?? null,
      taxId: organization.billing?.taxId ?? '',
      notes: organization.billing?.notes ?? '',
    },
    enabledModules: sanitizeOrganizationModules(organization.enabledModules),
    defaultMemberModules: sanitizeModulePermissions(
      organization.defaultMemberModules
    ),
    settings,
    primaryAdminId: organization.primaryAdminId?.toHexString() ?? null,
    isSystemOrg: Boolean(organization.isSystemOrg),
    createdAt: organization.createdAt.toISOString(),
    updatedAt: organization.updatedAt.toISOString(),
    archivedAt: organization.archivedAt?.toISOString() ?? null,
    ...(stats ? { stats } : {}),
  }
}

let collectionReady: Promise<void> | undefined

async function prepareOrganizationsCollection(
  organizations: Collection<OrganizationDoc>
): Promise<void> {
  await Promise.all([
    organizations.createIndex({ code: 1 }, { unique: true }),
    organizations.createIndex({ slug: 1 }, { unique: true }),
    organizations.createIndex({ status: 1, name: 1 }),
  ])

  const now = new Date()

  // The internal tenant is seeded before any user document is touched, so the
  // owner and every legacy account always have an organization to belong to.
  await organizations.updateOne(
    { code: INTERNAL_ORGANIZATION_CODE },
    {
      $setOnInsert: {
        _id: new ObjectId(),
        code: INTERNAL_ORGANIZATION_CODE,
        name: 'Blue Moon Creatives',
        slug: slugifyOrganizationName('Blue Moon Creatives'),
        type: 'internal' as OrganizationType,
        description:
          'The Blue Moon Creatives internal workspace. Home of the platform team.',
        contactEmail: getSuperadminEmail(),
        billing: { plan: 'internal' as BillingPlan },
        defaultMemberModules: [...DEFAULT_MEMBER_MODULES],
        createdAt: now,
      },
      $set: {
        status: 'active' as OrganizationStatus,
        isSystemOrg: true,
        enabledModules: [...DEFAULT_ORGANIZATION_MODULES],
        updatedAt: now,
      },
    },
    { upsert: true }
  )
}

export async function getOrganizationsCollection(): Promise<
  Collection<OrganizationDoc>
> {
  const db = await getDb()
  const organizations = db.collection<OrganizationDoc>('organizations')

  if (!collectionReady) {
    collectionReady = prepareOrganizationsCollection(organizations).catch(
      (error) => {
        collectionReady = undefined
        throw error
      }
    )
  }
  await collectionReady

  return organizations
}

export async function getInternalOrganization(): Promise<OrganizationDoc> {
  const organizations = await getOrganizationsCollection()
  const internal = await organizations.findOne({
    code: INTERNAL_ORGANIZATION_CODE,
  })
  if (!internal) {
    // prepareOrganizationsCollection upserts it, so this only happens if the
    // document was deleted out from under the app.
    throw new Error('The internal organization is missing from the database.')
  }
  return internal
}

export function parseOrganizationId(value: unknown): ObjectId | null {
  return typeof value === 'string' && ObjectId.isValid(value)
    ? new ObjectId(value)
    : null
}

export async function findOrganizationById(
  id: ObjectId | string
): Promise<OrganizationDoc | null> {
  const objectId = typeof id === 'string' ? parseOrganizationId(id) : id
  if (!objectId) return null
  const organizations = await getOrganizationsCollection()
  return organizations.findOne({ _id: objectId })
}

export async function findOrganizationByCode(
  code: string
): Promise<OrganizationDoc | null> {
  const organizations = await getOrganizationsCollection()
  return organizations.findOne({ code: normalizeOrganizationCode(code) })
}

/**
 * Appends a numeric suffix until the slug is free. The organization name is
 * user supplied, so collisions are expected rather than exceptional.
 */
export async function reserveOrganizationSlug(
  name: string,
  excludeId?: ObjectId
): Promise<string> {
  const organizations = await getOrganizationsCollection()
  const base = slugifyOrganizationName(name)

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`
    const existing = await organizations.findOne(
      { slug: candidate },
      { projection: { _id: 1 } }
    )
    if (!existing || (excludeId && existing._id.equals(excludeId))) {
      return candidate
    }
  }

  return `${base}-${new ObjectId().toHexString().slice(-6)}`
}
