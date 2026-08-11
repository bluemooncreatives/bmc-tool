import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { Otp } from '@/features/auth/otp'

export const Route = createFileRoute('/(auth)/otp')({
  component: Otp,
  validateSearch: z.object({
    challenge: z.string().optional(),
    email: z.string().optional(),
    purpose: z.enum(['sign-in', 'password-reset']).optional(),
    redirect: z.string().optional(),
  }),
})
