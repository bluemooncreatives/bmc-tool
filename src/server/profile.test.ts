import { describe, expect, it } from 'vitest'
import {
  profileUpdateSchema,
  serializeProfile,
  usernameAvailableAt,
  usernameSchema,
} from './profile'
import { type UserDoc } from './users'

function sampleUser(overrides: Partial<UserDoc> = {}): UserDoc {
  const now = new Date('2026-08-12T10:00:00.000Z')
  return {
    email: 'owner@example.com',
    username: 'owner',
    usernameKey: 'owner',
    emails: [{ address: 'owner@example.com', addedAt: now }],
    displayEmail: 'owner@example.com',
    passwordHash: 'hash',
    role: ['user'],
    status: 'active',
    accountNo: 'ACC-1',
    mfaEnabled: false,
    modulePermissions: [],
    failedSignInAttempts: 0,
    tokenVersion: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as UserDoc
}

describe('profile validation', () => {
  it('accepts a valid username and rejects unsafe characters', () => {
    expect(usernameSchema.parse('  bmc.team-member_2  ')).toBe(
      'bmc.team-member_2'
    )
    expect(usernameSchema.safeParse('two words').success).toBe(false)
    expect(usernameSchema.safeParse('-leading').success).toBe(false)
  })

  it('allows an empty optional bio and canonicalizes HTTP URLs', () => {
    const result = profileUpdateSchema.parse({
      name: 'Account Owner',
      username: 'owner',
      displayEmail: 'owner@example.com',
      bio: '   ',
      dateOfBirth: '1990-02-28',
      language: 'en',
      urls: ['https://example.com/about'],
      expectedUpdatedAt: '2026-08-12T10:00:00.000Z',
    })
    expect(result.bio).toBe('')
    expect(result.urls).toEqual(['https://example.com/about'])
  })

  it('rejects unsupported URL schemes and duplicates', () => {
    const base = {
      name: 'Account Owner',
      username: 'owner',
      displayEmail: 'owner@example.com',
      bio: '',
      dateOfBirth: '1990-02-28',
      language: 'en',
      expectedUpdatedAt: '2026-08-12T10:00:00.000Z',
    }
    expect(
      profileUpdateSchema.safeParse({ ...base, urls: ['ftp://example.com'] })
        .success
    ).toBe(false)
    expect(
      profileUpdateSchema.safeParse({
        ...base,
        urls: ['https://example.com', 'https://example.com/'],
      }).success
    ).toBe(false)
  })

  it('rejects invalid account data and future dates of birth', () => {
    const base = {
      name: 'Account Owner',
      username: 'owner',
      displayEmail: 'owner@example.com',
      bio: '',
      urls: [],
      expectedUpdatedAt: '2026-08-12T10:00:00.000Z',
    }
    expect(
      profileUpdateSchema.safeParse({
        ...base,
        dateOfBirth: '2999-01-01',
        language: 'en',
      }).success
    ).toBe(false)
    expect(
      profileUpdateSchema.safeParse({
        ...base,
        dateOfBirth: '1990-02-28',
        language: 'unsupported',
      }).success
    ).toBe(false)
  })
})

describe('profile serialization', () => {
  it('treats the canonical address as displayable without changing its identity', () => {
    const profile = serializeProfile(sampleUser())
    expect(profile.canonicalEmail).toBe('owner@example.com')
    expect(profile.displayEmail).toBe('owner@example.com')
    expect(profile.name).toBe('')
    expect(profile.emails[0]).toMatchObject({
      address: 'owner@example.com',
      isPrimary: true,
      verified: true,
    })
  })

  it('computes the 30-day username cooldown', () => {
    const changedAt = new Date('2026-08-01T00:00:00.000Z')
    expect(
      usernameAvailableAt(
        sampleUser({ usernameChangedAt: changedAt })
      )?.toISOString()
    ).toBe('2026-08-31T00:00:00.000Z')
    expect(usernameAvailableAt(sampleUser())).toBeNull()
  })
})
