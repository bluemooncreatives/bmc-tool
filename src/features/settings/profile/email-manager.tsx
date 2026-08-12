import { useState } from 'react'
import { CheckCircle2, Loader2, MailPlus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ApiError, apiFetch } from '@/lib/api-client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  type AccountProfile,
  type EmailChallenge,
  type ProfileResponse,
} from './profile-types'

type EmailManagerProps = {
  profile: AccountProfile
  onProfileChange: (profile: AccountProfile) => void
}

function messageFor(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback
}

export function EmailManager({ profile, onProfileChange }: EmailManagerProps) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [challenge, setChallenge] = useState<EmailChallenge | null>(null)
  const [isWorking, setIsWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isAtLimit = profile.emails.length >= 5

  async function requestCode() {
    setIsWorking(true)
    setError(null)
    try {
      const response = await apiFetch<EmailChallenge>('/api/account/emails', {
        method: 'POST',
        body: { email },
      })
      setChallenge(response)
      setCode('')
      toast.success(`A verification code was sent to ${response.email}.`)
    } catch (requestError) {
      setError(messageFor(requestError, 'Could not send a verification code.'))
    } finally {
      setIsWorking(false)
    }
  }

  async function verifyCode() {
    if (!challenge) return
    setIsWorking(true)
    setError(null)
    try {
      const response = await apiFetch<ProfileResponse>(
        '/api/account/emails/verify',
        {
          method: 'POST',
          body: { challengeId: challenge.challengeId, code },
        }
      )
      onProfileChange(response.profile)
      setChallenge(null)
      setEmail('')
      setCode('')
      toast.success('Email address verified and added.')
    } catch (requestError) {
      setError(messageFor(requestError, 'Could not verify that code.'))
    } finally {
      setIsWorking(false)
    }
  }

  async function resendCode() {
    if (!challenge) return
    setIsWorking(true)
    setError(null)
    try {
      const response = await apiFetch<EmailChallenge>(
        '/api/account/emails/resend',
        { method: 'POST', body: { challengeId: challenge.challengeId } }
      )
      setChallenge(response)
      setCode('')
      toast.success(`A new code was sent to ${response.email}.`)
    } catch (requestError) {
      setError(messageFor(requestError, 'Could not resend the code.'))
    } finally {
      setIsWorking(false)
    }
  }

  async function removeEmail(address: string) {
    setIsWorking(true)
    setError(null)
    try {
      const response = await apiFetch<ProfileResponse>('/api/account/emails', {
        method: 'DELETE',
        body: { email: address },
      })
      onProfileChange(response.profile)
      toast.success('Email address removed.')
    } catch (requestError) {
      setError(messageFor(requestError, 'Could not remove that email address.'))
    } finally {
      setIsWorking(false)
    }
  }

  return (
    <div className='space-y-4 rounded-md border p-4'>
      <div>
        <h4 className='text-sm font-medium'>Email addresses</h4>
        <p className='mt-1 text-sm text-muted-foreground'>
          Your primary email identifies your account and cannot be changed.
          Verified secondary addresses can be used as your displayed email.
        </p>
      </div>

      <div className='space-y-2'>
        {profile.emails.map((entry) => (
          <div
            key={entry.address}
            className='flex min-w-0 items-center gap-2 rounded-md border px-3 py-2'
          >
            <CheckCircle2 className='size-4 shrink-0 text-emerald-600' />
            <span className='min-w-0 flex-1 truncate text-sm'>
              {entry.address}
            </span>
            {entry.isPrimary && <Badge variant='secondary'>Primary</Badge>}
            {!entry.isPrimary && (
              <Button
                type='button'
                size='icon'
                variant='ghost'
                aria-label={`Remove ${entry.address}`}
                disabled={isWorking || entry.address === profile.displayEmail}
                onClick={() => void removeEmail(entry.address)}
              >
                <Trash2 />
              </Button>
            )}
          </div>
        ))}
      </div>

      {!challenge ? (
        <div className='flex flex-col gap-2 sm:flex-row'>
          <Input
            type='email'
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder='another@example.com'
            aria-label='New email address'
            disabled={isWorking}
          />
          <Button
            type='button'
            variant='outline'
            disabled={isWorking || isAtLimit || !email.trim()}
            onClick={() => void requestCode()}
          >
            {isWorking ? <Loader2 className='animate-spin' /> : <MailPlus />}
            Add email
          </Button>
        </div>
      ) : (
        <div className='space-y-3 rounded-md bg-muted/50 p-3'>
          <p className='text-sm'>
            Enter the 6-digit code sent to {challenge.email}.
          </p>
          <Input
            value={code}
            onChange={(event) =>
              setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
            }
            inputMode='numeric'
            autoComplete='one-time-code'
            aria-label='Email verification code'
            placeholder='000000'
            disabled={isWorking}
          />
          <div className='flex flex-wrap gap-2'>
            <Button
              type='button'
              disabled={isWorking || code.length !== 6}
              onClick={() => void verifyCode()}
            >
              {isWorking && <Loader2 className='animate-spin' />}
              Verify email
            </Button>
            <Button
              type='button'
              variant='outline'
              disabled={isWorking}
              onClick={() => void resendCode()}
            >
              Resend code
            </Button>
            <Button
              type='button'
              variant='ghost'
              disabled={isWorking}
              onClick={() => setChallenge(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {isAtLimit && !challenge && (
        <p className='text-xs text-muted-foreground'>
          You have reached the limit of 5 email addresses.
        </p>
      )}

      {error && (
        <p role='alert' className='text-sm text-destructive'>
          {error}
        </p>
      )}
    </div>
  )
}
