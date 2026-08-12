import { useCallback, useEffect, useMemo, useState } from 'react'
import { Eye, Loader2, RotateCcw, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { ApiError, apiFetch } from '@/lib/api-client'
import { type ModuleKey } from '@/lib/permissions'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { MODULE_ICONS } from '@/components/app-icons'
import {
  type DisplayPreferences,
  type DisplayPreferencesResponse,
} from './display-types'

function sameItems(left: string[], right: string[]) {
  return (
    left.length === right.length && left.every((item) => right.includes(item))
  )
}

export function DisplayForm() {
  const setUser = useAuthStore((state) => state.auth.setUser)
  const [preferences, setPreferences] = useState<DisplayPreferences | null>(
    null
  )
  const [selectedItems, setSelectedItems] = useState<ModuleKey[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadPreferences = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await apiFetch<DisplayPreferencesResponse>(
        '/api/account/display'
      )
      setPreferences(response.preferences)
      setSelectedItems(response.preferences.selectedItems)
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Could not load display preferences.'
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

  const isDirty = useMemo(
    () =>
      Boolean(
        preferences && !sameItems(preferences.selectedItems, selectedItems)
      ),
    [preferences, selectedItems]
  )

  const groups = useMemo(() => {
    if (!preferences) return []
    return [...new Set(preferences.availableItems.map((item) => item.group))]
  }, [preferences])

  function setItemVisible(id: ModuleKey, visible: boolean, required: boolean) {
    if (required) return
    setSelectedItems((current) => {
      const next = new Set(current)
      if (visible) next.add(id)
      else next.delete(id)
      return (
        preferences?.availableItems
          .map((item) => item.id)
          .filter((item) => next.has(item)) ?? []
      )
    })
  }

  async function savePreferences() {
    if (!preferences || !isDirty || isSaving) return
    setIsSaving(true)
    setError(null)
    try {
      const response = await apiFetch<DisplayPreferencesResponse>(
        '/api/account/display',
        {
          method: 'PATCH',
          body: {
            selectedItems,
            expectedUpdatedAt: preferences.updatedAt,
          },
        }
      )
      setPreferences(response.preferences)
      setSelectedItems(response.preferences.selectedItems)
      if (response.user) setUser(response.user)
      toast.success('Display preferences updated.')
    } catch (requestError) {
      const message =
        requestError instanceof ApiError
          ? requestError.message
          : 'Could not update display preferences.'
      setError(message)
      if (requestError instanceof ApiError && requestError.status === 409) {
        void loadPreferences()
      }
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className='grid gap-3' aria-label='Loading display preferences'>
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className='h-20 w-full rounded-lg' />
        ))}
      </div>
    )
  }

  if (!preferences) {
    return (
      <div className='rounded-lg border border-destructive/40 bg-destructive/5 p-5'>
        <p role='alert' className='text-sm text-destructive'>
          {error ?? 'Could not load display preferences.'}
        </p>
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
          <Eye className='mt-0.5 size-5 shrink-0 text-primary' />
          <div>
            <h3 className='font-medium'>Personal navigation</h3>
            <p className='mt-1 text-sm leading-relaxed text-muted-foreground'>
              These choices only change your sidebar. They do not grant or
              revoke access, and can be changed again at any time.
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

      {groups.map((group) => (
        <section
          key={group}
          className='space-y-3'
          aria-labelledby={`display-${group}`}
        >
          <div>
            <h4 id={`display-${group}`} className='text-sm font-medium'>
              {group}
            </h4>
            <p className='text-xs text-muted-foreground'>
              Choose which {group.toLowerCase()} links appear.
            </p>
          </div>
          <div className='grid gap-3'>
            {preferences.availableItems
              .filter((item) => item.group === group)
              .map((item) => {
                const checked = item.required || selectedItems.includes(item.id)
                const ItemIcon = MODULE_ICONS[item.id]
                return (
                  <Label
                    key={item.id}
                    htmlFor={`display-item-${item.id}`}
                    className='flex min-w-0 cursor-pointer items-start gap-3 rounded-lg border p-4 has-aria-disabled:cursor-not-allowed has-aria-disabled:opacity-70'
                  >
                    <Checkbox
                      id={`display-item-${item.id}`}
                      checked={checked}
                      disabled={item.required || isSaving}
                      onCheckedChange={(value) =>
                        setItemVisible(item.id, value === true, item.required)
                      }
                    />
                    <span className='flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary'>
                      <ItemIcon className='size-4' aria-hidden='true' />
                    </span>
                    <span className='min-w-0 flex-1'>
                      <span className='flex items-center gap-2 text-sm font-medium'>
                        {item.label}
                        {item.required && (
                          <ShieldCheck className='size-3.5 text-primary' />
                        )}
                      </span>
                      <span className='mt-0.5 block text-xs leading-relaxed text-muted-foreground'>
                        {item.description}
                        {item.required
                          ? ' Always visible so these settings remain accessible.'
                          : ''}
                      </span>
                    </span>
                  </Label>
                )
              })}
          </div>
        </section>
      ))}

      <div className='sticky bottom-0 flex flex-col-reverse gap-2 border-t bg-background/95 py-4 backdrop-blur sm:flex-row sm:justify-end'>
        <Button
          type='button'
          variant='outline'
          disabled={!isDirty || isSaving}
          onClick={() => setSelectedItems(preferences.selectedItems)}
        >
          <RotateCcw />
          Discard
        </Button>
        <Button
          type='button'
          disabled={!isDirty || isSaving}
          onClick={() => void savePreferences()}
        >
          {isSaving && <Loader2 className='animate-spin' />}
          Update display
        </Button>
      </div>
    </div>
  )
}
