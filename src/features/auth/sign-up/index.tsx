import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { ApiError } from '@/lib/api-client'
import { SignUpPage } from '@/components/ui/sign-up'
import { AUTH_HERO_IMAGE } from '@/features/auth/hero'

const MIN_PASSWORD_LENGTH = 8

export function SignUp() {
  const navigate = useNavigate()
  const { auth } = useAuthStore()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSignUp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email') ?? '')
    const password = String(formData.get('password') ?? '')
    const confirmPassword = String(formData.get('confirmPassword') ?? '')

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`
      )
      return
    }

    if (
      !/[a-z]/.test(password) ||
      !/[A-Z]/.test(password) ||
      !/\d/.test(password)
    ) {
      setError('Password must include uppercase, lowercase, and a number.')
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords don't match.")
      return
    }

    setError(null)
    setIsLoading(true)

    try {
      const user = await auth.signUp({ email, password })
      toast.success(
        `Account created for ${user.email}. A Super Admin can now grant module access.`
      )
      navigate({ to: '/403', replace: true })
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not create the account. Please try again.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <SignUpPage
      title='Create account'
      description='Set up your access to the Blue Moon Creatives workspace.'
      heroImageSrc={AUTH_HERO_IMAGE}
      error={error}
      isLoading={isLoading}
      onSignUp={handleSignUp}
      onSignIn={() => navigate({ to: '/sign-in' })}
    />
  )
}
