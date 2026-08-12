export function urlMatches(currentHref: string, targetHref: string): boolean {
  const current = new URL(currentHref, 'http://sidebar.local')
  const target = new URL(targetHref, 'http://sidebar.local')
  if (
    current.pathname.replace(/\/$/, '') !== target.pathname.replace(/\/$/, '')
  ) {
    return false
  }

  const expectedSearch = [...target.searchParams.entries()]
  if (expectedSearch.length === 0) {
    // Pagination and table filters keep their section active. A named view is
    // a distinct sibling subsection and must not activate the base link.
    return !current.searchParams.has('view')
  }
  return expectedSearch.every(
    ([key, value]) => current.searchParams.get(key) === value
  )
}
