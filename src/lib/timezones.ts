const UNIVERSAL_TIME_ZONE = 'UTC'

export function isValidTimeZone(value: string): boolean {
  const candidate = value.trim()
  if (!candidate) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format()
    return true
  } catch {
    return false
  }
}

export function getSupportedTimeZones(current = ''): string[] {
  const supported =
    typeof Intl.supportedValuesOf === 'function'
      ? Intl.supportedValuesOf('timeZone')
      : []
  const zones = new Set([UNIVERSAL_TIME_ZONE, ...supported])
  if (isValidTimeZone(current)) zones.add(current.trim())
  return [...zones].sort((left, right) => left.localeCompare(right))
}

export function formatTimeZoneLabel(timeZone: string): string {
  return timeZone.replaceAll('_', ' ')
}
