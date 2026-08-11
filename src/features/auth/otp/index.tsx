import { Link, useSearch } from '@tanstack/react-router'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AuthLayout } from '../auth-layout'
import { OtpForm } from './components/otp-form'

export function Otp() {
  const search = useSearch({ from: '/(auth)/otp' })
  const purpose = search.purpose ?? 'sign-in'

  return (
    <AuthLayout>
      <Card className='max-w-md gap-4'>
        <CardHeader>
          <CardTitle className='text-base tracking-tight'>
            {purpose === 'sign-in'
              ? 'Two-factor authentication'
              : 'Verify your email'}
          </CardTitle>
          <CardDescription>
            Enter the six-digit code sent to{' '}
            <strong>{search.email ?? 'your email'}</strong>. The code expires in
            10 minutes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OtpForm
            challengeId={search.challenge ?? ''}
            email={search.email}
            purpose={purpose}
            redirect={search.redirect}
          />
        </CardContent>
        <CardFooter>
          <p className='px-8 text-center text-sm text-muted-foreground'>
            Entered the wrong email?{' '}
            <Link
              to={purpose === 'sign-in' ? '/sign-in' : '/forgot-password'}
              className='underline underline-offset-4 hover:text-primary'
            >
              Start again
            </Link>
            .
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  )
}
