import nodemailer, { type Transporter } from 'nodemailer'
import { getSmtpConfig, isProduction, resolveAppUrl } from './env'

let transporter: Transporter | null = null

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
      })[character] ?? character
  )
}

function getTransporter(): Transporter | null {
  const config = getSmtpConfig()
  if (!config) return null

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      requireTLS: !config.secure,
      auth: { user: config.user, pass: config.password },
      pool: true,
      maxConnections: 3,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    })
  }
  return transporter
}

export type OtpMailPurpose = 'sign-in' | 'password-reset' | 'email-verification'

export async function sendOtpEmail(input: {
  to: string
  code: string
  purpose: OtpMailPurpose
  expiresInMinutes: number
}): Promise<void> {
  const smtp = getSmtpConfig()
  const mailer = getTransporter()

  if (!smtp || !mailer) {
    if (isProduction) {
      throw new Error('Email delivery is not configured.')
    }

    // Development-only escape hatch so the flow remains testable locally.
    // eslint-disable-next-line no-console
    console.info(`[dev mail] OTP for ${input.to}: ${input.code}`)
    return
  }

  const action =
    input.purpose === 'sign-in'
      ? 'sign in'
      : input.purpose === 'password-reset'
        ? 'reset your password'
        : 'verify this email address'
  const subject =
    input.purpose === 'sign-in'
      ? 'Your Blue Moon Creatives sign-in code'
      : input.purpose === 'password-reset'
        ? 'Your Blue Moon Creatives password reset code'
        : 'Verify your Blue Moon Creatives email address'
  const safeCode = escapeHtml(input.code)

  await mailer.sendMail({
    from: smtp.from,
    to: input.to,
    subject,
    text: [
      `Use ${input.code} to ${action}.`,
      `This code expires in ${input.expiresInMinutes} minutes and can only be used once.`,
      'If you did not request this, you can safely ignore this email.',
    ].join('\n\n'),
    html: `
      <div style="background:#f4f6fb;padding:32px 16px;font-family:Arial,sans-serif;color:#182033">
        <div style="max-width:520px;margin:auto;background:#fff;border-radius:14px;padding:32px;border:1px solid #e7eaf0">
          <p style="margin:0 0 8px;color:#526079;font-size:14px">Blue Moon Creatives</p>
          <h1 style="margin:0 0 16px;font-size:22px">Your verification code</h1>
          <p style="margin:0 0 24px;line-height:1.55">Use this code to ${action}:</p>
          <div style="font-size:34px;font-weight:700;letter-spacing:10px;background:#f6f7fb;border-radius:10px;padding:18px;text-align:center">${safeCode}</div>
          <p style="margin:24px 0 0;color:#526079;font-size:14px;line-height:1.55">The code expires in ${input.expiresInMinutes} minutes and can only be used once. If you did not request it, no action is needed.</p>
        </div>
      </div>
    `,
  })
}

/** Shared chrome so every transactional email reads as one brand. */
function brandedEmail(input: {
  heading: string
  intro: string
  body: string
  footer?: string
}): string {
  return `
    <div style="background:#f4f6fb;padding:32px 16px;font-family:Arial,sans-serif;color:#182033">
      <div style="max-width:560px;margin:auto;background:#fff;border-radius:14px;padding:32px;border:1px solid #e7eaf0">
        <p style="margin:0 0 8px;color:#526079;font-size:14px">Blue Moon Creatives</p>
        <h1 style="margin:0 0 16px;font-size:22px">${escapeHtml(input.heading)}</h1>
        <p style="margin:0 0 20px;line-height:1.55">${escapeHtml(input.intro)}</p>
        ${input.body}
        <p style="margin:24px 0 0;color:#526079;font-size:13px;line-height:1.55">${escapeHtml(
          input.footer ??
            'If you were not expecting this email, contact your administrator before signing in.'
        )}</p>
      </div>
    </div>
  `
}

function detailRows(rows: readonly [string, string][]): string {
  return `
    <table role="presentation" style="width:100%;border-collapse:collapse;background:#f6f7fb;border-radius:10px;padding:4px">
      ${rows
        .map(
          ([label, value]) => `
        <tr>
          <td style="padding:10px 14px;color:#526079;font-size:13px;white-space:nowrap">${escapeHtml(label)}</td>
          <td style="padding:10px 14px;font-size:14px;font-weight:600;word-break:break-all">${escapeHtml(value)}</td>
        </tr>`
        )
        .join('')}
    </table>
  `
}

export type AccountInviteMail = {
  to: string
  name: string
  organizationName: string
  organizationCode: string
  temporaryPassword: string
  roleLabel: string
  invitedByEmail: string
  /** The request being handled, so the sign-in link points back to its origin. */
  request?: Request
}

/**
 * Delivers provisioned credentials.
 *
 * Returns `false` instead of throwing when SMTP is not configured outside
 * production, so local provisioning still works — the caller then shows the
 * generated password to the administrator who created the account.
 */
export async function sendAccountInviteEmail(
  input: AccountInviteMail
): Promise<boolean> {
  const smtp = getSmtpConfig()
  const mailer = getTransporter()
  const signInUrl = `${resolveAppUrl(input.request)}/sign-in`

  if (!smtp || !mailer) {
    if (isProduction) throw new Error('Email delivery is not configured.')
    // eslint-disable-next-line no-console
    console.info(
      `[dev mail] invite for ${input.to} (${input.organizationCode}) password: ${input.temporaryPassword}`
    )
    return false
  }

  await mailer.sendMail({
    from: smtp.from,
    to: input.to,
    subject: `Your ${input.organizationName} workspace account is ready`,
    text: [
      `Hello ${input.name},`,
      `${input.invitedByEmail} created a ${input.roleLabel} account for you in the ${input.organizationName} workspace (organization code ${input.organizationCode}).`,
      `Sign in at ${signInUrl}`,
      `Email: ${input.to}`,
      `Temporary password: ${input.temporaryPassword}`,
      'You will be asked to choose your own password the first time you sign in. This temporary password stops working at that point.',
      'If you were not expecting this email, contact your administrator before signing in.',
    ].join('\n\n'),
    html: brandedEmail({
      heading: 'Your workspace account is ready',
      intro: `Hello ${input.name}, ${input.invitedByEmail} created a ${input.roleLabel} account for you in the ${input.organizationName} workspace.`,
      body: `
        ${detailRows([
          ['Organization', `${input.organizationName} (${input.organizationCode})`],
          ['Role', input.roleLabel],
          ['Email', input.to],
          ['Temporary password', input.temporaryPassword],
        ])}
        <p style="margin:24px 0 0;line-height:1.55">
          <a href="${escapeHtml(signInUrl)}" style="display:inline-block;background:#182033;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600">Sign in</a>
        </p>
        <p style="margin:20px 0 0;color:#526079;font-size:14px;line-height:1.55">You will be asked to choose your own password the first time you sign in. The temporary password stops working at that point.</p>
      `,
    }),
  })

  return true
}

/** Sent when an administrator resets someone else's password. */
export async function sendPasswordResetByAdminEmail(input: {
  to: string
  name: string
  organizationName: string
  temporaryPassword: string
  actorEmail: string
  /** The request being handled, so the sign-in link points back to its origin. */
  request?: Request
}): Promise<boolean> {
  const smtp = getSmtpConfig()
  const mailer = getTransporter()
  const signInUrl = `${resolveAppUrl(input.request)}/sign-in`

  if (!smtp || !mailer) {
    if (isProduction) throw new Error('Email delivery is not configured.')
    // eslint-disable-next-line no-console
    console.info(
      `[dev mail] admin password reset for ${input.to}: ${input.temporaryPassword}`
    )
    return false
  }

  await mailer.sendMail({
    from: smtp.from,
    to: input.to,
    subject: 'Your password was reset by an administrator',
    text: [
      `Hello ${input.name},`,
      `${input.actorEmail} reset your ${input.organizationName} workspace password. Every existing session was signed out.`,
      `Sign in at ${signInUrl} with the temporary password ${input.temporaryPassword} and choose a new one.`,
      'If you did not expect this, contact your administrator immediately.',
    ].join('\n\n'),
    html: brandedEmail({
      heading: 'Your password was reset',
      intro: `${input.actorEmail} reset your ${input.organizationName} workspace password. Every existing session was signed out.`,
      body: `
        ${detailRows([
          ['Email', input.to],
          ['Temporary password', input.temporaryPassword],
        ])}
        <p style="margin:24px 0 0;line-height:1.55">
          <a href="${escapeHtml(signInUrl)}" style="display:inline-block;background:#182033;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600">Sign in and set a new password</a>
        </p>
      `,
      footer:
        'If you did not expect this, contact your administrator immediately.',
    }),
  })

  return true
}
