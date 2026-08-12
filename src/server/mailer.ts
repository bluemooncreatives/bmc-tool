import nodemailer, { type Transporter } from 'nodemailer'
import { getSmtpConfig, isProduction } from './env'

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
