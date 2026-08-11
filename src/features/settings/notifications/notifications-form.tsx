import { useCallback, useEffect, useMemo, useState } from 'react'
import { BellRing, Loader2, RotateCcw, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { apiFetch, ApiError } from '@/lib/api-client'
import {
  NOTIFICATION_CATEGORY_DEFINITIONS,
  REQUIRED_NOTIFICATION_CATEGORIES,
  type NotificationCategory,
  type NotificationPreferences,
} from '@/lib/notifications'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'

const requiredCategories = new Set<NotificationCategory>(
  REQUIRED_NOTIFICATION_CATEGORIES
)

function sameCategories(
  left: NotificationCategory[],
  right: NotificationCategory[]
): boolean {
  return (
    left.length === right.length &&
    left.every((category) => right.includes(category))
  )
}

export function NotificationsForm() {
  const [saved, setSaved] = useState<NotificationCategory[]>([])
  const [muted, setMuted] = useState<NotificationCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadPreferences = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await apiFetch<NotificationPreferences>(
        '/api/notifications/preferences'
      )
      setSaved(response.mutedCategories)
      setMuted(response.mutedCategories)
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Could not load notification preferences.'
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    // Initial server synchronization; loadPreferences owns the state updates.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPreferences()
  }, [loadPreferences])

  const isDirty = useMemo(() => !sameCategories(saved, muted), [muted, saved])

  function setCategoryEnabled(
    category: NotificationCategory,
    enabled: boolean
  ) {
    if (requiredCategories.has(category)) return
    setMuted((current) => {
      const next = new Set(current)
      if (enabled) next.delete(category)
      else next.add(category)
      return NOTIFICATION_CATEGORY_DEFINITIONS.map((item) => item.key).filter(
        (key) => next.has(key)
      )
    })
  }

  async function savePreferences() {
    if (!isDirty || isSaving) return
    setIsSaving(true)
    setError(null)
    try {
      const response = await apiFetch<NotificationPreferences>(
        '/api/notifications/preferences',
        { method: 'PATCH', body: { mutedCategories: muted } }
      )
      setSaved(response.mutedCategories)
      setMuted(response.mutedCategories)
      toast.success('Notification preferences updated.')
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Could not update notification preferences.'
      )
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className='grid gap-3' aria-label='Loading notification preferences'>
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className='h-20 w-full rounded-lg' />
        ))}
      </div>
    )
  }

  if (error && !isDirty && saved.length === 0) {
    return (
      <div className='rounded-lg border border-destructive/40 bg-destructive/5 p-5'>
        <p className='text-sm text-destructive'>{error}</p>
        <Button
          type='button'
          variant='outline'
          size='sm'
          className='mt-4'
          onClick={() => void loadPreferences()}
        >
          Try again
        </Button>
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      <div className='rounded-lg border bg-muted/30 p-4'>
        <div className='flex items-start gap-3'>
          <BellRing className='mt-0.5 size-5 shrink-0 text-primary' />
          <div>
            <h3 className='font-medium'>Central notification center</h3>
            <p className='mt-1 text-sm leading-relaxed text-muted-foreground'>
              Choose which workspace sections can send updates to your header
              notification center. System and security events always remain on
              so important account alerts cannot be missed.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <p
          role='alert'
          className='rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive'
        >
          {error}
        </p>
      )}

      <div className='grid gap-3'>
        {NOTIFICATION_CATEGORY_DEFINITIONS.map((category) => {
          const required = requiredCategories.has(category.key)
          const enabled = required || !muted.includes(category.key)
          return (
            <div
              key={category.key}
              className='flex min-w-0 items-center justify-between gap-4 rounded-lg border p-4'
            >
              <div className='flex min-w-0 items-start gap-3'>
                <span className='mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary'>
                  {required ? (
                    <ShieldCheck className='size-4' />
                  ) : (
                    <BellRing className='size-4' />
                  )}
                </span>
                <div className='min-w-0'>
                  <p className='text-sm font-medium'>{category.title}</p>
                  <p className='mt-0.5 text-xs leading-relaxed text-muted-foreground'>
                    {category.description}
                    {required && ' Always enabled.'}
                  </p>
                </div>
              </div>
              <Switch
                checked={enabled}
                disabled={required || isSaving}
                onCheckedChange={(checked) =>
                  setCategoryEnabled(category.key, checked)
                }
                aria-label={`${category.title} notifications`}
              />
            </div>
          )
        })}
      </div>

      <div className='sticky bottom-0 flex flex-col-reverse gap-2 border-t bg-background/95 py-4 backdrop-blur sm:flex-row sm:justify-end'>
        <Button
          type='button'
          variant='outline'
          disabled={!isDirty || isSaving}
          onClick={() => setMuted(saved)}
        >
          <RotateCcw className='size-4' />
          Discard
        </Button>
        <Button
          type='button'
          disabled={!isDirty || isSaving}
          onClick={() => void savePreferences()}
        >
          {isSaving && <Loader2 className='size-4 animate-spin' />}
          Save preferences
        </Button>
      </div>
    </div>
  )
}
