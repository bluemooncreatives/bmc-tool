import { type AnyBulkWriteOperation, type ObjectId } from 'mongodb'
import {
  resolveEffectiveModules,
  sanitizeModuleActions,
  sanitizeModulePermissions,
  type ModuleActionMap,
  type ModuleKey,
} from '@/lib/permissions'
import { getDesignationsCollection, type DesignationDoc } from './directory'
import {
  getOrganizationsCollection,
  type OrganizationDoc,
} from './organizations'
import { type Role } from './roles'
import { getUsersCollection, type UserDoc } from './users'

export type ResolvedAccess = {
  modulePermissions: ModuleKey[]
  moduleActions: ModuleActionMap
}

export type AccessInput = {
  role: readonly Role[] | readonly string[]
  grantedModules?: readonly string[]
  deniedModules?: readonly string[]
  grantedModuleActions?: ModuleActionMap | null
  designation?: Pick<
    DesignationDoc,
    'defaultModules' | 'defaultModuleActions'
  > | null
  organization?: Pick<OrganizationDoc, 'enabledModules'> | null
}

/**
 * Single source of truth for "what can this account actually reach".
 *
 * Grants and designation templates are merged, explicit denials are removed,
 * and the result is clipped to what the organization itself is entitled to.
 * Platform accounts are not clipped, because they are not tenants.
 */
export function resolveAccess(input: AccessInput): ResolvedAccess {
  const isPlatform = input.role.includes('superadmin')

  const modulePermissions = resolveEffectiveModules({
    role: input.role,
    grantedModules: input.grantedModules,
    designationModules: input.designation?.defaultModules,
    deniedModules: input.deniedModules,
    organizationModules: isPlatform
      ? null
      : (input.organization?.enabledModules ?? null),
  })

  // Account-level action overrides beat the designation template per module,
  // and anything the account cannot reach at all is dropped entirely.
  const fromDesignation = sanitizeModuleActions(
    input.designation?.defaultModuleActions
  )
  const fromAccount = sanitizeModuleActions(input.grantedModuleActions)
  const merged: ModuleActionMap = {}
  for (const module of modulePermissions) {
    const actions = fromAccount[module] ?? fromDesignation[module]
    if (actions?.length) merged[module] = actions
  }

  return { modulePermissions, moduleActions: merged }
}

/** Resolves a stored account against its live organization and designation. */
export async function resolveAccessForUser(
  user: Pick<
    UserDoc,
    | 'role'
    | 'grantedModules'
    | 'deniedModules'
    | 'grantedModuleActions'
    | 'organizationId'
    | 'designationId'
  >
): Promise<ResolvedAccess> {
  const organizations = await getOrganizationsCollection()
  const organization = user.organizationId
    ? await organizations.findOne({ _id: user.organizationId })
    : null

  let designation: DesignationDoc | null = null
  if (user.designationId) {
    const designations = await getDesignationsCollection()
    designation = await designations.findOne({
      _id: user.designationId,
      organizationId: user.organizationId,
    })
  }

  return resolveAccess({
    role: user.role,
    grantedModules: user.grantedModules,
    deniedModules: user.deniedModules,
    grantedModuleActions: user.grantedModuleActions,
    designation,
    organization,
  })
}

function sameModules(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  )
}

function sameActions(left: ModuleActionMap, right: ModuleActionMap) {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key) =>
      sameModules(
        left[key as ModuleKey] ?? [],
        right[key as ModuleKey] ?? []
      )
    )
  )
}

/**
 * Recomputes and persists effective access for every member of the given
 * organization. Only accounts whose result actually changed are written, and
 * those have their token version bumped so a narrowed session cannot survive.
 *
 * Called whenever an entitlement, designation template, or organization status
 * changes — the events that silently widen or narrow many accounts at once.
 */
export async function recomputeOrganizationAccess(
  organizationId: ObjectId
): Promise<number> {
  const organizations = await getOrganizationsCollection()
  const organization = await organizations.findOne({ _id: organizationId })
  if (!organization) return 0

  const designations = await getDesignationsCollection()
  const designationById = new Map<string, DesignationDoc>()
  for (const designation of await designations
    .find({ organizationId })
    .toArray()) {
    designationById.set(designation._id.toHexString(), designation)
  }

  const users = await getUsersCollection()
  const members = await users.find({ organizationId }).toArray()
  const operations: AnyBulkWriteOperation<UserDoc>[] = []

  for (const member of members) {
    const resolved = resolveAccess({
      role: member.role,
      grantedModules: member.grantedModules,
      deniedModules: member.deniedModules,
      grantedModuleActions: member.grantedModuleActions,
      designation: member.designationId
        ? (designationById.get(member.designationId.toHexString()) ?? null)
        : null,
      organization,
    })

    const currentModules = sanitizeModulePermissions(member.modulePermissions)
    const currentActions = sanitizeModuleActions(member.moduleActions)
    if (
      sameModules(currentModules, resolved.modulePermissions) &&
      sameActions(currentActions, resolved.moduleActions)
    ) {
      continue
    }

    operations.push({
      updateOne: {
        filter: { _id: member._id },
        update: {
          $set: {
            modulePermissions: resolved.modulePermissions,
            moduleActions: resolved.moduleActions,
            updatedAt: new Date(),
          },
          $inc: { tokenVersion: 1 },
        },
      },
    })
  }

  if (operations.length === 0) return 0
  await users.bulkWrite(operations, { ordered: false })
  return operations.length
}

/** Narrower variant used after a designation's module template is edited. */
export async function recomputeDesignationHolders(
  organizationId: ObjectId,
  designationId: ObjectId
): Promise<number> {
  const organizations = await getOrganizationsCollection()
  const organization = await organizations.findOne({ _id: organizationId })
  if (!organization) return 0

  const designations = await getDesignationsCollection()
  const designation = await designations.findOne({
    _id: designationId,
    organizationId,
  })

  const users = await getUsersCollection()
  const holders = await users.find({ organizationId, designationId }).toArray()
  const operations: AnyBulkWriteOperation<UserDoc>[] = []

  for (const holder of holders) {
    const resolved = resolveAccess({
      role: holder.role,
      grantedModules: holder.grantedModules,
      deniedModules: holder.deniedModules,
      grantedModuleActions: holder.grantedModuleActions,
      designation,
      organization,
    })

    if (
      sameModules(
        sanitizeModulePermissions(holder.modulePermissions),
        resolved.modulePermissions
      ) &&
      sameActions(
        sanitizeModuleActions(holder.moduleActions),
        resolved.moduleActions
      )
    ) {
      continue
    }

    operations.push({
      updateOne: {
        filter: { _id: holder._id },
        update: {
          $set: {
            modulePermissions: resolved.modulePermissions,
            moduleActions: resolved.moduleActions,
            designationTitle: designation?.title,
            updatedAt: new Date(),
          },
          $inc: { tokenVersion: 1 },
        },
      },
    })
  }

  if (operations.length === 0) return 0
  await users.bulkWrite(operations, { ordered: false })
  return operations.length
}
