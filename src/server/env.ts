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

/**
 * How long audit entries are kept, in days. Zero — the default — keeps them
 * forever.
 *
 * Retention is opt-in on purpose. A TTL index deletes silently and
 * irreversibly, and how long an audit trail must survive is a compliance
 * question, not an engineering one; guessing a default here would quietly
 * destroy the record someone later needs.
 */
export function getAuditRetentionDays(): number {
  const raw = optional('AUDIT_RETENTION_DAYS')
  if (!raw) return 0

  const days = Number(raw)
  if (!Number.isFinite(days) || days < 0) {
    throw new Error(
      'AUDIT_RETENTION_DAYS must be a non-negative number of days (0 keeps audit entries forever).'
    )
  }
  return Math.floor(days)
}

/** Adds a scheme to bare hostnames (Vercel exposes its URLs without one). */
function normalizeOrigin(value: string): string {
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`
  return withScheme.replace(/\/+$/, '')
}

/**
 * Public origin used for absolute links in server-generated emails.
 *
 * Resolution order:
 *   1. `APP_URL` — the explicit override; always wins.
 *   2. On Vercel, the deployment's own hostname. Production deployments use the
 *      stable project domain rather than `VERCEL_URL`, which is the immutable
 *      per-deployment hash URL and would age out of any email that outlives it.
 *   3. `http://localhost:3000` for local development only.
 *
 * Falling back to localhost in production would ship dead links to real
 * inboxes, so that case throws instead — a failed send is recoverable, an
 * unusable invite in someone's mailbox is not.
 */
export function getAppUrl(): string {
  const explicit = optional('APP_URL')
  if (explicit) return normalizeOrigin(explicit)

  const vercelHost =
    optional('VERCEL_ENV') === 'production'
      ? (optional('VERCEL_PROJECT_PRODUCTION_URL') ?? optional('VERCEL_URL'))
      : (optional('VERCEL_URL') ?? optional('VERCEL_PROJECT_PRODUCTION_URL'))
  if (vercelHost) return normalizeOrigin(vercelHost)

  if (isProduction) {
    throw new Error(
      'Missing required environment variable APP_URL. Set it to the public origin (for example https://example.com) so emailed links point at the deployment.'
    )
  }

  return 'http://localhost:3000'
}

/**
 * Every origin this deployment may legitimately be reached on, including the
 * Vercel-assigned hostnames and anything listed in `APP_ORIGINS` (comma
 * separated — use it for custom domains and staging aliases).
 */
function getAllowedAppOrigins(): ReadonlySet<string> {
  const candidates = [
    optional('APP_URL'),
    optional('VERCEL_PROJECT_PRODUCTION_URL'),
    optional('VERCEL_URL'),
    optional('VERCEL_BRANCH_URL'),
    ...(optional('APP_ORIGINS')?.split(',') ?? []),
  ]

  const origins = new Set<string>()
  for (const candidate of candidates) {
    const trimmed = candidate?.trim()
    if (!trimmed) continue
    try {
      origins.add(new URL(normalizeOrigin(trimmed)).origin)
    } catch {
      // A malformed entry should not take down email delivery; skip it.
    }
  }
  return origins
}

function isLoopback(origin: string): boolean {
  const { hostname } = new URL(origin)
  return (
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  )
}

/** The origin the browser actually used, as seen through the Vercel proxy. */
function getRequestOrigin(request: Request): string | null {
  const host =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  const protocol = request.headers
    .get('x-forwarded-proto')
    ?.split(',')[0]
    ?.trim()

  try {
    if (host) return new URL(`${protocol ?? 'https'}://${host}`).origin
    return new URL(request.url).origin
  } catch {
    return null
  }
}

/**
 * The origin to use for links in an email sent while handling `request`.
 *
 * Preferring the request's own origin is what makes one build work unchanged on
 * localhost, on preview deployments, and in production: the recipient gets a
 * link back to the same place the administrator was working in. `Host` is
 * caller-controlled, though, so it is honoured only when it matches a
 * configured origin — otherwise an attacker could aim a real invite email at a
 * look-alike domain. Anything unrecognised falls back to the configured value.
 */
export function resolveAppUrl(request?: Request): string {
  const origin = request ? getRequestOrigin(request) : null

  if (origin) {
    if (getAllowedAppOrigins().has(origin)) return origin
    // Any port is fair game for a local dev server, but never in production.
    if (!isProduction && isLoopback(origin)) return origin
  }

  return getAppUrl()
}
