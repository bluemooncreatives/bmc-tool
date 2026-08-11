import React from 'react'
import { Loader2 } from 'lucide-react'
import { Logo } from '@/assets/logo'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/password-input'

// --- HELPER COMPONENTS (ICONS) ---

const GoogleIcon = () => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    className='size-4'
    viewBox='0 0 48 48'
    aria-hidden='true'
  >
    <path
      fill='#FFC107'
      d='M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s12-5.373 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-2.641-.21-5.236-.611-7.743z'
    />
    <path
      fill='#FF3D00'
      d='M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z'
    />
    <path
      fill='#4CAF50'
      d='M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z'
    />
    <path
      fill='#1976D2'
      d='M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.022 35.026 44 30.038 44 24c0-2.641-.21-5.236-.611-7.743z'
    />
  </svg>
)

// --- TYPE DEFINITIONS ---

export interface Testimonial {
  avatarSrc: string
  name: string
  handle: string
  text: string
}

export interface AuthPageBaseProps {
  title?: React.ReactNode
  description?: React.ReactNode
  heroImageSrc?: string
  testimonials?: Testimonial[]
  /** Server-side message to surface above the submit button. */
  error?: string | null
  /** Disables the form and shows a spinner on the submit button. */
  isLoading?: boolean
  onGoogleSignIn?: () => void
}

interface SignInPageProps extends AuthPageBaseProps {
  onSignIn?: (event: React.FormEvent<HTMLFormElement>) => void
  onResetPassword?: () => void
  onCreateAccount?: () => void
}

// --- SHARED SUB-COMPONENTS ---

/** BMC wordmark shown above the heading on both auth pages. */
export const BrandMark = () => (
  <div className='animate-element flex items-center gap-2'>
    <Logo className='size-8' />
    <span className='text-lg font-medium'>Blue Moon Creatives Tool</span>
  </div>
)

export const AuthHeading = ({
  title,
  description,
}: {
  title: React.ReactNode
  description: React.ReactNode
}) => (
  <div className='flex flex-col gap-2'>
    <h1 className='animate-element animate-delay-100 text-3xl font-semibold tracking-tight md:text-4xl'>
      {title}
    </h1>
    <p className='animate-element animate-delay-200 text-muted-foreground'>
      {description}
    </p>
  </div>
)

/** Label + control pairing used for every field on both pages. */
export const AuthField = ({
  htmlFor,
  label,
  delayClassName,
  children,
}: {
  htmlFor: string
  label: string
  delayClassName: string
  children: React.ReactNode
}) => (
  <div className={`animate-element ${delayClassName} grid gap-2`}>
    <Label htmlFor={htmlFor}>{label}</Label>
    {children}
  </div>
)

export const FormError = ({ message }: { message?: string | null }) =>
  message ? (
    <Alert variant='destructive' role='alert'>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  ) : null

export const SubmitButton = ({
  isLoading,
  children,
}: {
  isLoading?: boolean
  children: React.ReactNode
}) => (
  <Button
    type='submit'
    size='lg'
    disabled={isLoading}
    className='animate-element animate-delay-600 w-full'
  >
    {isLoading && <Loader2 className='animate-spin' />}
    {children}
  </Button>
)

const TestimonialCard = ({
  testimonial,
  delay,
}: {
  testimonial: Testimonial
  delay: string
}) => (
  <div
    className={`animate-testimonial ${delay} flex w-64 items-start gap-3 rounded-xl border bg-card/70 p-4 text-card-foreground shadow-sm backdrop-blur-xl`}
  >
    <img
      src={testimonial.avatarSrc}
      className='size-10 rounded-md object-cover'
      alt=''
    />
    <div className='text-sm leading-snug'>
      <p className='font-medium'>{testimonial.name}</p>
      <p className='text-muted-foreground'>{testimonial.handle}</p>
      <p className='mt-1 text-foreground/80'>{testimonial.text}</p>
    </div>
  </div>
)

/** Right-hand hero column. Renders nothing without an image. */
export const AuthHeroPanel = ({
  heroImageSrc,
  testimonials = [],
}: {
  heroImageSrc?: string
  testimonials?: Testimonial[]
}) => {
  if (!heroImageSrc) return null

  return (
    <section className='relative hidden flex-1 p-2 md:block'>
      <div
        className='animate-slide-right animate-delay-300 absolute inset-2 rounded-xl bg-cover bg-center'
        style={{ backgroundImage: `url(${heroImageSrc})` }}
      />
      {testimonials.length > 0 && (
        <div className='absolute bottom-8 left-1/2 flex w-full -translate-x-1/2 justify-center gap-4 px-8'>
          <TestimonialCard
            testimonial={testimonials[0]}
            delay='animate-delay-1000'
          />
          {testimonials[1] && (
            <div className='hidden xl:flex'>
              <TestimonialCard
                testimonial={testimonials[1]}
                delay='animate-delay-1200'
              />
            </div>
          )}
          {testimonials[2] && (
            <div className='hidden 2xl:flex'>
              <TestimonialCard
                testimonial={testimonials[2]}
                delay='animate-delay-1400'
              />
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export const GoogleButton = ({
  label,
  onClick,
  disabled,
}: {
  label: string
  onClick?: () => void
  disabled?: boolean
}) => {
  // Hidden entirely when no handler is wired, so the page never offers a
  // sign-in path that does not exist.
  if (!onClick) return null

  return (
    <Button
      type='button'
      variant='outline'
      size='lg'
      onClick={onClick}
      disabled={disabled}
      className='animate-element animate-delay-800 w-full'
    >
      <GoogleIcon />
      {label}
    </Button>
  )
}

export const AuthDivider = () => (
  <div className='animate-element animate-delay-700 relative flex items-center justify-center'>
    <span className='w-full border-t' />
    <span className='absolute bg-background px-2 text-xs text-muted-foreground uppercase'>
      Or continue with
    </span>
  </div>
)

/** Shared page chrome: form column on the start side, hero on the end side. */
export const AuthPageShell = ({
  heroImageSrc,
  testimonials,
  children,
}: {
  heroImageSrc?: string
  testimonials?: Testimonial[]
  children: React.ReactNode
}) => (
  <div className='flex h-dvh w-full flex-col md:flex-row'>
    <section className='flex flex-1 items-center justify-center overflow-y-auto p-6 sm:p-8'>
      <div className='flex w-full max-w-sm flex-col gap-6'>{children}</div>
    </section>
    <AuthHeroPanel
      heroImageSrc={heroImageSrc}
      testimonials={testimonials}
    />
  </div>
)

// --- MAIN COMPONENT ---

export const SignInPage: React.FC<SignInPageProps> = ({
  title = 'Welcome back',
  description = 'Access your account and continue your journey with us',
  heroImageSrc,
  testimonials = [],
  error,
  isLoading = false,
  onSignIn,
  onGoogleSignIn,
  onResetPassword,
  onCreateAccount,
}) => {
  return (
    <AuthPageShell heroImageSrc={heroImageSrc} testimonials={testimonials}>
      <BrandMark />
      <AuthHeading title={title} description={description} />

      <form className='grid gap-4' onSubmit={onSignIn}>
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
            autoComplete='current-password'
            required
            placeholder='********'
            disabled={isLoading}
          />
        </AuthField>

        <div className='animate-element animate-delay-500 flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <Checkbox
              id='rememberMe'
              name='rememberMe'
              defaultChecked
              disabled={isLoading}
            />
            <Label htmlFor='rememberMe' className='font-normal'>
              Keep me signed in
            </Label>
          </div>
          <Button
            type='button'
            variant='link'
            size='sm'
            className='h-auto p-0'
            onClick={onResetPassword}
          >
            Reset password
          </Button>
        </div>

        <FormError message={error} />

        <SubmitButton isLoading={isLoading}>Sign In</SubmitButton>
      </form>

      {onGoogleSignIn && <AuthDivider />}
      <GoogleButton
        label='Continue with Google'
        onClick={onGoogleSignIn}
        disabled={isLoading}
      />

      <p className='animate-element animate-delay-900 text-center text-sm text-muted-foreground'>
        New to our platform?{' '}
        <Button
          type='button'
          variant='link'
          size='sm'
          className='h-auto p-0'
          onClick={onCreateAccount}
        >
          Create Account
        </Button>
      </p>
    </AuthPageShell>
  )
}
