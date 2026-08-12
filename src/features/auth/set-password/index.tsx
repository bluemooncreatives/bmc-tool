import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { KeyRound, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { ApiError, apiFetch } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { PasswordInput } from '@/components/password-input'
import { ProfileDropdown } from '@/components/profile-dropdown'

type ChangePasswordResponse = {
  user: Parameters<
    ReturnType<typeof useAuthStore.getState>['auth']['setUser']
  >[0]
}

/**
 * Where a provisioned account lands on its first sign-in.
 *
 * The current password is only required once the account is off its temporary
 * one — the route guard sends people here precisely because they arrived with
 * a password an administrator generated for them.
 */
export function SetPassword() {
  const navigate = useNavigate()
  const { auth } = useAuthStore()
  const user = auth.user
  const isForced = Boolean(user?.mustChangePassword)

  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (password !== confirmPassword) {
      setError("Passwords don't match.")
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      const response = await apiFetch<ChangePasswordResponse>(
        '/api/auth/password/change',
        {
          method: 'POST',
          body: {
            ...(isForced ? {} : { currentPassword }),
            password,
            confirmPassword,
          },
        }
      )
      auth.setUser(response.user)
      toast.success('Password updated. Other sessions were signed out.')
      navigate({ to: '/', replace: true })
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Could not update the password.'
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <Header fixed>
        <div className='ms-auto'>
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 items-start justify-center'>
        <Card className='w-full max-w-lg'>
          <CardHeader>
            <div className='flex items-center gap-2'>
              <KeyRound className='size-5 text-primary' />
              <CardTitle>
                {isForced ? 'Set your own password' : 'Change your password'}
              </CardTitle>
            </div>
            <CardDescription>
              {isForced
                ? 'Your account was created by an administrator with a temporary password. Choose your own to finish activating it — the temporary one stops working immediately.'
                : 'Choosing a new password signs out every other device.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className='space-y-4'>
              {!isForced && (
                <div className='space-y-2'>
                  <Label htmlFor='current-password'>Current password</Label>
                  <PasswordInput
                    id='current-password'
                    required
                    autoComplete='current-password'
                    value={currentPassword}
                    onChange={(event) =>
                      setCurrentPassword(event.target.value)
                    }
                  />
                </div>
              )}

              <div className='space-y-2'>
                <Label htmlFor='new-password'>New password</Label>
                <PasswordInput
                  id='new-password'
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete='new-password'
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <p className='text-xs text-muted-foreground'>
                  At least 8 characters, including an uppercase letter, a
                  lowercase letter, and a number.
                </p>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='confirm-password'>Confirm new password</Label>
                <PasswordInput
                  id='confirm-password'
                  required
                  autoComplete='new-password'
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </div>

              {error && (
                <p
                  role='alert'
                  className='rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive'
                >
                  {error}
                </p>
              )}

              <Button type='submit' className='w-full' disabled={isSaving}>
                {isSaving && <Loader2 className='animate-spin' />}
                Save password
              </Button>
            </form>
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
