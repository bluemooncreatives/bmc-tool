import { useCallback, useEffect, useState } from 'react'
import { z } from 'zod'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore, type AuthUser } from '@/stores/auth-store'
import {
  dateOnlyToLocalDate,
  isValidDateOfBirth,
  localDateToDateOnly,
  SUPPORTED_LANGUAGES,
} from '@/lib/account-profile'
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
import { DatePicker } from '@/components/date-picker'
import { EmailManager } from './email-manager'
import { type AccountProfile, type ProfileResponse } from './profile-types'

const MAX_URLS = 5
const profileFormSchema = z.object({
  name: z
    .string('Please enter your name.')
    .trim()
    .min(2, 'Name must be at least 2 characters.')
    .max(80, 'Name must not be longer than 80 characters.'),
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
  dateOfBirth: z.string().refine(isValidDateOfBirth, {
    message: 'Select a valid date of birth between 1900 and today.',
  }),
  language: z.string().min(1, 'Please select a supported language.'),
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
    .max(MAX_URLS)
    .refine(
      (urls) =>
        new Set(
          urls.map((entry) => {
            try {
              return new URL(entry.value).toString()
            } catch {
              return entry.value
            }
          })
        ).size === urls.length,
      'Duplicate URLs are not allowed.'
    ),
})

type ProfileFormValues = z.infer<typeof profileFormSchema>

const emptyValues: ProfileFormValues = {
  name: '',
  username: '',
  email: '',
  dateOfBirth: '',
  language: '',
  bio: '',
  urls: [],
}

function formValues(profile: AccountProfile): ProfileFormValues {
  return {
    name: profile.name,
    username: profile.username,
    email: profile.displayEmail,
    dateOfBirth: profile.dateOfBirth,
    language: profile.language,
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
            name: values.name,
            username: values.username,
            displayEmail: values.email,
            dateOfBirth: values.dateOfBirth,
            language: values.language,
            bio: values.bio,
            urls: values.urls.map((entry) => entry.value),
            expectedUpdatedAt: profile.updatedAt,
          },
        }
      )
      setProfile(response.profile)
      setUser(response.user)
      form.reset(formValues(response.profile))
      toast.success('Profile and account updated.')
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : 'Could not update your profile and account.'
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
        Loading profile and account…
      </div>
    )
  }
  if (loadError || !profile) {
    return (
      <div
        role='alert'
        className='space-y-3 rounded-lg border border-destructive/40 p-5 text-sm text-destructive'
      >
        <p>{loadError ?? 'Could not load your profile and account.'}</p>
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
        <section className='grid gap-6 md:grid-cols-2'>
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
                  Your public handle. You can change it once every 30 days.
                  {usernameLocked && profile.usernameAvailableAt
                    ? ` Next available ${new Date(profile.usernameAvailableAt).toLocaleDateString()}.`
                    : ''}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='name'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input
                    autoComplete='name'
                    placeholder='Your full name'
                    disabled={form.formState.isSubmitting}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Used on your profile and in account communication.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

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
                  <SelectTrigger className='w-full'>
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
                Your primary account email is immutable. Verified secondary
                addresses can be selected for display.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <EmailManager profile={profile} onProfileChange={acceptEmailProfile} />

        <section className='grid gap-6 md:grid-cols-2'>
          <FormField
            control={form.control}
            name='dateOfBirth'
            render={({ field }) => (
              <FormItem className='flex flex-col'>
                <FormLabel>Date of birth</FormLabel>
                <DatePicker
                  selected={dateOnlyToLocalDate(field.value)}
                  onSelect={(date) => field.onChange(localDateToDateOnly(date))}
                  placeholder='Select date of birth'
                  aria-label='Date of birth'
                  className='w-full'
                  disabled={form.formState.isSubmitting}
                />
                <FormDescription>
                  Stored as a calendar date without timezone conversion.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='language'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Language</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={form.formState.isSubmitting}
                >
                  <FormControl>
                    <SelectTrigger className='w-full'>
                      <SelectValue placeholder='Select language' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {SUPPORTED_LANGUAGES.map((language) => (
                      <SelectItem key={language.value} value={language.value}>
                        {language.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Your preferred language for the dashboard.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

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
                  className='min-h-28 resize-y'
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

        <section className='space-y-3'>
          <div className='flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between'>
            <div>
              <p className='text-sm font-medium'>URLs</p>
              <p className='text-sm text-muted-foreground'>
                Add up to {MAX_URLS} website, portfolio, or social links.
              </p>
            </div>
            <Button
              type='button'
              variant='outline'
              size='sm'
              disabled={
                fields.length >= MAX_URLS || form.formState.isSubmitting
              }
              onClick={() => append({ value: '' })}
            >
              <Plus />
              Add URL
            </Button>
          </div>
          {fields.length === 0 ? (
            <div className='rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground'>
              No URLs added yet.
            </div>
          ) : (
            <div className='grid gap-4 md:grid-cols-2'>
              {fields.map((item, index) => (
                <FormField
                  control={form.control}
                  key={item.id}
                  name={`urls.${index}.value`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className='sr-only'>URL {index + 1}</FormLabel>
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
                          disabled={form.formState.isSubmitting}
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
            </div>
          )}
          {form.formState.errors.urls?.root?.message && (
            <p role='alert' className='text-sm text-destructive'>
              {form.formState.errors.urls.root.message}
            </p>
          )}
        </section>

        {form.formState.errors.root?.message && (
          <p
            role='alert'
            className='rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive'
          >
            {form.formState.errors.root.message}
          </p>
        )}
        <div className='sticky bottom-0 flex justify-end border-t bg-background/95 py-4 backdrop-blur'>
          <Button
            type='submit'
            disabled={form.formState.isSubmitting || !form.formState.isDirty}
          >
            {form.formState.isSubmitting && (
              <Loader2 className='animate-spin' />
            )}
            Update profile & account
          </Button>
        </div>
      </form>
    </Form>
  )
}
