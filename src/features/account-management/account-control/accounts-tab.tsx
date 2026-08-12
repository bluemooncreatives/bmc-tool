import { useMemo, useState } from 'react'
import {
  ArrowLeftRight,
  KeyRound,
  LogOut,
  MailPlus,
  MoreHorizontal,
  Pencil,
  Search as SearchIcon,
  ShieldCheck,
  ShieldX,
  Trash2,
  UserMinus,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { ApiError } from '@/lib/api-client'
import { isSuperadmin } from '@/lib/permissions'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import {
  AccountStatusBadge,
  RoleBadge,
  TemporaryPasswordNotice,
} from '../components/shared'
import {
  deleteAccount,
  runAccountAction,
  type AccountActionBody,
} from '../data/api'
import {
  type DirectoryResponse,
  type ManagedAccount,
  type Organization,
} from '../data/types'
import { AccountEditSheet } from './account-edit-sheet'

type PendingConfirm =
  | { kind: 'delete'; account: ManagedAccount }
  | { kind: 'suspend'; account: ManagedAccount }
  | { kind: 'deactivate'; account: ManagedAccount }
  | { kind: 'reset-password'; account: ManagedAccount }
  | { kind: 'force-signout'; account: ManagedAccount }

const CONFIRM_COPY: Record<
  PendingConfirm['kind'],
  { title: string; description: string; confirm: string }
> = {
  delete: {
    title: 'Delete this account?',
    description:
      'The account is removed permanently. Anyone reporting to it is moved up to its own manager so the org chart stays intact.',
    confirm: 'Delete account',
  },
  suspend: {
    title: 'Suspend this account?',
    description:
      'Every session ends immediately and the holder cannot sign back in until an administrator reactivates them.',
    confirm: 'Suspend',
  },
  deactivate: {
    title: 'Deactivate this account?',
    description:
      'The account is retired and stops consuming a seat. Its history and audit trail are kept.',
    confirm: 'Deactivate',
  },
  'reset-password': {
    title: 'Reset this password?',
    description:
      'A new temporary password is generated, every session is signed out, and the holder must set their own password at the next sign-in.',
    confirm: 'Reset password',
  },
  'force-signout': {
    title: 'Sign this account out everywhere?',
    description:
      'All existing tokens are invalidated. The password is unchanged, so they can sign straight back in.',
    confirm: 'Sign out everywhere',
  },
}

/** Account roster with the full lifecycle toolkit on each row. */
export function AccountsTab({
  accounts,
  organizations,
  organization,
  directory,
  isLoading,
  filters,
  onFiltersChange,
  onChanged,
}: {
  accounts: ManagedAccount[]
  organizations: Organization[]
  organization: Organization | null
  directory: DirectoryResponse | null
  isLoading: boolean
  filters: { search: string; status: string; role: string }
  onFiltersChange: (filters: {
    search: string
    status: string
    role: string
  }) => void
  onChanged: () => void
}) {
  const viewer = useAuthStore((state) => state.auth.user)
  const canTransfer = viewer ? isSuperadmin(viewer) : false

  const [editing, setEditing] = useState<ManagedAccount | null>(null)
  const [pending, setPending] = useState<PendingConfirm | null>(null)
  const [transferTarget, setTransferTarget] = useState<ManagedAccount | null>(
    null
  )
  const [transferOrganizationId, setTransferOrganizationId] = useState('')
  const [isWorking, setIsWorking] = useState(false)
  const [credentials, setCredentials] = useState<{
    email: string
    password: string
  } | null>(null)

  const visible = useMemo(() => {
    const needle = filters.search.trim().toLowerCase()
    if (!needle) return accounts
    return accounts.filter((account) =>
      `${account.name} ${account.email} ${account.username} ${account.accountNo} ${account.designationTitle}`
        .toLowerCase()
        .includes(needle)
    )
  }, [accounts, filters.search])

  async function runAction(
    account: ManagedAccount,
    body: AccountActionBody,
    successMessage: string
  ) {
    setIsWorking(true)
    try {
      const response = await runAccountAction(account.id, body)
      if (response.temporaryPassword) {
        setCredentials({
          email: account.email,
          password: response.temporaryPassword,
        })
      } else {
        toast.success(successMessage)
      }
      setPending(null)
      setTransferTarget(null)
      onChanged()
    } catch (requestError) {
      toast.error(
        requestError instanceof ApiError
          ? requestError.message
          : 'Could not complete that action.'
      )
    } finally {
      setIsWorking(false)
    }
  }

  async function confirmPending() {
    if (!pending) return
    const { account, kind } = pending

    if (kind === 'delete') {
      setIsWorking(true)
      try {
        const response = await deleteAccount(account.id)
        toast.success(
          response.reassignedReports > 0
            ? `${account.email} deleted. ${response.reassignedReports} direct report(s) were reassigned.`
            : `${account.email} deleted.`
        )
        setPending(null)
        onChanged()
      } catch (requestError) {
        toast.error(
          requestError instanceof ApiError
            ? requestError.message
            : 'Could not delete the account.'
        )
      } finally {
        setIsWorking(false)
      }
      return
    }

    const messages: Record<Exclude<PendingConfirm['kind'], 'delete'>, string> = {
      suspend: `${account.email} was suspended.`,
      deactivate: `${account.email} was deactivated.`,
      'reset-password': `A new password was sent to ${account.email}.`,
      'force-signout': `${account.email} was signed out everywhere.`,
    }

    await runAction(
      account,
      kind === 'reset-password'
        ? { action: 'reset-password', sendEmail: true }
        : kind === 'force-signout'
          ? { action: 'force-signout' }
          : { action: kind },
      messages[kind]
    )
  }

  return (
    <div className='space-y-4'>
      {credentials && (
        <TemporaryPasswordNotice
          email={credentials.email}
          password={credentials.password}
          onDismiss={() => setCredentials(null)}
        />
      )}

      <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
        <div className='relative flex-1'>
          <SearchIcon className='absolute top-2.5 left-3 size-4 text-muted-foreground' />
          <Input
            value={filters.search}
            onChange={(event) =>
              onFiltersChange({ ...filters, search: event.target.value })
            }
            placeholder='Search name, email, account number, designation'
            className='ps-9'
            aria-label='Search accounts'
          />
        </div>
        <Select
          value={filters.status}
          onValueChange={(value) =>
            onFiltersChange({ ...filters, status: value })
          }
        >
          <SelectTrigger className='sm:w-48'>
            <SelectValue placeholder='Status' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All statuses</SelectItem>
            <SelectItem value='active'>Active</SelectItem>
            <SelectItem value='invited'>Invited</SelectItem>
            <SelectItem value='pending'>Pending approval</SelectItem>
            <SelectItem value='suspended'>Suspended</SelectItem>
            <SelectItem value='inactive'>Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filters.role}
          onValueChange={(value) =>
            onFiltersChange({ ...filters, role: value })
          }
        >
          <SelectTrigger className='sm:w-44'>
            <SelectValue placeholder='Role' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All roles</SelectItem>
            <SelectItem value='org_admin'>Organization Admin</SelectItem>
            <SelectItem value='user'>Member</SelectItem>
            <SelectItem value='superadmin'>Super Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className='overflow-x-auto'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className='text-end'>Modules</TableHead>
              <TableHead>Last sign-in</TableHead>
              <TableHead className='w-12' />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }, (_, index) => (
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
                  No accounts match these filters.
                </TableCell>
              </TableRow>
            )}

            {visible.map((account) => {
              const isSelf = account.id === viewer?.id
              return (
                <TableRow key={account.id}>
                  <TableCell>
                    <div className='min-w-0'>
                      <span className='block font-medium'>
                        {account.name || account.email}
                      </span>
                      <span className='block truncate text-xs text-muted-foreground'>
                        {account.email} · {account.accountNo}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className='text-sm'>
                    {account.organizationName}
                  </TableCell>
                  <TableCell className='text-sm'>
                    {account.designationTitle || (
                      <span className='text-muted-foreground'>—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <RoleBadge role={account.role} />
                  </TableCell>
                  <TableCell>
                    <AccountStatusBadge status={account.status} />
                  </TableCell>
                  <TableCell className='text-end tabular-nums'>
                    {account.modulePermissions.length}
                  </TableCell>
                  <TableCell className='text-sm text-muted-foreground'>
                    {account.lastLoginAt
                      ? new Date(account.lastLoginAt).toLocaleDateString()
                      : 'Never'}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant='ghost'
                          size='icon'
                          aria-label={`Actions for ${account.email}`}
                        >
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align='end' className='w-56'>
                        <DropdownMenuItem
                          onClick={() => setEditing(account)}
                          disabled={account.isSystemOwner}
                        >
                          <Pencil />
                          Edit account
                        </DropdownMenuItem>

                        {account.status !== 'active' && (
                          <DropdownMenuItem
                            disabled={account.isSystemOwner || isSelf}
                            onClick={() =>
                              void runAction(
                                account,
                                { action: 'activate' },
                                `${account.email} is now active.`
                              )
                            }
                          >
                            <ShieldCheck />
                            {account.status === 'pending'
                              ? 'Approve and activate'
                              : 'Activate'}
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuItem
                          disabled={account.isSystemOwner || isSelf}
                          onClick={() =>
                            setPending({ kind: 'reset-password', account })
                          }
                        >
                          <KeyRound />
                          Reset password
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          disabled={account.isSystemOwner || isSelf}
                          onClick={() =>
                            void runAction(
                              account,
                              { action: 'resend-invite' },
                              `Invitation re-sent to ${account.email}.`
                            )
                          }
                        >
                          <MailPlus />
                          Resend invitation
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          disabled={account.isSystemOwner || isSelf}
                          onClick={() =>
                            setPending({ kind: 'force-signout', account })
                          }
                        >
                          <LogOut />
                          Sign out everywhere
                        </DropdownMenuItem>

                        {canTransfer && (
                          <DropdownMenuItem
                            disabled={account.isSystemOwner || isSelf}
                            onClick={() => {
                              setTransferTarget(account)
                              setTransferOrganizationId('')
                            }}
                          >
                            <ArrowLeftRight />
                            Move to another organization
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuSeparator />

                        {account.status !== 'suspended' && (
                          <DropdownMenuItem
                            disabled={account.isSystemOwner || isSelf}
                            onClick={() =>
                              setPending({ kind: 'suspend', account })
                            }
                          >
                            <ShieldX />
                            Suspend
                          </DropdownMenuItem>
                        )}
                        {account.status !== 'inactive' && (
                          <DropdownMenuItem
                            disabled={account.isSystemOwner || isSelf}
                            onClick={() =>
                              setPending({ kind: 'deactivate', account })
                            }
                          >
                            <UserMinus />
                            Deactivate
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          variant='destructive'
                          disabled={account.isSystemOwner || isSelf}
                          onClick={() => setPending({ kind: 'delete', account })}
                        >
                          <Trash2 />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <AccountEditSheet
        account={editing}
        organization={organization}
        directory={directory}
        isSelf={editing?.id === viewer?.id}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        onSaved={() => {
          setEditing(null)
          onChanged()
        }}
      />

      <ConfirmDialog
        open={Boolean(pending)}
        onOpenChange={(open) => {
          if (!open) setPending(null)
        }}
        destructive={pending?.kind === 'delete' || pending?.kind === 'suspend'}
        isLoading={isWorking}
        title={pending ? CONFIRM_COPY[pending.kind].title : ''}
        desc={
          <span>
            {pending ? CONFIRM_COPY[pending.kind].description : ''}
            {pending ? ` (${pending.account.email})` : ''}
          </span>
        }
        confirmText={pending ? CONFIRM_COPY[pending.kind].confirm : 'Continue'}
        handleConfirm={() => void confirmPending()}
      />

      <ConfirmDialog
        open={Boolean(transferTarget)}
        onOpenChange={(open) => {
          if (!open) setTransferTarget(null)
        }}
        isLoading={isWorking}
        disabled={!transferOrganizationId}
        title='Move this account to another organization'
        desc={
          <span>
            The account keeps its identity but loses its designation,
            department, and reporting line, because those belong to the
            organization it is leaving. Its access is recalculated against the
            destination&apos;s entitlements.
          </span>
        }
        confirmText='Move account'
        handleConfirm={() => {
          if (!transferTarget || !transferOrganizationId) return
          void runAction(
            transferTarget,
            { action: 'transfer', organizationId: transferOrganizationId },
            `${transferTarget.email} was moved.`
          )
        }}
      >
        <div className='space-y-2'>
          <Label htmlFor='transfer-organization'>Destination</Label>
          <Select
            value={transferOrganizationId}
            onValueChange={setTransferOrganizationId}
          >
            <SelectTrigger id='transfer-organization' className='w-full'>
              <SelectValue placeholder='Choose an organization' />
            </SelectTrigger>
            <SelectContent>
              {organizations
                .filter(
                  (entry) =>
                    entry.status === 'active' &&
                    entry.id !== transferTarget?.organizationId
                )
                .map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {entry.name} ({entry.code})
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </ConfirmDialog>
    </div>
  )
}
