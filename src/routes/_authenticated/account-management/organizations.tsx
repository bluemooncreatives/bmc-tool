import { createFileRoute } from '@tanstack/react-router'
import { Organizations } from '@/features/account-management/organizations'

export const Route = createFileRoute(
  '/_authenticated/account-management/organizations'
)({
  component: Organizations,
})
