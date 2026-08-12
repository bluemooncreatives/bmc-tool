import { NextResponse } from 'next/server'
import { ProvisioningError } from './account-provisioning'
import { AuthorizationError } from './authorization'
import { RateLimitError } from './rate-limit'

/**
 * Single error translator for the Account Management endpoints.
 *
 * Every known failure carries its own status and a message written for the
 * administrator; anything else is logged with its context and answered with a
 * generic 500 so internal details never reach the browser.
 */
export function errorResponse(error: unknown, context: string): NextResponse {
  if (error instanceof AuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }

  if (error instanceof ProvisioningError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }

  if (error instanceof RateLimitError) {
    return NextResponse.json(
      { error: error.message },
      { status: 429, headers: { 'Retry-After': String(error.retryAfter) } }
    )
  }

  if ((error as { code?: number })?.code === 11000) {
    const field = Object.keys(
      (error as { keyPattern?: Record<string, number> }).keyPattern ?? {}
    )[0]
    return NextResponse.json(
      {
        error: field
          ? `That ${field.replace(/Key$/, '')} is already in use.`
          : 'That record already exists.',
      },
      { status: 409 }
    )
  }

  // eslint-disable-next-line no-console
  console.error(`${context} failed`, error)
  return NextResponse.json(
    { error: 'Something went wrong. Please try again.' },
    { status: 500 }
  )
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 })
}

export function notFound(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 })
}

export function conflict(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 409 })
}

/** Optimistic concurrency guard shared by every admin PATCH endpoint. */
export function staleRecord(): NextResponse {
  return NextResponse.json(
    {
      error:
        'This record changed since you opened it. Reload the page and try again.',
    },
    { status: 409 }
  )
}
