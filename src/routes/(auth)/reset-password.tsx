import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { ResetPassword } from '@/features/auth/reset-password'

export const Route = createFileRoute('/(auth)/reset-password')({
  component: ResetPassword,
  validateSearch: z.object({ challenge: z.string().optional() }),
})
