import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Loader2, Search, ShieldCheck, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { apiFetch, ApiError } from '@/lib/api-client'
import {
  MODULE_DEFINITIONS,
  MODULE_KEYS,
  type ModuleKey,
} from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'

type ManagedUser = {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'superadmin' | 'user'
  status: 'active' | 'inactive' | 'invited' | 'suspended'
  modulePermissions: ModuleKey[]
  isSystemOwner: boolean
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
}

function displayName(user: ManagedUser): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
}

function samePermissions(left: ModuleKey[], right: ModuleKey[]): boolean {
  return (
    left.length === right.length &&
    left.every((permission) => right.includes(permission))
  )
}

export function PermissionManager() {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ModuleKey[]>([])
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadUsers = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await apiFetch<{ users: ManagedUser[] }>(
        '/api/admin/permissions'
      )
      setUsers(response.users)
      setSelectedId((current) => {
        if (current && response.users.some((user) => user.id === current)) {
          return current
        }
        return (
          response.users.find((user) => !user.isSystemOwner)?.id ??
          response.users[0]?.id ??
          null
        )
      })
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Could not load users. Please try again.'
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    // Initial server synchronization; loadUsers performs updates after fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadUsers()
  }, [loadUsers])

  const selected = users.find((user) => user.id === selectedId) ?? null

  useEffect(() => {
    // Draft state intentionally resets when the selected database record changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(selected?.modulePermissions ?? [])
  }, [selected])

  const visibleUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return users
    return users.filter((user) =>
      `${displayName(user)} ${user.email}`.toLowerCase().includes(normalized)
    )
  }, [query, users])

  const isDirty = selected
    ? !samePermissions(draft, selected.modulePermissions)
    : false

  function togglePermission(permission: ModuleKey, enabled: boolean) {
    setDraft((current) => {
      const next = new Set(current)
      if (enabled) next.add(permission)
      else next.delete(permission)
      return MODULE_KEYS.filter((key) => next.has(key))
    })
  }

  async function savePermissions() {
    if (!selected || selected.isSystemOwner || !isDirty) return
    setIsSaving(true)
    setError(null)
    try {
      const response = await apiFetch<{ user: ManagedUser }>(
        '/api/admin/permissions',
        {
          method: 'PATCH',
          body: {
            userId: selected.id,
            permissions: draft,
            expectedUpdatedAt: selected.updatedAt,
          },
        }
      )
      setUsers((current) =>
        current.map((user) =>
          user.id === response.user.id ? response.user : user
        )
      )
      setDraft(response.user.modulePermissions)
      toast.success(`Module access updated for ${response.user.email}.`)
    } catch (requestError) {
      const message =
        requestError instanceof ApiError
          ? requestError.message
          : 'Could not save module access. Please try again.'
      setError(message)
      if (requestError instanceof ApiError && requestError.status === 409) {
        await loadUsers()
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <Header fixed>
        <div className='me-auto' />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-1 flex-col gap-5'>
        <div>
          <div className='flex items-center gap-2'>
            <ShieldCheck className='size-7 text-primary' />
            <h2 className='text-2xl font-bold tracking-tight'>
              Permission Manager
            </h2>
          </div>
          <p className='mt-1 text-muted-foreground'>
            Grant each user access to only the workspace modules they need.
            Changes revoke their existing sessions immediately.
          </p>
        </div>

        {error && (
          <div
            role='alert'
            className='flex items-center justify-between gap-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive'
          >
            <span>{error}</span>
            <Button
              variant='outline'
              size='sm'
              onClick={() => void loadUsers()}
            >
              Retry
            </Button>
          </div>
        )}

        <div className='grid min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(260px,0.75fr)_minmax(0,2fr)]'>
          <Card className='min-h-96'>
            <CardHeader className='gap-3'>
              <CardTitle className='text-base'>Users</CardTitle>
              <div className='relative'>
                <Search className='absolute top-2.5 left-3 size-4 text-muted-foreground' />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder='Search name or email'
                  className='ps-9'
                  aria-label='Search users'
                />
              </div>
            </CardHeader>
            <CardContent className='grid max-h-[58vh] gap-2 overflow-y-auto'>
              {isLoading &&
                Array.from({ length: 5 }, (_, index) => (
                  <Skeleton key={index} className='h-16 w-full' />
                ))}
              {!isLoading && visibleUsers.length === 0 && (
                <p className='py-8 text-center text-sm text-muted-foreground'>
                  No users found.
                </p>
              )}
              {visibleUsers.map((user) => (
                <button
                  key={user.id}
                  type='button'
                  onClick={() => setSelectedId(user.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors hover:bg-muted',
                    selectedId === user.id && 'border-primary bg-primary/5'
                  )}
                >
                  <span className='flex size-9 shrink-0 items-center justify-center rounded-full bg-muted'>
                    {user.isSystemOwner ? (
                      <ShieldCheck className='size-4' />
                    ) : (
                      <UserRound className='size-4' />
                    )}
                  </span>
                  <span className='min-w-0 flex-1'>
                    <span className='block truncate text-sm font-medium'>
                      {displayName(user)}
                    </span>
                    <span className='block truncate text-xs text-muted-foreground'>
                      {user.email}
                    </span>
                  </span>
                  <Badge
                    variant={user.status === 'active' ? 'default' : 'secondary'}
                  >
                    {user.status}
                  </Badge>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className='min-h-96'>
            {!selected ? (
              <CardContent className='flex h-full min-h-96 items-center justify-center text-sm text-muted-foreground'>
                Select a user to manage module access.
              </CardContent>
            ) : (
              <>
                <CardHeader className='flex-row items-start justify-between gap-4'>
                  <div>
                    <CardTitle className='text-lg'>
                      {displayName(selected)}
                    </CardTitle>
                    <p className='mt-1 text-sm text-muted-foreground'>
                      {selected.email}
                    </p>
                  </div>
                  <Badge
                    variant={selected.isSystemOwner ? 'default' : 'outline'}
                  >
                    {selected.isSystemOwner ? 'Super Admin' : 'User'}
                  </Badge>
                </CardHeader>
                <CardContent className='grid gap-5'>
                  {selected.isSystemOwner ? (
                    <div className='rounded-md border border-primary/30 bg-primary/5 p-4 text-sm'>
                      The system owner always has access to every module. These
                      permissions cannot be reduced or delegated.
                    </div>
                  ) : (
                    <div className='flex flex-wrap gap-2'>
                      <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        onClick={() => setDraft([...MODULE_KEYS])}
                      >
                        Select all
                      </Button>
                      <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        onClick={() => setDraft([])}
                      >
                        Clear all
                      </Button>
                      <span className='ms-auto self-center text-xs text-muted-foreground'>
                        {draft.length} of {MODULE_KEYS.length} modules selected
                      </span>
                    </div>
                  )}

                  <div className='grid gap-3 sm:grid-cols-2'>
                    {MODULE_DEFINITIONS.map((module) => {
                      const checked =
                        selected.isSystemOwner || draft.includes(module.key)
                      return (
                        <Label
                          key={module.key}
                          htmlFor={`permission-${module.key}`}
                          className={cn(
                            'flex cursor-pointer items-start gap-3 rounded-md border p-4 transition-colors',
                            checked && 'border-primary/50 bg-primary/5',
                            selected.isSystemOwner && 'cursor-not-allowed'
                          )}
                        >
                          <Checkbox
                            id={`permission-${module.key}`}
                            checked={checked}
                            disabled={selected.isSystemOwner || isSaving}
                            onCheckedChange={(value) =>
                              togglePermission(module.key, value === true)
                            }
                          />
                          <span className='min-w-0'>
                            <span className='flex items-center gap-1.5 font-medium'>
                              {module.title}
                              {checked && (
                                <Check className='size-3.5 text-primary' />
                              )}
                            </span>
                            <span className='mt-1 block text-xs leading-relaxed text-muted-foreground'>
                              {module.description}
                            </span>
                          </span>
                        </Label>
                      )
                    })}
                  </div>

                  {!selected.isSystemOwner && (
                    <div className='flex justify-end gap-2 border-t pt-4'>
                      <Button
                        type='button'
                        variant='outline'
                        disabled={!isDirty || isSaving}
                        onClick={() => setDraft(selected.modulePermissions)}
                      >
                        Discard
                      </Button>
                      <Button
                        type='button'
                        disabled={!isDirty || isSaving}
                        onClick={() => void savePermissions()}
                      >
                        {isSaving && <Loader2 className='animate-spin' />}
                        Save access
                      </Button>
                    </div>
                  )}
                </CardContent>
              </>
            )}
          </Card>
        </div>
      </Main>
    </>
  )
}
