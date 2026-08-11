import { NextResponse } from 'next/server'
import { clearSession } from '@/server/session'

export const runtime = 'nodejs'

/**
 * Always succeeds, including when there is no session — signing out should
 * never leave the client stuck on an error.
 */
export async function POST() {
  await clearSession()
  return NextResponse.json({ ok: true })
}
