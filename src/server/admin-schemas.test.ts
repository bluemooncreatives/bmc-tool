import { describe, expect, it } from 'vitest'
import { updateAccountSchema } from './admin-schemas'

describe('account timezone validation', () => {
  const base = { expectedUpdatedAt: '2026-08-13T00:00:00.000Z' }

  it('accepts empty and valid IANA timezones', () => {
    expect(
      updateAccountSchema.safeParse({ ...base, timezone: '' }).success
    ).toBe(true)
    expect(
      updateAccountSchema.safeParse({ ...base, timezone: 'Asia/Kolkata' })
        .success
    ).toBe(true)
    expect(
      updateAccountSchema.safeParse({ ...base, timezone: 'America/New_York' })
        .success
    ).toBe(true)
  })

  it('rejects arbitrary timezone strings at the API boundary', () => {
    const result = updateAccountSchema.safeParse({
      ...base,
      timezone: 'India Standard',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        'Select a valid IANA timezone.'
      )
    }
  })
})
