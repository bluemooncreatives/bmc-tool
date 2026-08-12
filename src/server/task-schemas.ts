import { z } from 'zod'

const taskNumber = z
  .string()
  .trim()
  .min(1, 'Task number is required.')
  .max(40, 'Task number must be 40 characters or fewer.')

export const createTaskSchema = z.object({
  id: taskNumber,
  title: z.string().trim().min(1, 'Title is required.').max(200),
  description: z.string().trim().max(2000).optional(),
  status: z.string().trim().min(1, 'Status is required.').max(60),
  label: z.string().trim().min(1, 'Label is required.').max(60),
  priority: z.string().trim().min(1, 'Priority is required.').max(60),
  // taggedBy is derived server-side from the authenticated user, never from the client.
  taggedTo: z.string().trim().max(200).optional(),
})

export const updateTaskSchema = createTaskSchema.partial()

export type CreateTaskInput = z.infer<typeof createTaskSchema>
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>
