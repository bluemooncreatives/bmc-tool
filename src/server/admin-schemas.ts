import { z } from 'zod'
import {
  BILLING_PLANS,
  EMPLOYMENT_TYPES,
  ORGANIZATION_CODE_PATTERN,
  ORGANIZATION_SIZES,
  ORGANIZATION_STATUSES,
  ORGANIZATION_TYPES,
  normalizeOrganizationCode,
} from '@/lib/organizations'
import {
  isModuleKey,
  isPermissionAction,
  MODULE_KEYS,
  PERMISSION_ACTIONS,
  type ModuleKey,
  type PermissionAction,
} from '@/lib/permissions'
import { isValidTimeZone } from '@/lib/timezones'
import { newPasswordSchema } from './auth-schemas'
import { usernameSchema } from './profile'

const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'That record reference is invalid.')

const optionalObjectId = objectIdSchema.nullish()

const moduleKeySchema = z.custom<ModuleKey>(isModuleKey, {
  message: 'That module does not exist.',
})

const moduleListSchema = z
  .array(moduleKeySchema)
  .max(MODULE_KEYS.length)
  .transform((modules) => [...new Set(modules)])

const moduleActionsSchema = z
  .record(
    moduleKeySchema,
    z
      .array(
        z.custom<PermissionAction>(isPermissionAction, {
          message: 'That permission action does not exist.',
        })
      )
      .max(PERMISSION_ACTIONS.length)
  )
  .optional()

const trimmed = (max: number) => z.string().trim().max(max)

const emailField = z.email('Enter a valid email address.')

const optionalUrl = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (value) => value === '' || /^https?:\/\/[^\s]+$/i.test(value),
    'Enter a valid http(s) URL.'
  )
  .optional()

const expectedUpdatedAt = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'The record version is invalid.',
  })

const addressSchema = z
  .object({
    line1: trimmed(160).optional(),
    line2: trimmed(160).optional(),
    city: trimmed(80).optional(),
    state: trimmed(80).optional(),
    postalCode: trimmed(24).optional(),
    country: trimmed(80).optional(),
  })
  .optional()

const organizationSettingsSchema = z
  .object({
    allowSelfSignUp: z.boolean(),
    requireAdminApproval: z.boolean(),
    allowedEmailDomains: z
      .array(
        z
          .string()
          .trim()
          .toLowerCase()
          .max(253)
          .regex(
            /^@?[a-z0-9.-]+\.[a-z]{2,}$/,
            'Enter a domain such as example.com.'
          )
          .transform((value) => value.replace(/^@/, ''))
      )
      .max(20, 'You can allow up to 20 email domains.')
      .transform((domains) => [...new Set(domains)]),
    enforceMfa: z.boolean(),
    seatLimit: z
      .number()
      .int('The seat limit must be a whole number.')
      .min(1, 'The seat limit must be at least 1.')
      .max(100_000)
      .nullable(),
  })
  .partial()

const billingSchema = z
  .object({
    plan: z.enum(BILLING_PLANS),
    currency: trimmed(8).optional(),
    renewalAt: z
      .string()
      .refine((value) => value === '' || !Number.isNaN(Date.parse(value)), {
        message: 'Enter a valid renewal date.',
      })
      .optional(),
    taxId: trimmed(40).optional(),
    notes: trimmed(500).optional(),
  })
  .partial()

export const organizationCodeSchema = z
  .string()
  .trim()
  .transform(normalizeOrganizationCode)
  .refine((value) => ORGANIZATION_CODE_PATTERN.test(value), {
    message:
      'Use 2-16 characters: letters, numbers, or hyphens, starting with a letter or number.',
  })

export const createOrganizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'The organization name must be at least 2 characters.')
    .max(120, 'The organization name must be 120 characters or fewer.'),
  code: organizationCodeSchema,
  type: z.enum(ORGANIZATION_TYPES).default('client'),
  status: z.enum(ORGANIZATION_STATUSES).default('active'),
  description: trimmed(1000).optional(),
  industry: trimmed(80).optional(),
  size: z.enum(ORGANIZATION_SIZES).optional(),
  website: optionalUrl,
  logoUrl: optionalUrl,
  contactEmail: z.union([emailField, z.literal('')]).optional(),
  contactPhone: trimmed(32).optional(),
  address: addressSchema,
  billing: billingSchema.optional(),
  enabledModules: moduleListSchema.optional(),
  defaultMemberModules: moduleListSchema.optional(),
  settings: organizationSettingsSchema.optional(),
  /** Optional first administrator, created in the same request. */
  admin: z
    .object({
      email: emailField,
      name: trimmed(80).min(2, 'Enter the administrator name.'),
      sendInvite: z.boolean().default(true),
    })
    .optional(),
})

export const updateOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  code: organizationCodeSchema.optional(),
  type: z.enum(ORGANIZATION_TYPES).optional(),
  status: z.enum(ORGANIZATION_STATUSES).optional(),
  description: trimmed(1000).optional(),
  industry: trimmed(80).optional(),
  size: z.union([z.enum(ORGANIZATION_SIZES), z.literal('')]).optional(),
  website: optionalUrl,
  logoUrl: optionalUrl,
  contactEmail: z.union([emailField, z.literal('')]).optional(),
  contactPhone: trimmed(32).optional(),
  address: addressSchema,
  billing: billingSchema.optional(),
  enabledModules: moduleListSchema.optional(),
  defaultMemberModules: moduleListSchema.optional(),
  settings: organizationSettingsSchema.optional(),
  expectedUpdatedAt,
})

export const createOrganizationAdminSchema = z.object({
  email: emailField,
  name: z
    .string()
    .trim()
    .min(2, 'Enter the administrator name.')
    .max(80, 'The name must be 80 characters or fewer.'),
  username: usernameSchema.optional(),
  phone: trimmed(32).optional(),
  jobTitle: trimmed(80).optional(),
  /** Defaults to the organization admin baseline when omitted. */
  grantedModules: moduleListSchema.optional(),
  makePrimaryAdmin: z.boolean().default(true),
  sendInvite: z.boolean().default(true),
})

export const createAccountSchema = z.object({
  organizationId: objectIdSchema,
  email: emailField,
  name: z
    .string()
    .trim()
    .min(2, 'Enter the account holder name.')
    .max(80, 'The name must be 80 characters or fewer.'),
  username: usernameSchema.optional(),
  role: z.enum(['org_admin', 'user']).default('user'),
  status: z.enum(['active', 'invited', 'pending']).default('invited'),
  designationId: optionalObjectId,
  departmentId: optionalObjectId,
  managerId: optionalObjectId,
  employeeId: trimmed(40).optional(),
  employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
  jobTitle: trimmed(80).optional(),
  phone: trimmed(32).optional(),
  location: trimmed(120).optional(),
  timezone: trimmed(64)
    .refine((value) => value === '' || isValidTimeZone(value), {
      message: 'Select a valid IANA timezone.',
    })
    .optional(),
  joinedAt: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Date.parse(value)), {
      message: 'Enter a valid joining date.',
    })
    .optional(),
  grantedModules: moduleListSchema.optional(),
  grantedModuleActions: moduleActionsSchema,
  deniedModules: moduleListSchema.optional(),
  mfaEnabled: z.boolean().optional(),
  adminNotes: trimmed(1000).optional(),
  sendInvite: z.boolean().default(true),
})

export const updateAccountSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  role: z.enum(['org_admin', 'user']).optional(),
  status: z
    .enum(['active', 'inactive', 'invited', 'pending', 'suspended'])
    .optional(),
  statusReason: trimmed(300).optional(),
  designationId: optionalObjectId,
  departmentId: optionalObjectId,
  managerId: optionalObjectId,
  employeeId: trimmed(40).optional(),
  employmentType: z.union([z.enum(EMPLOYMENT_TYPES), z.literal('')]).optional(),
  jobTitle: trimmed(80).optional(),
  phone: trimmed(32).optional(),
  location: trimmed(120).optional(),
  timezone: trimmed(64)
    .refine((value) => value === '' || isValidTimeZone(value), {
      message: 'Select a valid IANA timezone.',
    })
    .optional(),
  joinedAt: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Date.parse(value)), {
      message: 'Enter a valid joining date.',
    })
    .optional(),
  grantedModules: moduleListSchema.optional(),
  grantedModuleActions: moduleActionsSchema,
  deniedModules: moduleListSchema.optional(),
  mfaEnabled: z.boolean().optional(),
  adminNotes: trimmed(1000).optional(),
  expectedUpdatedAt,
})

export const accountActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('reset-password'),
    sendEmail: z.boolean().default(true),
  }),
  z.object({ action: z.literal('force-signout') }),
  z.object({ action: z.literal('resend-invite') }),
  z.object({
    action: z.literal('suspend'),
    reason: trimmed(300).optional(),
  }),
  z.object({ action: z.literal('activate') }),
  z.object({ action: z.literal('deactivate') }),
  z.object({
    action: z.literal('transfer'),
    organizationId: objectIdSchema,
  }),
])

export const createDepartmentSchema = z.object({
  organizationId: objectIdSchema,
  name: z
    .string()
    .trim()
    .min(2, 'The department name must be at least 2 characters.')
    .max(80),
  code: trimmed(24).optional(),
  description: trimmed(500).optional(),
  parentDepartmentId: optionalObjectId,
  headUserId: optionalObjectId,
})

export const updateDepartmentSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  code: trimmed(24).optional(),
  description: trimmed(500).optional(),
  parentDepartmentId: optionalObjectId,
  headUserId: optionalObjectId,
})

export const createDesignationSchema = z.object({
  organizationId: objectIdSchema,
  title: z
    .string()
    .trim()
    .min(2, 'The designation title must be at least 2 characters.')
    .max(80),
  code: trimmed(24).optional(),
  level: z
    .number()
    .int('Seniority must be a whole number.')
    .min(1, 'Seniority starts at 1.')
    .max(20, 'Seniority tops out at 20.')
    .default(5),
  departmentId: optionalObjectId,
  description: trimmed(500).optional(),
  defaultModules: moduleListSchema.optional(),
  defaultModuleActions: moduleActionsSchema,
  isDefault: z.boolean().optional(),
})

export const updateDesignationSchema = z.object({
  title: z.string().trim().min(2).max(80).optional(),
  code: trimmed(24).optional(),
  level: z.number().int().min(1).max(20).optional(),
  departmentId: optionalObjectId,
  description: trimmed(500).optional(),
  defaultModules: moduleListSchema.optional(),
  defaultModuleActions: moduleActionsSchema,
  isDefault: z.boolean().optional(),
})

export const changePasswordSchema = z
  .object({
    /** Omitted only while the account is still on a provisioned password. */
    currentPassword: z.string().max(128).optional(),
    password: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords don't match.",
    path: ['confirmPassword'],
  })

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>
export type CreateAccountInputBody = z.infer<typeof createAccountSchema>
export type UpdateAccountInputBody = z.infer<typeof updateAccountSchema>
export type AccountActionInput = z.infer<typeof accountActionSchema>
