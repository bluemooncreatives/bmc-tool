import { type ObjectId } from 'mongodb'
import { primaryRole, type Role, type UserStatus } from './roles'
import { getUsersCollection, getUserDisplayName, type UserDoc } from './users'

export type OrgChartNode = {
  id: string
  name: string
  email: string
  role: Role
  status: UserStatus
  designationTitle: string
  departmentName: string
  jobTitle: string
  managerId: string | null
  /** Every account below this one, not just direct reports. */
  totalReports: number
  children: OrgChartNode[]
}

export type OrgChart = {
  organizationId: string
  roots: OrgChartNode[]
  /** Accounts whose manager is missing or outside the organization. */
  detached: OrgChartNode[]
  totals: {
    accounts: number
    admins: number
    active: number
    withoutManager: number
    maxDepth: number
  }
}

function toNode(user: UserDoc): OrgChartNode {
  return {
    id: user._id.toHexString(),
    name: getUserDisplayName(user),
    email: user.email,
    role: primaryRole(user.role),
    status: user.status ?? 'active',
    designationTitle: user.designationTitle ?? '',
    departmentName: user.departmentName ?? '',
    jobTitle: user.jobTitle ?? '',
    managerId: user.managerId?.toHexString() ?? null,
    totalReports: 0,
    children: [],
  }
}

function sortNodes(nodes: OrgChartNode[]): OrgChartNode[] {
  return nodes.sort(
    (left, right) =>
      Number(right.role === 'org_admin') - Number(left.role === 'org_admin') ||
      left.name.localeCompare(right.name)
  )
}

/**
 * Counts descendants and depth in one pass. The visited set means a reporting
 * cycle that predates cycle checking renders as a finite tree instead of
 * hanging the request.
 */
function finalize(
  node: OrgChartNode,
  depth: number,
  visited: Set<string>
): { reports: number; depth: number } {
  if (visited.has(node.id)) {
    node.children = []
    return { reports: 0, depth }
  }
  visited.add(node.id)

  let reports = 0
  let deepest = depth
  for (const child of sortNodes(node.children)) {
    const result = finalize(child, depth + 1, visited)
    reports += result.reports + 1
    deepest = Math.max(deepest, result.depth)
  }

  node.totalReports = reports
  return { reports, depth: deepest }
}

/** Builds the reporting tree for one organization. */
export async function buildOrgChart(
  organizationId: ObjectId
): Promise<OrgChart> {
  const users = await getUsersCollection()
  const members = await users
    .find({ organizationId })
    .sort({ email: 1 })
    .limit(5_000)
    .toArray()

  const nodes = new Map<string, OrgChartNode>()
  for (const member of members) {
    nodes.set(member._id.toHexString(), toNode(member))
  }

  const roots: OrgChartNode[] = []
  const detached: OrgChartNode[] = []

  for (const node of nodes.values()) {
    if (!node.managerId) {
      roots.push(node)
      continue
    }
    const manager = nodes.get(node.managerId)
    if (!manager) {
      // The manager left the organization; surface the account rather than
      // dropping it silently out of the chart.
      detached.push(node)
      continue
    }
    manager.children.push(node)
  }

  const visited = new Set<string>()
  let maxDepth = 0
  for (const root of sortNodes(roots)) {
    maxDepth = Math.max(maxDepth, finalize(root, 1, visited).depth)
  }
  for (const node of sortNodes(detached)) {
    finalize(node, 1, visited)
  }

  return {
    organizationId: organizationId.toHexString(),
    roots: sortNodes(roots),
    detached: sortNodes(detached),
    totals: {
      accounts: members.length,
      admins: members.filter((member) => member.role.includes('org_admin'))
        .length,
      active: members.filter((member) => (member.status ?? 'active') === 'active')
        .length,
      withoutManager: roots.length,
      maxDepth,
    },
  }
}

/**
 * Walks up the proposed manager's chain looking for the account being edited.
 * Without this, two accounts can be made to report to each other and the chart
 * — plus every traversal built on it — never terminates.
 */
export async function wouldCreateReportingCycle(input: {
  organizationId: ObjectId
  userId: ObjectId
  managerId: ObjectId
}): Promise<boolean> {
  if (input.userId.equals(input.managerId)) return true

  const users = await getUsersCollection()
  const seen = new Set<string>([input.userId.toHexString()])
  let cursor: ObjectId | undefined = input.managerId

  while (cursor) {
    const key = cursor.toHexString()
    if (seen.has(key)) return true
    seen.add(key)

    const manager: Pick<UserDoc, 'managerId'> | null = await users.findOne(
      { _id: cursor, organizationId: input.organizationId },
      { projection: { managerId: 1 } }
    )
    cursor = manager?.managerId
  }

  return false
}
