import { z } from 'zod'

const emailField = z.email('Enter a valid email address.')

export const credentialsSchema = z.object({
  email: emailField,
  // Sign-in must continue accepting existing hashes created under an older
  // password policy. Strong policy is enforced when credentials are created.
  password: z.string().min(1, 'Enter your password.').max(128),
})

export const newPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long.')
  .max(128, 'Password must be no more than 128 characters long.')
  .regex(/[a-z]/, 'Password must include a lowercase letter.')
  .regex(/[A-Z]/, 'Password must include an uppercase letter.')
  .regex(/\d/, 'Password must include a number.')

export const signUpSchema = z.object({
  email: emailField,
  password: newPasswordSchema,
})

export const emailSchema = z.object({
  email: z.email('Enter a valid email address.'),
})

export const signInSchema = credentialsSchema.extend({
  /** When false the session cookies expire with the browser session. */
  rememberMe: z.boolean().optional(),
})

export const otpVerifySchema = z.object({
  challengeId: z.string().min(1, 'The verification request is missing.'),
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code.'),
})

export const otpResendSchema = z.object({
  challengeId: z.string().min(1, 'The verification request is missing.'),
})

export const resetPasswordSchema = z
  .object({
    challengeId: z.string().min(1, 'The verification request is missing.'),
    password: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords don't match.",
    path: ['confirmPassword'],
  })

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
