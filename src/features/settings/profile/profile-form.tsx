import { useCallback, useEffect, useState } from 'react'
import { z } from 'zod'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore, type AuthUser } from '@/stores/auth-store'
import { ApiError, apiFetch } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { EmailManager } from './email-manager'
import { type AccountProfile, type ProfileResponse } from './profile-types'

const MAX_URLS = 5
const profileFormSchema = z.object({
  username: z
    .string('Please enter your username.')
    .trim()
    .min(2, 'Username must be at least 2 characters.')
    .max(30, 'Username must not be longer than 30 characters.')
    .regex(
      /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/,
      'Use letters, numbers, periods, underscores, or hyphens.'
    ),
  email: z.email('Please select an email to display.'),
  bio: z.string().max(160, 'Bio must not exceed 160 characters.'),
  urls: z
    .array(
      z.object({
        value: z.url('Please enter a valid URL.').refine((value) => {
          try {
            return ['http:', 'https:'].includes(new URL(value).protocol)
          } catch {
            return false
          }
        }, 'Please enter an HTTP or HTTPS URL.'),
      })
    )
    .max(MAX_URLS),
})

type ProfileFormValues = z.infer<typeof profileFormSchema>

const emptyValues: ProfileFormValues = {
  username: '',
  email: '',
  bio: '',
  urls: [],
}

function formValues(profile: AccountProfile): ProfileFormValues {
  return {
    username: profile.username,
    email: profile.displayEmail,
    bio: profile.bio,
    urls: profile.urls.map((value) => ({ value })),
  }
}

export function ProfileForm() {
  const setUser = useAuthStore((state) => state.auth.setUser)
  const [profile, setProfile] = useState<AccountProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: emptyValues,
    mode: 'onChange',
  })
  const { fields, append, remove } = useFieldArray({
    name: 'urls',
    control: form.control,
  })

  const loadProfile = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const response = await apiFetch<ProfileResponse>('/api/account/profile')
      setProfile(response.profile)
      form.reset(formValues(response.profile))
    } catch (error) {
      setLoadError(
        error instanceof ApiError
          ? error.message
          : 'Could not load your profile.'
      )
    } finally {
      setIsLoading(false)
    }
  }, [form])

  useEffect(() => {
    // Initial server synchronization; loadProfile owns the async state updates.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProfile()
  }, [loadProfile])

  async function submit(values: ProfileFormValues) {
    if (!profile) return
    try {
      const response = await apiFetch<ProfileResponse & { user: AuthUser }>(
        '/api/account/profile',
        {
          method: 'PATCH',
          body: {
            username: values.username,
            displayEmail: values.email,
            bio: values.bio,
            urls: values.urls.map((entry) => entry.value),
            expectedUpdatedAt: profile.updatedAt,
          },
        }
      )
      setProfile(response.profile)
      setUser(response.user)
      form.reset(formValues(response.profile))
      toast.success('Profile updated.')
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : 'Could not update your profile.'
      form.setError('root', { message })
      if (
        error instanceof ApiError &&
        error.status === 409 &&
        error.message.includes('another session')
      ) {
        void loadProfile()
      }
    }
  }

  function acceptEmailProfile(next: AccountProfile) {
    setProfile(next)
    if (
      !next.emails.some((entry) => entry.address === form.getValues('email'))
    ) {
      form.setValue('email', next.displayEmail, { shouldDirty: true })
    }
  }

  if (isLoading) {
    return (
      <div className='flex items-center gap-2 py-8 text-sm text-muted-foreground'>
        <Loader2 className='animate-spin' />
        Loading profile…
      </div>
    )
  }
  if (loadError || !profile) {
    return (
      <div
        role='alert'
        className='space-y-3 rounded-md border border-destructive/40 p-4 text-sm text-destructive'
      >
        <p>{loadError ?? 'Could not load your profile.'}</p>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={() => void loadProfile()}
        >
          Retry
        </Button>
      </div>
    )
  }

  const usernameLocked = Boolean(
    profile.usernameAvailableAt &&
    new Date(profile.usernameAvailableAt) > new Date()
  )

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className='space-y-8'>
        <FormField
          control={form.control}
          name='username'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input
                  placeholder='bmc-team-member'
                  disabled={usernameLocked || form.formState.isSubmitting}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                This is your public display name. You can change it once every
                30 days.
                {usernameLocked && profile.usernameAvailableAt
                  ? ` Your next change is available on ${new Date(profile.usernameAvailableAt).toLocaleDateString()}.`
                  : ''}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='email'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Displayed email</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value}
                disabled={form.formState.isSubmitting}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder='Select a verified email to display' />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {profile.emails
                    .filter((entry) => entry.verified)
                    .map((entry) => (
                      <SelectItem key={entry.address} value={entry.address}>
                        {entry.address}
                        {entry.isPrimary ? ' (primary)' : ''}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Your primary account email cannot be changed. Add verified
                addresses below for display purposes.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <EmailManager profile={profile} onProfileChange={acceptEmailProfile} />

        <FormField
          control={form.control}
          name='bio'
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Bio{' '}
                <span className='font-normal text-muted-foreground'>
                  (optional)
                </span>
              </FormLabel>
              <FormControl>
                <Textarea
                  placeholder='Tell us a little bit about yourself'
                  className='resize-none'
                  rows={4}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                {field.value.length}/160 characters
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className='space-y-2'>
          <div>
            <p className='text-sm font-medium'>
              URLs{' '}
              <span className='font-normal text-muted-foreground'>
                (optional)
              </span>
            </p>
            <p className='text-sm text-muted-foreground'>
              Add up to {MAX_URLS} links to your website, blog, or social
              profiles.
            </p>
          </div>
          {fields.map((item, index) => (
            <FormField
              control={form.control}
              key={item.id}
              name={`urls.${index}.value`}
              render={({ field }) => (
                <FormItem>
                  <div className='flex items-start gap-2'>
                    <FormControl>
                      <Input
                        aria-label={`URL ${index + 1}`}
                        placeholder='https://example.com'
                        {...field}
                      />
                    </FormControl>
                    <Button
                      type='button'
                      variant='outline'
                      size='icon'
                      aria-label={`Remove URL ${index + 1}`}
                      onClick={() => remove(index)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={fields.length >= MAX_URLS}
            onClick={() => append({ value: '' })}
          >
            Add URL
          </Button>
        </div>

        {form.formState.errors.root?.message && (
          <p role='alert' className='text-sm text-destructive'>
            {form.formState.errors.root.message}
          </p>
        )}
        <Button
          type='submit'
          disabled={form.formState.isSubmitting || !form.formState.isDirty}
        >
          {form.formState.isSubmitting && <Loader2 className='animate-spin' />}
          Update profile
        </Button>
      </form>
    </Form>
  )
}
