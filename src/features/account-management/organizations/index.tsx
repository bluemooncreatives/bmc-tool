import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Archive,
  Building2,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search as SearchIcon,
  ShieldPlus,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { ApiError } from '@/lib/api-client'
import {
  ORGANIZATION_STATUSES,
  ORGANIZATION_STATUS_LABELS,
  ORGANIZATION_TYPES,
  ORGANIZATION_TYPE_LABELS,
} from '@/lib/organizations'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { HeaderActions } from '@/components/header-actions'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import {
  OrganizationStatusBadge,
  StatTile,
  TemporaryPasswordNotice,
} from '../components/shared'
import { deleteOrganization, listOrganizations } from '../data/api'
import { type Organization } from '../data/types'
import { OrganizationAdminDialog } from './organization-admin-dialog'
import { OrganizationFormSheet } from './organization-form-sheet'

type PendingDelete = {
  organization: Organization
  mode: 'archive' | 'purge'
}

export function Organizations() {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Organization | null>(null)
  const [adminTarget, setAdminTarget] = useState<Organization | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [credentials, setCredentials] = useState<{
    email: string
    password: string
  } | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await listOrganizations({ includeArchived: true })
      setOrganizations(response.organizations)
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Could not load organizations.'
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    // Initial server synchronization; load owns every state update.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  // Filtering stays client-side: the endpoint caps at 200 tenants, which is
  // small enough to keep typing instant and avoid a request per keystroke.
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return organizations.filter((organization) => {
      if (statusFilter !== 'all' && organization.status !== statusFilter) {
        return false
      }
      if (typeFilter !== 'all' && organization.type !== typeFilter) return false
      if (!needle) return true
      return `${organization.name} ${organization.code} ${organization.contactEmail} ${organization.industry}`
        .toLowerCase()
        .includes(needle)
    })
  }, [organizations, search, statusFilter, typeFilter])

  const totals = useMemo(() => {
    return organizations.reduce(
      (accumulator, organization) => ({
        organizations: accumulator.organizations + 1,
        active:
          accumulator.active + (organization.status === 'active' ? 1 : 0),
        members:
          accumulator.members + (organization.stats?.totalMembers ?? 0),
        pending:
          accumulator.pending + (organization.stats?.pendingMembers ?? 0),
      }),
      { organizations: 0, active: 0, members: 0, pending: 0 }
    )
  }, [organizations])

  function upsert(organization: Organization) {
    setOrganizations((current) => {
      const exists = current.some((entry) => entry.id === organization.id)
      return exists
        ? current.map((entry) =>
            entry.id === organization.id ? organization : entry
          )
        : [organization, ...current]
    })
    // Member counts change as a side effect of provisioning, so refresh.
    void load()
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setIsDeleting(true)
    try {
      const response = await deleteOrganization(
        pendingDelete.organization.id,
        pendingDelete.mode
      )
      toast.success(
        response.mode === 'purge'
          ? `${pendingDelete.organization.name} was permanently deleted.`
          : `${pendingDelete.organization.name} was archived and its members signed out.`
      )
      setPendingDelete(null)
      await load()
    } catch (requestError) {
      toast.error(
        requestError instanceof ApiError
          ? requestError.message
          : 'Could not delete the organization.'
      )
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <Header fixed>
        <Search />
        <HeaderActions />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-1 flex-col gap-5'>
        <div className='flex flex-wrap items-end justify-between gap-3'>
          <div className='min-w-0'>
            <div className='flex items-center gap-2'>
              <Building2 className='size-7 text-primary' />
              <h2 className='text-2xl font-bold tracking-tight'>
                Organizations
              </h2>
            </div>
            <p className='mt-1 text-muted-foreground'>
              Every organization connected to the platform, what it is entitled
              to, and who runs it.
            </p>
          </div>
          <div className='flex gap-2'>
            <Button variant='outline' onClick={() => void load()}>
              <RefreshCw className={isLoading ? 'animate-spin' : undefined} />
              Refresh
            </Button>
            <Button
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
            >
              <Plus />
              New organization
            </Button>
          </div>
        </div>

        {credentials && (
          <TemporaryPasswordNotice
            email={credentials.email}
            password={credentials.password}
            onDismiss={() => setCredentials(null)}
          />
        )}

        {error && (
          <div
            role='alert'
            className='flex flex-col items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between'
          >
            <span>{error}</span>
            <Button variant='outline' size='sm' onClick={() => void load()}>
              Retry
            </Button>
          </div>
        )}

        <div className='grid gap-3 @2xl/content:grid-cols-4'>
          <StatTile label='Organizations' value={totals.organizations} />
          <StatTile label='Active' value={totals.active} />
          <StatTile label='Accounts' value={totals.members} />
          <StatTile
            label='Awaiting approval'
            value={totals.pending}
            hint='Members who cannot sign in yet'
          />
        </div>

        <Card className='min-w-0 overflow-hidden'>
          <CardContent className='space-y-4'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
              <div className='relative flex-1'>
                <SearchIcon className='absolute top-2.5 left-3 size-4 text-muted-foreground' />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder='Search name, code, contact, industry'
                  className='ps-9'
                  aria-label='Search organizations'
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className='sm:w-44'>
                  <SelectValue placeholder='Status' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All statuses</SelectItem>
                  {ORGANIZATION_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {ORGANIZATION_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className='sm:w-44'>
                  <SelectValue placeholder='Type' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All types</SelectItem>
                  {ORGANIZATION_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {ORGANIZATION_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className='text-end'>Accounts</TableHead>
                    <TableHead className='text-end'>Admins</TableHead>
                    <TableHead className='text-end'>Seats left</TableHead>
                    <TableHead>Modules</TableHead>
                    <TableHead className='w-12' />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading &&
                    Array.from({ length: 4 }, (_, index) => (
                      <TableRow key={index}>
                        <TableCell colSpan={8}>
                          <Skeleton className='h-9 w-full' />
                        </TableCell>
                      </TableRow>
                    ))}

                  {!isLoading && visible.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className='py-10 text-center text-sm text-muted-foreground'
                      >
                        No organizations match these filters.
                      </TableCell>
                    </TableRow>
                  )}

                  {visible.map((organization) => (
                    <TableRow key={organization.id}>
                      <TableCell>
                        <div className='min-w-0'>
                          <div className='flex items-center gap-2'>
                            <span className='font-medium'>
                              {organization.name}
                            </span>
                            {organization.isSystemOrg && (
                              <Badge variant='secondary'>Internal</Badge>
                            )}
                          </div>
                          <span className='block font-mono text-xs text-muted-foreground'>
                            {organization.code}
                            {organization.contactEmail
                              ? ` · ${organization.contactEmail}`
                              : ''}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className='text-sm'>
                        {ORGANIZATION_TYPE_LABELS[organization.type]}
                      </TableCell>
                      <TableCell>
                        <OrganizationStatusBadge status={organization.status} />
                      </TableCell>
                      <TableCell className='text-end tabular-nums'>
                        {organization.stats?.totalMembers ?? 0}
                      </TableCell>
                      <TableCell className='text-end tabular-nums'>
                        {organization.stats?.admins ?? 0}
                      </TableCell>
                      <TableCell className='text-end tabular-nums'>
                        {organization.stats?.seatsRemaining === null ||
                        organization.stats?.seatsRemaining === undefined
                          ? '∞'
                          : organization.stats.seatsRemaining}
                      </TableCell>
                      <TableCell className='text-sm text-muted-foreground'>
                        {organization.enabledModules.length} enabled
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant='ghost'
                              size='icon'
                              aria-label={`Actions for ${organization.name}`}
                            >
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align='end'>
                            <DropdownMenuItem
                              onClick={() => {
                                setEditing(organization)
                                setFormOpen(true)
                              }}
                            >
                              <Pencil />
                              Edit organization
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setAdminTarget(organization)}
                            >
                              <ShieldPlus />
                              Add administrator
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled={
                                organization.isSystemOrg ||
                                organization.status === 'archived'
                              }
                              onClick={() =>
                                setPendingDelete({
                                  organization,
                                  mode: 'archive',
                                })
                              }
                            >
                              <Archive />
                              Archive
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant='destructive'
                              disabled={organization.isSystemOrg}
                              onClick={() =>
                                setPendingDelete({
                                  organization,
                                  mode: 'purge',
                                })
                              }
                            >
                              <Trash2 />
                              Delete permanently
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </Main>

      <OrganizationFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        organization={editing}
        onSaved={upsert}
        onAdminProvisioned={(result) => {
          if (result.temporaryPassword) {
            setCredentials({
              email: result.email,
              password: result.temporaryPassword,
            })
          } else {
            toast.success(`Invitation sent to ${result.email}.`)
          }
        }}
      />

      <OrganizationAdminDialog
        organization={adminTarget}
        onOpenChange={(open) => {
          if (!open) setAdminTarget(null)
        }}
        onProvisioned={(result) => {
          if (result.temporaryPassword) {
            setCredentials({
              email: result.email,
              password: result.temporaryPassword,
            })
          }
          void load()
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        destructive
        isLoading={isDeleting}
        title={
          pendingDelete?.mode === 'purge'
            ? `Permanently delete ${pendingDelete?.organization.name}?`
            : `Archive ${pendingDelete?.organization.name}?`
        }
        desc={
          pendingDelete?.mode === 'purge' ? (
            <span>
              This removes the organization completely and cannot be undone. It
              only works when the organization has no accounts left — move or
              delete them first.
            </span>
          ) : (
            <span>
              Archiving keeps every record but signs out all{' '}
              {pendingDelete?.organization.stats?.totalMembers ?? 0} member
              accounts and stops them from signing back in. You can reactivate
              the organization later.
            </span>
          )
        }
        confirmText={
          isDeleting ? (
            <>
              <Loader2 className='animate-spin' />
              Working
            </>
          ) : pendingDelete?.mode === 'purge' ? (
            'Delete permanently'
          ) : (
            'Archive organization'
          )
        }
        handleConfirm={() => void confirmDelete()}
      />
    </>
  )
}
