import { useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { ApiError } from '@/lib/api-client'
import { SignInPage } from '@/components/ui/sign-in'
import { AUTH_HERO_IMAGE } from '@/features/auth/hero'

export function SignIn() {
  const { redirect } = useSearch({ from: '/(auth)/sign-in' })
  const navigate = useNavigate()
  const { auth } = useAuthStore()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    // Read the form before awaiting — currentTarget is nulled once React
    // finishes handling the event.
    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email') ?? '')
    const password = String(formData.get('password') ?? '')
    const rememberMe = formData.get('rememberMe') !== null

    setError(null)
    setIsLoading(true)

    try {
      const user = await auth.signIn({ email, password, rememberMe })
      toast.success(`Welcome back, ${user.email}!`)
      navigate({ to: redirect || '/', replace: true })
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not reach the server. Please try again.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <SignInPage
      title='Welcome back'
      description='Sign in to the Blue Moon Creatives operations workspace.'
      heroImageSrc={AUTH_HERO_IMAGE}
      error={error}
      isLoading={isLoading}
      onSignIn={handleSignIn}
      onResetPassword={() => navigate({ to: '/forgot-password' })}
      onCreateAccount={() => navigate({ to: '/sign-up' })}
    />
  )
}
