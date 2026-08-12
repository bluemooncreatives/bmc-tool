import { describe, expect, it } from 'vitest'
import {
  formatTimeZoneLabel,
  getSupportedTimeZones,
  isValidTimeZone,
} from './timezones'

describe('timezones', () => {
  it('returns the runtime IANA directory with UTC and no duplicates', () => {
    const timeZones = getSupportedTimeZones()
    expect(timeZones).toContain('UTC')
    expect(timeZones.length).toBeGreaterThan(300)
    expect(new Set(timeZones).size).toBe(timeZones.length)
    expect(timeZones).toEqual([...timeZones].sort((a, b) => a.localeCompare(b)))
  })

  it('preserves a valid stored alias even when the runtime omits it', () => {
    expect(getSupportedTimeZones('Asia/Kolkata')).toContain('Asia/Kolkata')
  })

  it('rejects invented values and accepts IANA zones', () => {
    expect(isValidTimeZone('America/New_York')).toBe(true)
    expect(isValidTimeZone('Asia/Kolkata')).toBe(true)
    expect(isValidTimeZone('Mars/Olympus_Mons')).toBe(false)
    expect(isValidTimeZone('')).toBe(false)
  })

  it('formats underscores without changing the stored identifier', () => {
    expect(formatTimeZoneLabel('America/New_York')).toBe('America/New York')
  })
})
