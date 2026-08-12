import z from 'zod'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { hasActiveTasksAccess, hasModulePermission } from '@/lib/permissions'
import { TasksRoute } from '@/features/tasks/tasks-route'

const taskSearchSchema = z.object({
  page: z.number().optional().catch(1),
  pageSize: z.number().optional().catch(10),
  // Label/status/priority values are user-editable (see task-options-store),
  // so they're validated as plain strings rather than a fixed enum.
  label: z.array(z.string()).optional().catch([]),
  status: z.array(z.string()).optional().catch([]),
  priority: z.array(z.string()).optional().catch([]),
  filter: z.string().optional().catch(''),
  view: z.enum(['active']).optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/tasks/')({
  validateSearch: taskSearchSchema,
  beforeLoad: ({ search }) => {
    const user = useAuthStore.getState().auth.user
    if (!user) return
    const allowed =
      search.view === 'active'
        ? hasActiveTasksAccess(user)
        : hasModulePermission(user, 'tasks')
    if (!allowed) throw redirect({ to: '/403' })
  },
  component: TasksRoute,
})
