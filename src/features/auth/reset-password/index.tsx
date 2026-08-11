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
import { ResetPasswordForm } from './reset-password-form'

export function ResetPassword() {
  const { challenge } = useSearch({ from: '/(auth)/reset-password' })

  return (
    <AuthLayout>
      <Card className='max-w-sm gap-4 sm:min-w-sm'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>
            Create a new password
          </CardTitle>
          <CardDescription>
            Use at least eight characters with uppercase, lowercase, and a
            number.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResetPasswordForm challengeId={challenge ?? ''} />
        </CardContent>
        <CardFooter>
          <Link
            to='/sign-in'
            className='mx-auto text-sm underline underline-offset-4 hover:text-primary'
          >
            Return to sign in
          </Link>
        </CardFooter>
      </Card>
    </AuthLayout>
  )
}
