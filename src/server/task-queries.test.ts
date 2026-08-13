import { type ObjectId } from 'mongodb'
import { describe, expect, it } from 'vitest'
import { isTaskActive, TERMINAL_TASK_STATUS_KEYS } from '@/lib/tasks'
import {
  activeTaskFilter,
  organizationTaskFilter,
  statusFields,
} from './task-queries'

// The builders only embed the value, so a stand-in avoids importing the driver.
const organizationId = { id: 'org' } as unknown as ObjectId

describe('statusFields', () => {
  it('stores the display text and its normalized key together', () => {
    expect(statusFields('  In_Progress ')).toEqual({
      status: '  In_Progress ',
      statusKey: 'in progress',
    })
  })
})

describe('organizationTaskFilter', () => {
  it('scopes to the tenant and excludes soft-deleted tasks', () => {
    expect(organizationTaskFilter(organizationId)).toEqual({
      organizationId,
      deletedAt: null,
    })
  })

  it('narrows to open work with an indexable equality test', () => {
    expect(organizationTaskFilter(organizationId, 'active')).toEqual({
      organizationId,
      deletedAt: null,
      statusKey: { $nin: [...TERMINAL_TASK_STATUS_KEYS] },
    })
    // A negated regex would force a collection scan; $nin can use the index.
    expect(JSON.stringify(activeTaskFilter())).not.toContain('$not')
  })
})

describe('server and client agree on liveness', () => {
  // The previous filter tested a raw regex against display text while the
  // client normalized first, so padding and separators split the two.
  it.each([
    [' Done ', false],
    ['CANCELED', false],
    ['complete', false],
    ['in_progress', true],
    ['Backlog', true],
  ])('%s', (status, expectedActive) => {
    const terminal = new Set<string>(TERMINAL_TASK_STATUS_KEYS)
    const serverSaysActive = !terminal.has(statusFields(status).statusKey)

    expect(serverSaysActive).toBe(expectedActive)
    expect(isTaskActive(status)).toBe(expectedActive)
  })
})
