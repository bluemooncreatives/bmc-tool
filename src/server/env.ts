/**
 * Server-only environment access.
 *
 * Every value here is read lazily rather than at module load, so importing a
 * route handler during `next build` does not require the secrets to be present.
 * A missing value throws at request time with a message naming the variable.
 */

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Add it to .env (see .env.example).`
    )
  }
  return value
}

/** Trims and treats an empty string as absent, since `KEY=` is a common typo. */
function optional(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

export function getMongoUri(): string {
  return required('MONGODB_URI')
}

export function getJwtSecret(): Uint8Array {
  const secret = new TextEncoder().encode(required('JWT_SECRET'))
  if (secret.byteLength < 32) {
    throw new Error('JWT_SECRET must be at least 32 bytes long.')
  }
  return secret
}

export const isProduction = process.env.NODE_ENV === 'production'

/**
 * The address that owns the workspace. It is granted the superadmin role on
 * first boot and can never be demoted, suspended, or deleted through the app.
 */
export function getSuperadminEmail(): string {
  return (
    optional('SUPERADMIN_EMAIL') ?? 'contact.bluemooncreatives@gmail.com'
  ).toLowerCase()
}

/**
 * Optional. When set, the superadmin is created with this password on first
 * boot; when absent, the account is seeded without one and can only be entered
 * through the email OTP flow, which is the safer default.
 */
export function getSuperadminPassword(): string | undefined {
  return optional('SUPERADMIN_PASSWORD')
}

export type SmtpConfig = {
  host: string
  port: number
  /** Implicit TLS on 465; STARTTLS is negotiated on 587. */
  secure: boolean
  user: string
  password: string
  from: string
}

/**
 * Reads SMTP settings, defaulting to Gmail so the workspace address only needs
 * an app password. Returns null when credentials are missing — the mailer
 * treats that as "not configured" and falls back to logging in development
 * rather than crashing the request.
 */
export function getSmtpConfig(): SmtpConfig | null {
  const user = optional('SMTP_USER') ?? getSuperadminEmail()
  const password = optional('SMTP_PASSWORD')
  if (!password) return null

  const port = Number(optional('SMTP_PORT') ?? 465)
  const explicitSecure = optional('SMTP_SECURE')

  return {
    host: optional('SMTP_HOST') ?? 'smtp.gmail.com',
    port: Number.isFinite(port) && port > 0 ? port : 465,
    secure: explicitSecure ? explicitSecure !== 'false' : port === 465,
    user,
    password,
    from: optional('MAIL_FROM') ?? `Blue Moon Creatives <${user}>`,
  }
}

/** Used for absolute links in emails. Falls back to the dev server origin. */
export function getAppUrl(): string {
  return (optional('APP_URL') ?? 'http://localhost:3000').replace(/\/+$/, '')
}
