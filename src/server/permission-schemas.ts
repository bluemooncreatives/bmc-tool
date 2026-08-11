import { z } from 'zod'
import { MODULE_KEYS } from '@/lib/permissions'

export const updatePermissionsSchema = z.object({
  userId: z.string().regex(/^[a-f\d]{24}$/i, 'The selected user is invalid.'),
  permissions: z
    .array(z.enum(MODULE_KEYS))
    .max(MODULE_KEYS.length, 'Too many permissions were supplied.'),
  expectedUpdatedAt: z.iso.datetime(),
})
