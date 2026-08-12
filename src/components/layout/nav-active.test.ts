import { describe, expect, it } from 'vitest'
import { urlMatches } from './nav-active'

describe('sidebar subsection matching', () => {
  it('keeps All Tasks active across pagination and filters', () => {
    expect(urlMatches('/tasks?page=2&status=todo', '/tasks')).toBe(true)
  })

  it('activates only Active Tasks when the named view is present', () => {
    const current = '/tasks?view=active&page=2&filter=launch'
    expect(urlMatches(current, '/tasks?view=active')).toBe(true)
    expect(urlMatches(current, '/tasks')).toBe(false)
  })

  it('does not match unrelated paths or named views', () => {
    expect(urlMatches('/leads', '/tasks')).toBe(false)
    expect(urlMatches('/tasks?view=archive', '/tasks?view=active')).toBe(false)
  })
})
