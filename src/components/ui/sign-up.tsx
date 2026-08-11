import React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AuthDivider,
  AuthField,
  AuthHeading,
  AuthPageShell,
  BrandMark,
  FormError,
  GoogleButton,
  SubmitButton,
  type AuthPageBaseProps,
} from '@/components/ui/sign-in'
import { PasswordInput } from '@/components/password-input'

interface SignUpPageProps extends AuthPageBaseProps {
  onSignUp?: (event: React.FormEvent<HTMLFormElement>) => void
  onSignIn?: () => void
}

/**
 * Sign-up counterpart to SignInPage. Shares the shell, fields and animation
 * classes so the two pages read as one flow.
 */
export const SignUpPage: React.FC<SignUpPageProps> = ({
  title = 'Create account',
  description = 'Set up your Blue Moon Creatives Tool account to get started',
  heroImageSrc,
  testimonials = [],
  error,
  isLoading = false,
  onSignUp,
  onGoogleSignIn,
  onSignIn,
}) => {
  return (
    <AuthPageShell heroImageSrc={heroImageSrc} testimonials={testimonials}>
      <BrandMark />
      <AuthHeading title={title} description={description} />

      <form className='grid gap-4' onSubmit={onSignUp}>
        <AuthField
          htmlFor='email'
          label='Email Address'
          delayClassName='animate-delay-300'
        >
          <Input
            id='email'
            name='email'
            type='email'
            autoComplete='email'
            required
            placeholder='name@example.com'
            disabled={isLoading}
          />
        </AuthField>

        <AuthField
          htmlFor='password'
          label='Password'
          delayClassName='animate-delay-400'
        >
          <PasswordInput
            id='password'
            name='password'
            autoComplete='new-password'
            required
            placeholder='8+ characters, upper/lowercase and a number'
            disabled={isLoading}
          />
        </AuthField>

        <AuthField
          htmlFor='confirmPassword'
          label='Confirm Password'
          delayClassName='animate-delay-500'
        >
          <PasswordInput
            id='confirmPassword'
            name='confirmPassword'
            autoComplete='new-password'
            required
            placeholder='********'
            disabled={isLoading}
          />
        </AuthField>

        <FormError message={error} />

        <SubmitButton isLoading={isLoading}>Create Account</SubmitButton>
      </form>

      {onGoogleSignIn && <AuthDivider />}
      <GoogleButton
        label='Sign up with Google'
        onClick={onGoogleSignIn}
        disabled={isLoading}
      />

      <p className='animate-element animate-delay-900 text-center text-sm text-muted-foreground'>
        Already have an account?{' '}
        <Button
          type='button'
          variant='link'
          size='sm'
          className='h-auto p-0'
          onClick={onSignIn}
        >
          Sign In
        </Button>
      </p>
    </AuthPageShell>
  )
}
