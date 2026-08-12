import { createFileRoute } from '@tanstack/react-router'
import { AccountControl } from '@/features/account-management/account-control'

export const Route = createFileRoute(
  '/_authenticated/account-management/account-control'
)({
  component: AccountControl,
})
