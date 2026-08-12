import { ObjectId } from 'mongodb'
import {
  isSuperadmin,
  sanitizeModulePermissions,
  sanitizeOrganizationModules,
  type ModuleKey,
} from '@/lib/permissions'
import { AuthorizationError } from './authorization'
import {
  findDepartment,
  findDesignation,
  type DepartmentDoc,
  type DesignationDoc,
} from './directory'
import { wouldCreateReportingCycle } from './org-chart'
import { type OrganizationDoc } from './organizations'
import { getUsersCollection, type UserDoc } from './users'

/**
 * Clips a requested module set to what the tenant owns and to what the acting
 * administrator holds themselves.
 *
 * The second rule is the privilege-escalation guard: without it an
 * organization administrator could grant a subordinate a module the Super
 * Admin deliberately withheld from the administrator.
 */
export function assertGrantableModules(input: {
  actor: UserDoc
  organization: Pick<OrganizationDoc, 'name' | 'enabledModules'>
  requested: readonly string[]
}): ModuleKey[] {
  const requested = sanitizeModulePermissions(input.requested)
  const enabled = new Set(
    sanitizeOrganizationModules(input.organization.enabledModules)
  )

  const beyondEntitlement = requested.filter((module) => !enabled.has(module))
  if (beyondEntitlement.length > 0) {
    throw new AuthorizationError(
      `${input.organization.name} is not entitled to: ${beyondEntitlement.join(', ')}. Update the organization's modules first.`,
      403
    )
  }

  if (!isSuperadmin(input.actor)) {
    const own = new Set(sanitizeModulePermissions(input.actor.modulePermissions))
    const escalation = requested.filter((module) => !own.has(module))
    if (escalation.length > 0) {
      throw new AuthorizationError(
        `You cannot grant access you do not hold yourself: ${escalation.join(', ')}.`,
        403
      )
    }
  }

  return requested
}

export type ResolvedPlacement = {
  designation: DesignationDoc | null
  department: DepartmentDoc | null
  manager: UserDoc | null
}

/**
 * Validates that a designation, department, and manager all belong to the same
 * organization as the account being placed, and that the reporting line stays
 * acyclic. Ids from another tenant resolve to "not found" rather than leaking
 * that the record exists.
 */
export async function resolvePlacement(input: {
  organizationId: ObjectId
  designationId?: string | null
  departmentId?: string | null
  managerId?: string | null
  /** Present when editing, so the account cannot be made its own manager. */
  accountId?: ObjectId
}): Promise<ResolvedPlacement> {
  const result: ResolvedPlacement = {
    designation: null,
    department: null,
    manager: null,
  }

  if (input.designationId) {
    if (!ObjectId.isValid(input.designationId)) {
      throw new AuthorizationError('That designation does not exist.', 404)
    }
    result.designation = await findDesignation(
      input.organizationId,
      new ObjectId(input.designationId)
    )
    if (!result.designation) {
      throw new AuthorizationError('That designation does not exist.', 404)
    }
  }

  if (input.departmentId) {
    if (!ObjectId.isValid(input.departmentId)) {
      throw new AuthorizationError('That department does not exist.', 404)
    }
    result.department = await findDepartment(
      input.organizationId,
      new ObjectId(input.departmentId)
    )
    if (!result.department) {
      throw new AuthorizationError('That department does not exist.', 404)
    }
  }

  if (input.managerId) {
    if (!ObjectId.isValid(input.managerId)) {
      throw new AuthorizationError('That manager does not exist.', 404)
    }
    const managerId = new ObjectId(input.managerId)
    const users = await getUsersCollection()
    result.manager = await users.findOne({
      _id: managerId,
      organizationId: input.organizationId,
    })
    if (!result.manager) {
      throw new AuthorizationError(
        'The chosen manager is not part of this organization.',
        404
      )
    }

    if (input.accountId) {
      if (input.accountId.equals(managerId)) {
        throw new AuthorizationError(
          'An account cannot report to itself.',
          403
        )
      }
      const cycle = await wouldCreateReportingCycle({
        organizationId: input.organizationId,
        userId: input.accountId,
        managerId,
      })
      if (cycle) {
        throw new AuthorizationError(
          'That reporting line would create a loop in the org chart.',
          403
        )
      }
    }
  }

  return result
}

/**
 * An organization must keep at least one administrator who can still sign in,
 * or the tenant becomes unmanageable without Super Admin intervention.
 */
export async function assertNotLastActiveAdmin(input: {
  organizationId: ObjectId
  accountId: ObjectId
  action: string
}): Promise<void> {
  const users = await getUsersCollection()
  const remaining = await users.countDocuments({
    organizationId: input.organizationId,
    _id: { $ne: input.accountId },
    role: 'org_admin',
    status: 'active',
  })

  if (remaining === 0) {
    throw new AuthorizationError(
      `This is the only active administrator in the organization. Promote another administrator before you ${input.action} this one.`,
      403
    )
  }
}
