import { describe, expect, it } from 'vitest'
import {
  dateOnlyToLocalDate,
  isSupportedLanguage,
  isValidDateOfBirth,
  localDateToDateOnly,
} from './account-profile'

describe('account profile helpers', () => {
  it('validates real, non-future calendar dates', () => {
    const today = new Date(2026, 7, 12)
    expect(isValidDateOfBirth('2000-02-29', today)).toBe(true)
    expect(isValidDateOfBirth('2001-02-29', today)).toBe(false)
    expect(isValidDateOfBirth('2026-08-13', today)).toBe(false)
    expect(isValidDateOfBirth('1899-12-31', today)).toBe(false)
  })

  it('round-trips date-only values without timezone drift', () => {
    const value = '1995-06-15'
    expect(localDateToDateOnly(dateOnlyToLocalDate(value))).toBe(value)
  })

  it('accepts only supported language identifiers', () => {
    expect(isSupportedLanguage('en')).toBe(true)
    expect(isSupportedLanguage('xx')).toBe(false)
  })
})
