import { createFileRoute } from '@tanstack/react-router'
import { PermissionManager } from '@/features/permission-manager'

export const Route = createFileRoute('/_authenticated/permission-manager/')({
  component: PermissionManager,
})
