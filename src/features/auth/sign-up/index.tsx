import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { ApiError, apiFetch } from '@/lib/api-client'
import {
  isExternalOrganization,
  type PublicOrganizationOption,
} from '@/lib/organizations'
import { SignUpPage } from '@/components/ui/sign-up'
import { AUTH_HERO_IMAGE } from '@/features/auth/hero'

const MIN_PASSWORD_LENGTH = 8

export function SignUp() {
  const navigate = useNavigate()
  const { auth } = useAuthStore()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [organizations, setOrganizations] = useState<
    PublicOrganizationOption[]
  >([])
  const [isLoadingOrganizations, setIsLoadingOrganizations] = useState(true)
  const [organizationLoadError, setOrganizationLoadError] = useState<
    string | null
  >(null)
  const [organizationCode, setOrganizationCode] = useState('')
  const organizationRequest = useRef(0)

  const loadOrganizations = useCallback(async () => {
    const requestId = ++organizationRequest.current
    setIsLoadingOrganizations(true)
    setOrganizationLoadError(null)
    try {
      const response = await apiFetch<{
        organizations: PublicOrganizationOption[]
      }>('/api/organizations')
      if (requestId !== organizationRequest.current) return

      // The server already applies this rule. Filtering again prevents a stale
      // proxy response from ever rendering the internal organization.
      const externalOrganizations = response.organizations.filter(
        isExternalOrganization
      )
      setOrganizations(externalOrganizations)
      setOrganizationCode((current) =>
        externalOrganizations.some(
          (organization) => organization.code === current
        )
          ? current
          : ''
      )
    } catch (requestError) {
      if (requestId !== organizationRequest.current) return
      setOrganizations([])
      setOrganizationCode('')
      setOrganizationLoadError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Could not load organizations.'
      )
    } finally {
      if (requestId === organizationRequest.current) {
        setIsLoadingOrganizations(false)
      }
    }
  }, [])

  useEffect(() => {
    // Initial server synchronization; loadOrganizations owns async state updates.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadOrganizations()
    return () => {
      organizationRequest.current += 1
    }
  }, [loadOrganizations])

  async function handleSignUp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const username = String(formData.get('username') ?? '')
    const email = String(formData.get('email') ?? '')
    const password = String(formData.get('password') ?? '')
    const confirmPassword = String(formData.get('confirmPassword') ?? '')

    if (
      !organizationCode ||
      !organizations.some(
        (organization) => organization.code === organizationCode
      )
    ) {
      setError('Select the organization you are joining.')
      return
    }

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
    setNotice(null)
    setIsLoading(true)

    try {
      const result = await auth.signUp({
        username,
        email,
        password,
        organizationCode,
      })

      // Organizations that vet their members answer without a session.
      if ('pendingApproval' in result) {
        setNotice(result.message)
        toast.success('Your request was sent for approval.')
        return
      }

      toast.success(
        `Account created for ${result.email}. Your administrator can now grant module access.`
      )
      navigate({ to: '/', replace: true })
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
      description='Join your organization inside the Blue Moon Creatives workspace.'
      heroImageSrc={AUTH_HERO_IMAGE}
      error={error}
      notice={notice}
      isLoading={isLoading}
      organizations={organizations}
      isLoadingOrganizations={isLoadingOrganizations}
      organizationCode={organizationCode}
      organizationLoadError={organizationLoadError}
      onOrganizationChange={(code) => {
        setOrganizationCode(code)
        setError(null)
      }}
      onRetryOrganizations={() => void loadOrganizations()}
      onSignUp={handleSignUp}
      onSignIn={() => navigate({ to: '/sign-in' })}
    />
  )
}
