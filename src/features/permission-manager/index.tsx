import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Check,
  Loader2,
  Search as SearchIcon,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
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
import { MODULE_ICONS } from '@/components/app-icons'
import { HeaderActions } from '@/components/header-actions'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'

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
        <Search />
        <HeaderActions />
        <ProfileDropdown />
      </Header>

      <Main className='flex min-w-0 flex-1 flex-col gap-5'>
        <div className='min-w-0'>
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
            className='flex flex-col items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between'
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

        <div className='grid min-h-0 min-w-0 flex-1 items-start gap-5 @5xl/content:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)]'>
          <Card className='min-h-80 min-w-0 overflow-hidden'>
            <CardHeader className='gap-3'>
              <CardTitle className='text-base'>Users</CardTitle>
              <div className='relative'>
                <SearchIcon className='absolute top-2.5 left-3 size-4 text-muted-foreground' />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder='Search name or email'
                  className='ps-9'
                  aria-label='Search users'
                />
              </div>
            </CardHeader>
            <CardContent className='grid max-h-[58vh] min-w-0 grid-cols-[minmax(0,1fr)] gap-2 overflow-x-hidden overflow-y-auto'>
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
                  disabled={isSaving}
                  className={cn(
                    'flex w-full min-w-0 items-center gap-3 overflow-hidden rounded-md border p-3 text-left transition-colors hover:bg-muted disabled:cursor-wait disabled:opacity-70',
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
                    className='max-w-20 shrink-0 truncate'
                  >
                    {user.status}
                  </Badge>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className='@container/permissions min-h-96 min-w-0 overflow-hidden'>
            {!selected ? (
              <CardContent className='flex h-full min-h-96 items-center justify-center text-sm text-muted-foreground'>
                Select a user to manage module access.
              </CardContent>
            ) : (
              <>
                <CardHeader className='flex flex-col items-start gap-3 sm:flex-row sm:justify-between'>
                  <div className='min-w-0 flex-1'>
                    <CardTitle className='text-lg break-words'>
                      {displayName(selected)}
                    </CardTitle>
                    <p className='mt-1 text-sm break-all text-muted-foreground'>
                      {selected.email}
                    </p>
                  </div>
                  <Badge
                    variant={selected.isSystemOwner ? 'default' : 'outline'}
                    className='shrink-0'
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
                    <div className='flex flex-col items-start gap-3 sm:flex-row sm:items-center'>
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
                      </div>
                      <span className='text-xs text-muted-foreground sm:ms-auto sm:text-end'>
                        {draft.length} of {MODULE_KEYS.length} modules selected
                      </span>
                    </div>
                  )}

                  <div className='grid min-w-0 gap-3 @3xl/permissions:grid-cols-2'>
                    {MODULE_DEFINITIONS.map((module) => {
                      const checked =
                        selected.isSystemOwner || draft.includes(module.key)
                      const ModuleIcon = MODULE_ICONS[module.key]
                      return (
                        <Label
                          key={module.key}
                          htmlFor={`permission-${module.key}`}
                          className={cn(
                            'flex min-w-0 cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors sm:p-4',
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
                          <span className='flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary'>
                            <ModuleIcon className='size-4' aria-hidden='true' />
                          </span>
                          <span className='min-w-0 flex-1'>
                            <span className='flex min-w-0 items-center gap-1.5 font-medium'>
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
                    <div className='flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end'>
                      <Button
                        type='button'
                        variant='outline'
                        disabled={!isDirty || isSaving}
                        onClick={() => setDraft(selected.modulePermissions)}
                        className='w-full sm:w-auto'
                      >
                        Discard
                      </Button>
                      <Button
                        type='button'
                        disabled={!isDirty || isSaving}
                        onClick={() => void savePermissions()}
                        className='w-full sm:w-auto'
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
