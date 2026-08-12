import { z } from 'zod'
import {
  isSupportedLanguage,
  isValidDateOfBirth,
  type SupportedLanguage,
} from '@/lib/account-profile'
import { normalizeEmail, normalizeUsername } from './identity'
import { type UserDoc } from './users'

export const USERNAME_CHANGE_DAYS = 30
export const MAX_PROFILE_URLS = 5

export const usernameSchema = z
  .string('Please enter your username.')
  .trim()
  .min(2, 'Username must be at least 2 characters.')
  .max(30, 'Username must not be longer than 30 characters.')
  .regex(
    /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/,
    'Use letters, numbers, periods, underscores, or hyphens.'
  )

const httpUrlSchema = z
  .string()
  .trim()
  .max(2048, 'URLs must not be longer than 2,048 characters.')
  .transform((value, context) => {
    try {
      const url = new URL(value)
      if (url.protocol !== 'http:' && url.protocol !== 'https:')
        throw new Error()
      return url.toString()
    } catch {
      context.addIssue({
        code: 'custom',
        message: 'Please enter a valid HTTP or HTTPS URL.',
      })
      return z.NEVER
    }
  })

export const profileUpdateSchema = z.object({
  name: z
    .string('Please enter your name.')
    .trim()
    .min(2, 'Name must be at least 2 characters.')
    .max(80, 'Name must not be longer than 80 characters.'),
  username: usernameSchema,
  displayEmail: z.email('Please select a valid email address.'),
  bio: z.string().trim().max(160, 'Bio must not exceed 160 characters.'),
  dateOfBirth: z
    .string('Please select your date of birth.')
    .refine(isValidDateOfBirth, {
      message: 'Select a valid date of birth between 1900 and today.',
    }),
  language: z.custom<SupportedLanguage>(isSupportedLanguage, {
    message: 'Please select a supported language.',
  }),
  urls: z
    .array(httpUrlSchema)
    .max(MAX_PROFILE_URLS, `You can add up to ${MAX_PROFILE_URLS} URLs.`)
    .transform((urls, context) => {
      const unique = new Set(urls)
      if (unique.size !== urls.length) {
        context.addIssue({
          code: 'custom',
          message: 'Duplicate URLs are not allowed.',
        })
        return z.NEVER
      }
      return urls
    }),
  expectedUpdatedAt: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), {
      message: 'The profile version is invalid.',
    }),
})

export const addEmailSchema = z.object({
  email: z.email('Enter a valid email address.').transform(normalizeEmail),
})

export const removeEmailSchema = addEmailSchema

export const verifyProfileEmailSchema = z.object({
  challengeId: z.string().min(1, 'The verification request is missing.'),
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code.'),
})

export const resendProfileEmailSchema = z.object({
  challengeId: z.string().min(1, 'The verification request is missing.'),
})

export function usernameAvailableAt(user: UserDoc): Date | null {
  if (!user.usernameChangedAt) return null
  return new Date(
    user.usernameChangedAt.getTime() +
      USERNAME_CHANGE_DAYS * 24 * 60 * 60 * 1000
  )
}

export function serializeProfile(user: UserDoc) {
  const emails = user.emails?.length
    ? user.emails
    : [
        {
          address: user.email,
          addedAt: user.createdAt,
          verifiedAt: user.emailVerifiedAt,
        },
      ]
  return {
    name:
      user.name ??
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim(),
    username: user.username,
    canonicalEmail: user.email,
    displayEmail: user.displayEmail ?? user.email,
    bio: user.bio ?? '',
    dateOfBirth: user.dateOfBirth ?? '',
    language: user.language ?? '',
    urls: user.urls ?? [],
    emails: emails.map((entry) => ({
      address: entry.address,
      isPrimary: entry.address === user.email,
      verified: entry.address === user.email || Boolean(entry.verifiedAt),
    })),
    usernameAvailableAt: usernameAvailableAt(user)?.toISOString() ?? null,
    updatedAt: user.updatedAt.toISOString(),
  }
}

export function isUsernameChanged(user: UserDoc, username: string): boolean {
  return normalizeUsername(user.username) !== normalizeUsername(username)
}
