import { type ObjectId } from 'mongodb'
import { SEAT_CONSUMING_STATUSES } from './account-provisioning'
import {
  type OrganizationDoc,
  type OrganizationStats,
} from './organizations'
import { getUsersCollection } from './users'

type StatsRow = {
  _id: ObjectId
  totalMembers: number
  activeMembers: number
  pendingMembers: number
  suspendedMembers: number
  admins: number
  seatsUsed: number
}

/**
 * One aggregation for every organization on screen, keyed by id. Counting per
 * row would issue a query per organization and dominate the listing's cost.
 */
export async function getOrganizationStats(
  organizations: readonly OrganizationDoc[]
): Promise<Map<string, OrganizationStats>> {
  const stats = new Map<string, OrganizationStats>()
  if (organizations.length === 0) return stats

  const users = await getUsersCollection()
  const rows = (await users
    .aggregate([
      {
        $match: {
          organizationId: { $in: organizations.map((org) => org._id) },
        },
      },
      {
        $group: {
          _id: '$organizationId',
          totalMembers: { $sum: 1 },
          activeMembers: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
          },
          pendingMembers: {
            $sum: {
              $cond: [{ $in: ['$status', ['pending', 'invited']] }, 1, 0],
            },
          },
          suspendedMembers: {
            $sum: { $cond: [{ $eq: ['$status', 'suspended'] }, 1, 0] },
          },
          admins: {
            $sum: {
              $cond: [
                { $in: ['org_admin', { $ifNull: ['$role', []] }] },
                1,
                0,
              ],
            },
          },
          seatsUsed: {
            $sum: {
              $cond: [
                { $in: ['$status', [...SEAT_CONSUMING_STATUSES]] },
                1,
                0,
              ],
            },
          },
        },
      },
    ])
    .toArray()) as StatsRow[]

  const byId = new Map(rows.map((row) => [row._id.toHexString(), row]))

  for (const organization of organizations) {
    const key = organization._id.toHexString()
    const row = byId.get(key)
    const seatLimit = organization.settings?.seatLimit ?? null
    stats.set(key, {
      totalMembers: row?.totalMembers ?? 0,
      activeMembers: row?.activeMembers ?? 0,
      pendingMembers: row?.pendingMembers ?? 0,
      suspendedMembers: row?.suspendedMembers ?? 0,
      admins: row?.admins ?? 0,
      seatsRemaining:
        seatLimit === null
          ? null
          : Math.max(0, seatLimit - (row?.seatsUsed ?? 0)),
    })
  }

  return stats
}
