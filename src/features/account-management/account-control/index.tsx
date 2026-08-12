import { useCallback, useEffect, useState } from 'react'
import { Network, RefreshCw } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { ApiError } from '@/lib/api-client'
import { isSuperadmin } from '@/lib/permissions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { HeaderActions } from '@/components/header-actions'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { StatTile } from '../components/shared'
import {
  listAccounts,
  loadAuditTrail,
  loadDirectory,
  loadOrgChart,
} from '../data/api'
import {
  type AuditEntry,
  type DirectoryResponse,
  type ManagedAccount,
  type OrgChart,
} from '../data/types'
import { useOrganizationScope } from '../data/use-organization-scope'
import { AccountsTab } from './accounts-tab'
import { DirectoryTab } from './directory-tab'
import { OrgChartTab } from './org-chart-tab'

const ALL_ORGANIZATIONS = 'all'

/**
 * The operational cockpit: every account in scope, the reporting tree behind
 * it, the designation and department structure that shapes access, and the
 * audit trail of what administrators have done.
 */
export function AccountControl() {
  const viewer = useAuthStore((state) => state.auth.user)
  const canSwitchOrganization = viewer ? isSuperadmin(viewer) : false
  const scope = useOrganizationScope({ includeArchived: true })

  const [accounts, setAccounts] = useState<ManagedAccount[]>([])
  const [directory, setDirectory] = useState<DirectoryResponse | null>(null)
  const [chart, setChart] = useState<OrgChart | null>(null)
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    role: 'all',
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // The Super Admin can widen the account list to every tenant; the directory
  // and org chart stay per-organization because they only mean anything there.
  const [accountScope, setAccountScope] = useState<string>('')

  const organizationId = scope.selectedId
  const accountOrganizationId = canSwitchOrganization
    ? accountScope || organizationId
    : organizationId

  const refresh = useCallback(async () => {
    if (!organizationId) return
    setIsLoading(true)
    setError(null)
    try {
      const [accountsResponse, directoryResponse, chartResponse, auditResponse] =
        await Promise.all([
          listAccounts({
            organizationId: accountOrganizationId,
            status: filters.status,
            role: filters.role,
          }),
          loadDirectory(organizationId),
          loadOrgChart(organizationId),
          loadAuditTrail({
            organizationId:
              accountOrganizationId === ALL_ORGANIZATIONS
                ? ALL_ORGANIZATIONS
                : organizationId,
            limit: 100,
          }),
        ])
      setAccounts(accountsResponse.accounts)
      setDirectory(directoryResponse)
      setChart(chartResponse.chart)
      setAudit(auditResponse.entries)
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Could not load account control data.'
      )
    } finally {
      setIsLoading(false)
    }
  }, [accountOrganizationId, filters.role, filters.status, organizationId])

  useEffect(() => {
    // Server synchronization; refresh owns every state update.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
  }, [refresh])

  const organization = directory?.organization ?? scope.selected

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
              <Network className='size-7 text-primary' />
              <h2 className='text-2xl font-bold tracking-tight'>
                Account Control
              </h2>
            </div>
            <p className='mt-1 text-muted-foreground'>
              Accounts, reporting lines, designations, and the record of every
              administrative change.
            </p>
          </div>
          <Button variant='outline' onClick={() => void refresh()}>
            <RefreshCw className={isLoading ? 'animate-spin' : undefined} />
            Refresh
          </Button>
        </div>

        {(error || scope.error) && (
          <div
            role='alert'
            className='flex flex-col items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between'
          >
            <span>{error ?? scope.error}</span>
            <Button variant='outline' size='sm' onClick={() => void refresh()}>
              Retry
            </Button>
          </div>
        )}

        {scope.isLoading ? (
          <Skeleton className='h-96 w-full' />
        ) : !organizationId ? (
          <Card>
            <CardContent className='py-10 text-center text-sm text-muted-foreground'>
              There is no organization you can administer yet.
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent className='flex flex-col gap-4 @3xl/content:flex-row @3xl/content:items-end'>
                <div className='min-w-0 flex-1 space-y-2'>
                  <Label htmlFor='control-organization'>Organization</Label>
                  {canSwitchOrganization ? (
                    <Select
                      value={scope.selectedId}
                      onValueChange={scope.setSelectedId}
                    >
                      <SelectTrigger
                        id='control-organization'
                        className='w-full @3xl/content:w-80'
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {scope.organizations.map((entry) => (
                          <SelectItem key={entry.id} value={entry.id}>
                            {entry.name} ({entry.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className='flex items-center gap-2 text-sm'>
                      <span className='font-medium'>{organization?.name}</span>
                      <Badge variant='outline'>{organization?.code}</Badge>
                    </p>
                  )}
                </div>

                {canSwitchOrganization && (
                  <div className='space-y-2'>
                    <Label htmlFor='control-account-scope'>
                      Account list scope
                    </Label>
                    <Select
                      value={accountScope || organizationId}
                      onValueChange={setAccountScope}
                    >
                      <SelectTrigger
                        id='control-account-scope'
                        className='w-full @3xl/content:w-64'
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={organizationId}>
                          Selected organization only
                        </SelectItem>
                        <SelectItem value={ALL_ORGANIZATIONS}>
                          Every organization
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className='grid gap-3 @2xl/content:grid-cols-4'>
              <StatTile label='Accounts in view' value={accounts.length} />
              <StatTile
                label='Active'
                value={
                  accounts.filter((account) => account.status === 'active')
                    .length
                }
              />
              <StatTile
                label='Awaiting approval'
                value={
                  accounts.filter((account) => account.status === 'pending')
                    .length
                }
              />
              <StatTile
                label='Designations'
                value={directory?.designations.length ?? 0}
              />
            </div>

            <Tabs defaultValue='accounts' className='min-w-0'>
              <TabsList>
                <TabsTrigger value='accounts'>Accounts</TabsTrigger>
                <TabsTrigger value='chart'>Org chart</TabsTrigger>
                <TabsTrigger value='directory'>
                  Designations &amp; departments
                </TabsTrigger>
                <TabsTrigger value='audit'>Audit trail</TabsTrigger>
              </TabsList>

              <TabsContent value='accounts' className='mt-4'>
                <AccountsTab
                  accounts={accounts}
                  organizations={scope.organizations}
                  organization={organization}
                  directory={directory}
                  isLoading={isLoading}
                  filters={filters}
                  onFiltersChange={setFilters}
                  onChanged={() => void refresh()}
                />
              </TabsContent>

              <TabsContent value='chart' className='mt-4'>
                <OrgChartTab chart={chart} isLoading={isLoading} />
              </TabsContent>

              <TabsContent value='directory' className='mt-4'>
                <DirectoryTab
                  directory={directory}
                  isLoading={isLoading}
                  onChanged={() => void refresh()}
                />
              </TabsContent>

              <TabsContent value='audit' className='mt-4'>
                <AuditTrail entries={audit} isLoading={isLoading} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </Main>
    </>
  )
}

function AuditTrail({
  entries,
  isLoading,
}: {
  entries: AuditEntry[]
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <div className='space-y-2'>
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className='h-14 w-full' />
        ))}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <p className='rounded-lg border py-12 text-center text-sm text-muted-foreground'>
        No administrative actions have been recorded yet.
      </p>
    )
  }

  return (
    <ol className='space-y-2'>
      {entries.map((entry) => (
        <li
          key={entry.id}
          className='flex flex-wrap items-start gap-3 rounded-md border p-3'
        >
          <Badge variant='outline' className='shrink-0 font-mono text-xs'>
            {entry.action}
          </Badge>
          <div className='min-w-0 flex-1'>
            <p className='text-sm'>{entry.summary}</p>
            <p className='mt-0.5 text-xs text-muted-foreground'>
              {entry.actorEmail} · {new Date(entry.createdAt).toLocaleString()}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}
