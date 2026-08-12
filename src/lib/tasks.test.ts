import { describe, expect, it } from 'vitest'
import { isTaskActive, normalizeTaskStatus } from './tasks'

describe('active task classification', () => {
  it.each(['done', 'Done', ' completed ', 'complete', 'canceled', 'cancelled'])(
    'treats %s as terminal',
    (status) => expect(isTaskActive(status)).toBe(false)
  )

  it.each(['backlog', 'todo', 'in progress', 'blocked', 'custom status'])(
    'treats %s as active',
    (status) => expect(isTaskActive(status)).toBe(true)
  )

  it('normalizes whitespace, underscores, and hyphens consistently', () => {
    expect(normalizeTaskStatus('  In_Progress  ')).toBe('in progress')
    expect(normalizeTaskStatus('Awaiting--Review')).toBe('awaiting review')
  })
})
