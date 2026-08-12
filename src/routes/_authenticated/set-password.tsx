import { createFileRoute } from '@tanstack/react-router'
import { SetPassword } from '@/features/auth/set-password'

export const Route = createFileRoute('/_authenticated/set-password')({
  component: SetPassword,
})
