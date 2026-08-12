import { createFileRoute } from '@tanstack/react-router'
import { CreateUser } from '@/features/account-management/create-user'

export const Route = createFileRoute(
  '/_authenticated/account-management/create-user'
)({
  component: CreateUser,
})
