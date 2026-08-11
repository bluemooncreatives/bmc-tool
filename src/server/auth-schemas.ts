import { z } from 'zod'

export const credentialsSchema = z.object({
  email: z.email('Enter a valid email address.'),
  password: z.string().min(7, 'Password must be at least 7 characters long.'),
})

export const signInSchema = credentialsSchema.extend({
  /** When false the session cookies expire with the browser session. */
  rememberMe: z.boolean().optional(),
})

export const signUpSchema = credentialsSchema

export type Credentials = z.infer<typeof credentialsSchema>

type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string }

/**
 * Parses a request body against a schema, returning the first validation
 * message rather than the full zod tree — the client only renders one.
 */
export async function parseJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>
): Promise<ParseResult<T>> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return { ok: false, error: 'Request body must be valid JSON.' }
  }

  const result = schema.safeParse(raw)
  if (!result.success) {
    return {
      ok: false,
      error: result.error.issues[0]?.message ?? 'Invalid request.',
    }
  }

  return { ok: true, data: result.data }
}
