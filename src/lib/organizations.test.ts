import { describe, expect, it } from 'vitest'
import { acceptsPublicSignUp, isExternalOrganization } from './organizations'

describe('public organization eligibility', () => {
  it.each([
    { code: 'BMC', type: 'client' as const, isSystemOrg: false },
    { code: 'OTHER', type: 'internal' as const, isSystemOrg: false },
    { code: 'OTHER', type: 'client' as const, isSystemOrg: true },
  ])('never exposes an internal organization: $code/$type', (organization) => {
    expect(isExternalOrganization(organization)).toBe(false)
    expect(
      acceptsPublicSignUp({
        ...organization,
        status: 'active',
        allowSelfSignUp: true,
      })
    ).toBe(false)
  })

  it('accepts only active external organizations with self sign-up enabled', () => {
    const base = {
      code: 'ACME',
      type: 'client' as const,
      isSystemOrg: false,
    }
    expect(
      acceptsPublicSignUp({
        ...base,
        status: 'active',
        allowSelfSignUp: true,
      })
    ).toBe(true)
    expect(
      acceptsPublicSignUp({
        ...base,
        status: 'suspended',
        allowSelfSignUp: true,
      })
    ).toBe(false)
    expect(
      acceptsPublicSignUp({
        ...base,
        status: 'active',
        allowSelfSignUp: false,
      })
    ).toBe(false)
  })

  it('normalizes the reserved internal code before comparing it', () => {
    expect(isExternalOrganization({ code: ' bmc ', type: 'partner' })).toBe(
      false
    )
  })
})
