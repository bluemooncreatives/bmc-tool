import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { Tasks } from '@/features/tasks'

const taskSearchSchema = z.object({
  page: z.number().optional().catch(1),
  pageSize: z.number().optional().catch(10),
  // Label/status/priority values are user-editable (see task-options-store),
  // so they're validated as plain strings rather than a fixed enum.
  label: z.array(z.string()).optional().catch([]),
  status: z.array(z.string()).optional().catch([]),
  priority: z.array(z.string()).optional().catch([]),
  filter: z.string().optional().catch(''),
})

export const Route = createFileRoute('/_authenticated/tasks/')({
  validateSearch: taskSearchSchema,
  component: Tasks,
})
