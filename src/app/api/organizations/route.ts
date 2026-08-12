import { getOrganizationsCollection } from '@/server/organizations'
import { enforceRateLimit, RateLimitError } from '@/server/rate-limit'
import { NextResponse } from 'next/server'
import {
  acceptsPublicSignUp,
  INTERNAL_ORGANIZATION_CODE,
  type PublicOrganizationOption,
} from '@/lib/organizations'

export const runtime = 'nodejs'

/**
 * The organization picker on the sign-up page.
 *
 * Unauthenticated by necessity, so it exposes nothing but the name, code, and
 * type of organizations that have explicitly opted into self sign-up. Tenants
 * that only accept administrator-created accounts never appear here, which
 * keeps the client list from becoming a public customer directory.
 */
export async function GET(request: Request) {
  try {
    await enforceRateLimit({
      request,
      action: 'organization-directory',
      max: 60,
      windowSeconds: 15 * 60,
    })

    const organizations = await getOrganizationsCollection()
    const results = await organizations
      .find(
        {
          status: 'active',
          type: { $ne: 'internal' },
          isSystemOrg: { $ne: true },
          code: { $ne: INTERNAL_ORGANIZATION_CODE },
          'settings.allowSelfSignUp': true,
        },
        {
          projection: {
            code: 1,
            name: 1,
            type: 1,
            status: 1,
            isSystemOrg: 1,
            settings: 1,
          },
        }
      )
      .sort({ name: 1 })
      .limit(200)
      .toArray()

    const options: PublicOrganizationOption[] = results
      .filter((organization) =>
        acceptsPublicSignUp({
          code: organization.code,
          type: organization.type,
          status: organization.status,
          isSystemOrg: organization.isSystemOrg,
          allowSelfSignUp: organization.settings?.allowSelfSignUp,
        })
      )
      .map((organization) => ({
        id: organization._id.toHexString(),
        code: organization.code,
        name: organization.name,
        type: organization.type,
        allowSelfSignUp: true,
      }))

    return NextResponse.json(
      { organizations: options },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: error.message },
        {
          status: 429,
          headers: { 'Retry-After': String(error.retryAfter) },
        }
      )
    }
    // eslint-disable-next-line no-console
    console.error('organization directory failed', error)
    return NextResponse.json(
      { error: 'Could not load the organization list.' },
      { status: 500 }
    )
  }
}
