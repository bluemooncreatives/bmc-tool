import React from 'react'
import { Loader2 } from 'lucide-react'
import { type PublicOrganizationOption } from '@/lib/organizations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  /** Organizations that have opted into public sign-up. */
  organizations?: PublicOrganizationOption[]
  isLoadingOrganizations?: boolean
  organizationCode?: string
  organizationLoadError?: string | null
  onOrganizationChange?: (code: string) => void
  onRetryOrganizations?: () => void
  /** Message shown in place of the form once a request needs approval. */
  notice?: string | null
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
  organizations = [],
  isLoadingOrganizations = false,
  organizationCode = '',
  organizationLoadError = null,
  onOrganizationChange,
  onRetryOrganizations,
  notice = null,
}) => {
  return (
    <AuthPageShell heroImageSrc={heroImageSrc} testimonials={testimonials}>
      <BrandMark />
      <AuthHeading title={title} description={description} />

      {notice && (
        <p
          role='status'
          className='animate-element animate-delay-200 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm'
        >
          {notice}
        </p>
      )}

      <form className='grid gap-4' onSubmit={onSignUp}>
        <AuthField
          htmlFor='organizationCode'
          label='Organization'
          delayClassName='animate-delay-200'
        >
          <input
            type='hidden'
            name='organizationCode'
            value={organizationCode}
          />
          <Select
            value={organizationCode}
            onValueChange={onOrganizationChange}
            disabled={
              isLoading ||
              isLoadingOrganizations ||
              Boolean(organizationLoadError) ||
              organizations.length === 0
            }
          >
            <SelectTrigger
              id='organizationCode'
              className='w-full'
              aria-describedby='organization-help'
            >
              {isLoadingOrganizations && (
                <Loader2 className='animate-spin' aria-hidden='true' />
              )}
              <SelectValue
                placeholder={
                  isLoadingOrganizations
                    ? 'Loading organizations…'
                    : organizationLoadError
                      ? 'Organizations unavailable'
                      : organizations.length === 0
                        ? 'No organizations accepting sign-ups'
                        : 'Select an organization'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {organizations.map((organization) => (
                <SelectItem key={organization.id} value={organization.code}>
                  <span className='min-w-0 truncate'>{organization.name}</span>
                  <span className='shrink-0 font-mono text-xs text-muted-foreground'>
                    {organization.code}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div
            id='organization-help'
            className='flex min-h-5 items-center justify-between gap-2 text-xs text-muted-foreground'
          >
            <span>
              {organizationLoadError
                ? organizationLoadError
                : organizations.length === 0 && !isLoadingOrganizations
                  ? 'Ask your administrator to enable external self sign-up.'
                  : 'Only external organizations accepting self sign-up are listed.'}
            </span>
            {organizationLoadError && onRetryOrganizations && (
              <Button
                type='button'
                variant='link'
                size='sm'
                className='h-auto shrink-0 p-0 text-xs'
                onClick={onRetryOrganizations}
                disabled={isLoadingOrganizations}
              >
                Retry
              </Button>
            )}
          </div>
        </AuthField>

        <AuthField
          htmlFor='username'
          label='Username'
          delayClassName='animate-delay-300'
        >
          <Input
            id='username'
            name='username'
            autoComplete='username'
            required
            minLength={2}
            maxLength={30}
            pattern='[A-Za-z0-9][A-Za-z0-9._-]*'
            title='Use letters, numbers, periods, underscores, or hyphens.'
            placeholder='bmc-team-member'
            disabled={isLoading}
          />
        </AuthField>

        <AuthField
          htmlFor='email'
          label='Email Address'
          delayClassName='animate-delay-400'
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
          delayClassName='animate-delay-500'
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
          delayClassName='animate-delay-600'
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

        <SubmitButton
          isLoading={isLoading}
          disabled={
            isLoadingOrganizations ||
            Boolean(organizationLoadError) ||
            organizations.length === 0 ||
            !organizationCode
          }
        >
          Create Account
        </SubmitButton>
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
