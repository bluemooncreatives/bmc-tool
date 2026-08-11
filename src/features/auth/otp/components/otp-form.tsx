import { useEffect, useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useAuthStore, type AuthUser } from '@/stores/auth-store'
import { apiFetch, ApiError } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from '@/components/ui/input-otp'

const formSchema = z.object({
  otp: z
    .string()
    .min(6, 'Please enter the 6-digit code.')
    .max(6, 'Please enter the 6-digit code.'),
})

type OtpFormProps = React.HTMLAttributes<HTMLFormElement> & {
  challengeId?: string
  email?: string
  purpose?: 'sign-in' | 'password-reset'
  redirect?: string
}

export function OtpForm({
  className,
  challengeId: initialChallengeId = '',
  email,
  purpose: _purpose = 'sign-in',
  redirect,
  ...props
}: OtpFormProps) {
  const navigate = useNavigate()
  const { auth } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [challengeId, setChallengeId] = useState(initialChallengeId)
  const [secondsUntilResend, setSecondsUntilResend] = useState(60)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (secondsUntilResend <= 0) return
    const timer = window.setInterval(
      () => setSecondsUntilResend((seconds) => Math.max(0, seconds - 1)),
      1000
    )
    return () => window.clearInterval(timer)
  }, [secondsUntilResend])

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { otp: '' },
  })

  // eslint-disable-next-line react-hooks/incompatible-library
  const otp = form.watch('otp')

  async function onSubmit(data: z.infer<typeof formSchema>) {
    if (!challengeId) {
      setServerError('This verification request is missing. Start again.')
      return
    }
    setIsLoading(true)
    setServerError(null)
    try {
      const response = await apiFetch<
        | { purpose: 'sign-in'; user: AuthUser }
        | { purpose: 'password-reset'; challengeId: string }
      >('/api/auth/otp/verify', {
        method: 'POST',
        body: { challengeId, code: data.otp },
      })

      if (response.purpose === 'sign-in') {
        auth.setUser(response.user)
        toast.success(`Welcome back, ${response.user.email}!`)
        navigate({ to: redirect || '/', replace: true })
      } else {
        navigate({
          to: '/reset-password',
          search: { challenge: response.challengeId },
          replace: true,
        })
      }
    } catch (error) {
      setServerError(
        error instanceof ApiError
          ? error.message
          : 'Could not verify the code. Please try again.'
      )
      form.setValue('otp', '')
    } finally {
      setIsLoading(false)
    }
  }

  async function resend() {
    if (!challengeId || secondsUntilResend > 0) return
    setIsResending(true)
    setServerError(null)
    try {
      const response = await apiFetch<{
        challengeId: string
        email: string
        resendAfter: number
      }>('/api/auth/otp/resend', {
        method: 'POST',
        body: { challengeId },
      })
      setChallengeId(response.challengeId)
      setSecondsUntilResend(response.resendAfter)
      form.setValue('otp', '')
      toast.success(`A new code was sent to ${response.email || email}.`)
    } catch (error) {
      setServerError(
        error instanceof ApiError
          ? error.message
          : 'Could not send a new code. Please try again.'
      )
    } finally {
      setIsResending(false)
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-2', className)}
        {...props}
      >
        <FormField
          control={form.control}
          name='otp'
          render={({ field }) => (
            <FormItem>
              <FormLabel className='sr-only'>One-Time Password</FormLabel>
              <FormControl>
                <InputOTP
                  maxLength={6}
                  {...field}
                  containerClassName='justify-between sm:[&>[data-slot="input-otp-group"]>div]:w-12'
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button className='mt-2' disabled={otp.length < 6 || isLoading}>
          {isLoading ? 'Verifying…' : 'Verify code'}
        </Button>
        {serverError && (
          <p role='alert' className='text-sm text-destructive'>
            {serverError}
          </p>
        )}
        <Button
          type='button'
          variant='ghost'
          disabled={secondsUntilResend > 0 || isResending || isLoading}
          onClick={resend}
        >
          {isResending
            ? 'Sending…'
            : secondsUntilResend > 0
              ? `Resend code in ${secondsUntilResend}s`
              : 'Resend code'}
        </Button>
      </form>
    </Form>
  )
}
