import { type Collection, ObjectId } from 'mongodb'
import {
  DEFAULT_MEMBER_MODULES,
  ORG_ADMIN_BASELINE_MODULES,
  sanitizeModuleActions,
  sanitizeModulePermissions,
  type ModuleActionMap,
  type ModuleKey,
} from '@/lib/permissions'
import { getDb } from './mongodb'

/**
 * Departments and designations are the two dimensions of an organization's
 * structure: a department is *where* someone sits, a designation is *what they
 * are* and which module template they inherit.
 */

export type DepartmentDoc = {
  _id: ObjectId
  organizationId: ObjectId
  name: string
  code?: string
  description?: string
  /** Departments nest, which is what draws the org chart's upper levels. */
  parentDepartmentId?: ObjectId
  headUserId?: ObjectId
  createdBy?: ObjectId
  createdAt: Date
  updatedAt: Date
}

export type DesignationDoc = {
  _id: ObjectId
  organizationId: ObjectId
  title: string
  code?: string
  /** 1 = most senior. Used to order the org chart and to gate promotions. */
  level: number
  departmentId?: ObjectId
  description?: string
  /** Module template every holder of this designation inherits. */
  defaultModules: ModuleKey[]
  defaultModuleActions?: ModuleActionMap
  /** Applied to new members of the organization when nothing else is chosen. */
  isDefault?: boolean
  createdBy?: ObjectId
  createdAt: Date
  updatedAt: Date
}

export type PublicDepartment = {
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

export type PublicDesignation = {
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

export function toPublicDepartment(
  department: DepartmentDoc,
  memberCount?: number
): PublicDepartment {
  return {
    id: department._id.toHexString(),
    organizationId: department.organizationId.toHexString(),
    name: department.name,
    code: department.code ?? '',
    description: department.description ?? '',
    parentDepartmentId: department.parentDepartmentId?.toHexString() ?? null,
    headUserId: department.headUserId?.toHexString() ?? null,
    createdAt: department.createdAt.toISOString(),
    updatedAt: department.updatedAt.toISOString(),
    ...(memberCount === undefined ? {} : { memberCount }),
  }
}

export function toPublicDesignation(
  designation: DesignationDoc,
  memberCount?: number
): PublicDesignation {
  return {
    id: designation._id.toHexString(),
    organizationId: designation.organizationId.toHexString(),
    title: designation.title,
    code: designation.code ?? '',
    level: designation.level,
    departmentId: designation.departmentId?.toHexString() ?? null,
    description: designation.description ?? '',
    defaultModules: sanitizeModulePermissions(designation.defaultModules),
    defaultModuleActions: sanitizeModuleActions(
      designation.defaultModuleActions
    ),
    isDefault: Boolean(designation.isDefault),
    createdAt: designation.createdAt.toISOString(),
    updatedAt: designation.updatedAt.toISOString(),
    ...(memberCount === undefined ? {} : { memberCount }),
  }
}

let departmentsReady: Promise<void> | undefined
let designationsReady: Promise<void> | undefined

export async function getDepartmentsCollection(): Promise<
  Collection<DepartmentDoc>
> {
  const db = await getDb()
  const departments = db.collection<DepartmentDoc>('departments')

  if (!departmentsReady) {
    departmentsReady = Promise.all([
      departments.createIndex({ organizationId: 1, name: 1 }, { unique: true }),
      departments.createIndex({ organizationId: 1, parentDepartmentId: 1 }),
    ])
      .then(() => undefined)
      .catch((error) => {
        departmentsReady = undefined
        throw error
      })
  }
  await departmentsReady

  return departments
}

export async function getDesignationsCollection(): Promise<
  Collection<DesignationDoc>
> {
  const db = await getDb()
  const designations = db.collection<DesignationDoc>('designations')

  if (!designationsReady) {
    designationsReady = Promise.all([
      designations.createIndex(
        { organizationId: 1, title: 1 },
        { unique: true }
      ),
      designations.createIndex({ organizationId: 1, level: 1 }),
    ])
      .then(() => undefined)
      .catch((error) => {
        designationsReady = undefined
        throw error
      })
  }
  await designationsReady

  return designations
}

export async function findDesignation(
  organizationId: ObjectId,
  designationId: ObjectId
): Promise<DesignationDoc | null> {
  const designations = await getDesignationsCollection()
  // Scoped by organization so a leaked id from another tenant resolves to null.
  return designations.findOne({ _id: designationId, organizationId })
}

export async function findDepartment(
  organizationId: ObjectId,
  departmentId: ObjectId
): Promise<DepartmentDoc | null> {
  const departments = await getDepartmentsCollection()
  return departments.findOne({ _id: departmentId, organizationId })
}

/** The starter ladder every new organization is created with. */
const DESIGNATION_TEMPLATE: readonly {
  title: string
  code: string
  level: number
  description: string
  modules: readonly ModuleKey[]
  isDefault?: boolean
}[] = [
  {
    title: 'Organization Admin',
    code: 'ORG-ADMIN',
    level: 1,
    description:
      'Runs the organization: manages accounts, designations, and module access.',
    modules: ORG_ADMIN_BASELINE_MODULES,
  },
  {
    title: 'Manager',
    code: 'MGR',
    level: 2,
    description: 'Leads a team and owns delivery for their area.',
    modules: [
      'home',
      'tasks',
      'tasks_active',
      'schedule',
      'plans',
      'reports_analytics',
      ...DEFAULT_MEMBER_MODULES,
    ],
  },
  {
    title: 'Team Member',
    code: 'MEMBER',
    level: 3,
    description: 'Delivers assigned work.',
    modules: ['home', 'tasks_active', ...DEFAULT_MEMBER_MODULES],
    isDefault: true,
  },
]

/**
 * Seeds the starter designations for a freshly created organization. Existing
 * titles are left untouched, so re-running this is safe.
 */
export async function seedDefaultDesignations(input: {
  organizationId: ObjectId
  enabledModules: readonly ModuleKey[]
  createdBy?: ObjectId
}): Promise<void> {
  const designations = await getDesignationsCollection()
  const now = new Date()
  const ceiling = new Set(sanitizeModulePermissions(input.enabledModules))

  await Promise.all(
    DESIGNATION_TEMPLATE.map((template) =>
      designations.updateOne(
        { organizationId: input.organizationId, title: template.title },
        {
          $setOnInsert: {
            _id: new ObjectId(),
            organizationId: input.organizationId,
            title: template.title,
            code: template.code,
            level: template.level,
            description: template.description,
            defaultModules: sanitizeModulePermissions(
              template.modules.filter((module) => ceiling.has(module))
            ),
            isDefault: Boolean(template.isDefault),
            createdBy: input.createdBy,
            createdAt: now,
            updatedAt: now,
          },
        },
        { upsert: true }
      )
    )
  )
}

/**
 * Walks up the department parent chain to prove `candidateParent` is not a
 * descendant of `departmentId`. Without this an admin could point a department
 * at its own child and make the org chart infinitely deep.
 */
export async function wouldCreateDepartmentCycle(input: {
  organizationId: ObjectId
  departmentId: ObjectId
  candidateParentId: ObjectId
}): Promise<boolean> {
  if (input.departmentId.equals(input.candidateParentId)) return true

  const departments = await getDepartmentsCollection()
  const seen = new Set<string>([input.departmentId.toHexString()])
  let cursor: ObjectId | undefined = input.candidateParentId

  while (cursor) {
    const key = cursor.toHexString()
    if (seen.has(key)) return true
    seen.add(key)

    const parent: DepartmentDoc | null = await departments.findOne(
      { _id: cursor, organizationId: input.organizationId },
      { projection: { parentDepartmentId: 1 } }
    )
    cursor = parent?.parentDepartmentId
  }

  return false
}
