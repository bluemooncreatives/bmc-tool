import { z } from 'zod'
import { NOTIFICATION_CATEGORIES } from '@/lib/notifications'

const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'A valid notification id is required.')

export const notificationActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('mark'),
    ids: z.array(objectIdSchema).min(1).max(100),
    read: z.boolean(),
  }),
  z.object({ action: z.literal('mark-all') }),
  z.object({
    action: z.literal('archive'),
    ids: z.array(objectIdSchema).min(1).max(100),
  }),
  z.object({ action: z.literal('archive-read') }),
])

export const notificationPreferencesSchema = z.object({
  mutedCategories: z
    .array(z.enum(NOTIFICATION_CATEGORIES))
    .max(
      NOTIFICATION_CATEGORIES.length,
      'Too many notification categories were supplied.'
    ),
})
