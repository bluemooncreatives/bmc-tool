import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Loader2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { ApiError } from '@/lib/api-client'
import { EMPLOYMENT_TYPES, EMPLOYMENT_TYPE_LABELS } from '@/lib/organizations'
import { isSuperadmin, type ModuleKey } from '@/lib/permissions'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { HeaderActions } from '@/components/header-actions'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { TimezoneSelect } from '@/components/timezone-select'
import {
  ModuleAccessPicker,
  TemporaryPasswordNotice,
} from '../components/shared'
import { createAccount, loadDirectory } from '../data/api'
import { type DirectoryResponse, type ManagedAccount } from '../data/types'
import { useOrganizationScope } from '../data/use-organization-scope'

const NONE = 'none'

type FormState = {
  name: string
  email: string
  username: string
  phone: string
  jobTitle: string
  employeeId: string
  designationId: string
  departmentId: string
  managerId: string
  employmentType: string
  joinedAt: string
  location: string
  timezone: string
  role: 'user' | 'org_admin'
  status: 'invited' | 'active' | 'pending'
  adminNotes: string
  mfaEnabled: boolean
  sendInvite: boolean
}

function emptyForm(): FormState {
  return {
    name: '',
    email: '',
    username: '',
    phone: '',
    jobTitle: '',
    employeeId: '',
    designationId: NONE,
    departmentId: NONE,
    managerId: NONE,
    employmentType: NONE,
    joinedAt: '',
    location: '',
    timezone: '',
    role: 'user',
    status: 'invited',
    adminNotes: '',
    mfaEnabled: false,
    sendInvite: true,
  }
}

/**
 * Provisioning screen for a single account.
 *
 * The module list is seeded from the chosen designation and then remains the
 * administrator's to adjust — the designation is a starting point, not a cage,
 * and the server re-derives the effective set from both anyway.
 */
export function CreateUser() {
  const viewer = useAuthStore((state) => state.auth.user)
  const canChooseOrganization = viewer ? isSuperadmin(viewer) : false
  const scope = useOrganizationScope()

  const [directory, setDirectory] = useState<DirectoryResponse | null>(null)
  const [isDirectoryLoading, setIsDirectoryLoading] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [modules, setModules] = useState<ModuleKey[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{
    account: ManagedAccount
    temporaryPassword?: string
  } | null>(null)

  const organizationId = scope.selectedId

  const refreshDirectory = useCallback(async () => {
    if (!organizationId) return
    setIsDirectoryLoading(true)
    try {
      const response = await loadDirectory(organizationId)
      setDirectory(response)
      setModules(response.organization.defaultMemberModules)
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Could not load the organization directory.'
      )
    } finally {
      setIsDirectoryLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    // Directory follows the selected organization; refreshDirectory owns state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshDirectory()
  }, [refreshDirectory])

  function set<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const designation = useMemo(
    () =>
      directory?.designations.find(
        (entry) => entry.id === form.designationId
      ) ?? null,
    [directory, form.designationId]
  )

  function chooseDesignation(value: string) {
    set('designationId', value)
    const chosen = directory?.designations.find((entry) => entry.id === value)
    // Adopting the template is the expected default; anything already ticked
    // that the template does not include would otherwise be silently kept.
    setModules(
      chosen
        ? chosen.defaultModules
        : (directory?.organization.defaultMemberModules ?? [])
    )
    if (chosen?.departmentId) set('departmentId', chosen.departmentId)
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!organizationId) return
    setIsSaving(true)
    setError(null)
    setCreated(null)

    try {
      const response = await createAccount({
        organizationId,
        name: form.name.trim(),
        email: form.email.trim(),
        ...(form.username.trim() ? { username: form.username.trim() } : {}),
        role: form.role,
        status: form.status,
        designationId: form.designationId === NONE ? null : form.designationId,
        departmentId: form.departmentId === NONE ? null : form.departmentId,
        managerId: form.managerId === NONE ? null : form.managerId,
        employeeId: form.employeeId.trim(),
        ...(form.employmentType === NONE
          ? {}
          : { employmentType: form.employmentType }),
        jobTitle: form.jobTitle.trim(),
        phone: form.phone.trim(),
        location: form.location.trim(),
        timezone: form.timezone.trim(),
        joinedAt: form.joinedAt,
        grantedModules: modules,
        adminNotes: form.adminNotes.trim(),
        mfaEnabled: form.mfaEnabled,
        sendInvite: form.sendInvite,
      })

      setCreated({
        account: response.account,
        temporaryPassword: response.temporaryPassword,
      })
      toast.success(`${response.account.email} was created.`)
      setForm(emptyForm())
      setModules(directory?.organization.defaultMemberModules ?? [])
      await refreshDirectory()
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Could not create the account.'
      )
    } finally {
      setIsSaving(false)
    }
  }

  const organization = directory?.organization ?? scope.selected

  return (
    <>
      <Header fixed>
        <Search />
        <HeaderActions />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-1 flex-col gap-5'>
        <div className='min-w-0'>
          <div className='flex items-center gap-2'>
            <UserPlus className='size-7 text-primary' />
            <h2 className='text-2xl font-bold tracking-tight'>Create User</h2>
          </div>
          <p className='mt-1 text-muted-foreground'>
            Provision an account end to end: identity, position in the
            organization, and exactly which modules it can reach.
          </p>
        </div>

        {created && (
          <div className='space-y-3'>
            <div className='flex flex-wrap items-center gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4'>
              <CheckCircle2 className='size-5 text-emerald-600' />
              <p className='min-w-0 flex-1 text-sm'>
                <span className='font-medium'>{created.account.email}</span> was
                created in {created.account.organizationName} as{' '}
                {created.account.role === 'org_admin'
                  ? 'an organization administrator'
                  : 'a member'}
                {created.temporaryPassword
                  ? '.'
                  : ' and the invitation email is on its way.'}
              </p>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => setCreated(null)}
              >
                Dismiss
              </Button>
            </div>
            {created.temporaryPassword && (
              <TemporaryPasswordNotice
                email={created.account.email}
                password={created.temporaryPassword}
              />
            )}
          </div>
        )}

        {scope.error && (
          <p
            role='alert'
            className='rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive'
          >
            {scope.error}
          </p>
        )}

        {scope.isLoading ? (
          <Skeleton className='h-96 w-full' />
        ) : !organizationId ? (
          <Card>
            <CardContent className='py-10 text-center text-sm text-muted-foreground'>
              There is no organization you can create accounts in yet.
            </CardContent>
          </Card>
        ) : (
          <form onSubmit={submit} className='@container/form space-y-5'>
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Organization</CardTitle>
                <CardDescription>
                  The account belongs to this organization permanently, unless
                  the Super Admin moves it later.
                </CardDescription>
              </CardHeader>
              <CardContent className='grid gap-4 @xl/form:grid-cols-2'>
                <div className='space-y-2'>
                  <Label htmlFor='account-organization'>Organization</Label>
                  {canChooseOrganization ? (
                    <Select
                      value={scope.selectedId}
                      onValueChange={scope.setSelectedId}
                      disabled={isSaving}
                    >
                      <SelectTrigger
                        id='account-organization'
                        className='w-full'
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
                    <Input
                      id='account-organization'
                      value={
                        organization
                          ? `${organization.name} (${organization.code})`
                          : ''
                      }
                      readOnly
                      disabled
                    />
                  )}
                </div>
                <div className='space-y-2'>
                  <Label>Seats remaining</Label>
                  <p className='rounded-md border bg-muted/30 px-3 py-2 text-sm'>
                    {organization?.stats?.seatsRemaining === null ||
                    organization?.stats?.seatsRemaining === undefined
                      ? 'Unlimited'
                      : `${organization.stats.seatsRemaining} of ${organization.settings.seatLimit}`}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Identity</CardTitle>
                <CardDescription>
                  The email address is the sign-in identity and can belong to
                  only one organization.
                </CardDescription>
              </CardHeader>
              <CardContent className='grid gap-4 @xl/form:grid-cols-2'>
                <Field label='Full name' htmlFor='account-name' required>
                  <Input
                    id='account-name'
                    required
                    minLength={2}
                    maxLength={80}
                    value={form.name}
                    onChange={(event) => set('name', event.target.value)}
                    placeholder='Rahul Verma'
                  />
                </Field>
                <Field label='Email' htmlFor='account-email' required>
                  <Input
                    id='account-email'
                    type='email'
                    required
                    value={form.email}
                    onChange={(event) => set('email', event.target.value)}
                    placeholder='rahul@acme.com'
                  />
                </Field>
                <Field
                  label='Username'
                  htmlFor='account-username'
                  hint='Left empty, one is generated from the email address.'
                >
                  <Input
                    id='account-username'
                    value={form.username}
                    maxLength={30}
                    pattern='[A-Za-z0-9][A-Za-z0-9._-]*'
                    onChange={(event) => set('username', event.target.value)}
                  />
                </Field>
                <Field label='Phone' htmlFor='account-phone'>
                  <Input
                    id='account-phone'
                    value={form.phone}
                    maxLength={32}
                    onChange={(event) => set('phone', event.target.value)}
                  />
                </Field>
                <Field label='Employee ID' htmlFor='account-employee-id'>
                  <Input
                    id='account-employee-id'
                    value={form.employeeId}
                    maxLength={40}
                    onChange={(event) => set('employeeId', event.target.value)}
                    placeholder='BMC-0142'
                  />
                </Field>
                <Field label='Job title' htmlFor='account-job-title'>
                  <Input
                    id='account-job-title'
                    value={form.jobTitle}
                    maxLength={80}
                    onChange={(event) => set('jobTitle', event.target.value)}
                    placeholder='Frontend Developer'
                  />
                </Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='text-base'>
                  Position in the organization
                </CardTitle>
                <CardDescription>
                  The designation seeds module access, and the manager decides
                  where this account sits in the org chart.
                </CardDescription>
              </CardHeader>
              <CardContent className='grid gap-4 @xl/form:grid-cols-2'>
                <Field label='Designation' htmlFor='account-designation'>
                  <Select
                    value={form.designationId}
                    onValueChange={chooseDesignation}
                    disabled={isDirectoryLoading || isSaving}
                  >
                    <SelectTrigger id='account-designation' className='w-full'>
                      <SelectValue placeholder='No designation' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>No designation</SelectItem>
                      {directory?.designations.map((entry) => (
                        <SelectItem key={entry.id} value={entry.id}>
                          {entry.title} (level {entry.level})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label='Department' htmlFor='account-department'>
                  <Select
                    value={form.departmentId}
                    onValueChange={(value) => set('departmentId', value)}
                    disabled={isDirectoryLoading || isSaving}
                  >
                    <SelectTrigger id='account-department' className='w-full'>
                      <SelectValue placeholder='No department' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>No department</SelectItem>
                      {directory?.departments.map((entry) => (
                        <SelectItem key={entry.id} value={entry.id}>
                          {entry.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field
                  label='Reports to'
                  htmlFor='account-manager'
                  hint='Only accounts inside this organization can be a manager.'
                >
                  <Select
                    value={form.managerId}
                    onValueChange={(value) => set('managerId', value)}
                    disabled={isDirectoryLoading || isSaving}
                  >
                    <SelectTrigger id='account-manager' className='w-full'>
                      <SelectValue placeholder='No manager' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>No manager</SelectItem>
                      {directory?.managers.map((entry) => (
                        <SelectItem key={entry.id} value={entry.id}>
                          {entry.name} — {entry.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label='Employment type' htmlFor='account-employment'>
                  <Select
                    value={form.employmentType}
                    onValueChange={(value) => set('employmentType', value)}
                  >
                    <SelectTrigger id='account-employment' className='w-full'>
                      <SelectValue placeholder='Not specified' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Not specified</SelectItem>
                      {EMPLOYMENT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {EMPLOYMENT_TYPE_LABELS[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label='Joining date' htmlFor='account-joined'>
                  <Input
                    id='account-joined'
                    type='date'
                    value={form.joinedAt}
                    onChange={(event) => set('joinedAt', event.target.value)}
                  />
                </Field>
                <Field label='Location' htmlFor='account-location'>
                  <Input
                    id='account-location'
                    value={form.location}
                    maxLength={120}
                    onChange={(event) => set('location', event.target.value)}
                    placeholder='Kolkata, IN'
                  />
                </Field>
                <Field label='Timezone' htmlFor='account-timezone'>
                  <TimezoneSelect
                    id='account-timezone'
                    value={form.timezone}
                    onValueChange={(value) => set('timezone', value)}
                    disabled={isSaving}
                  />
                </Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Role and access</CardTitle>
                <CardDescription>
                  {designation
                    ? `Seeded from the ${designation.title} designation. Anything you change here is recorded as a direct grant on top of it.`
                    : 'Nothing is granted by default beyond what you tick here.'}
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-5'>
                <div className='grid gap-4 @xl/form:grid-cols-2'>
                  <Field label='Role' htmlFor='account-role'>
                    <Select
                      value={form.role}
                      onValueChange={(value) =>
                        set('role', value as FormState['role'])
                      }
                    >
                      <SelectTrigger id='account-role' className='w-full'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='user'>Member</SelectItem>
                        <SelectItem value='org_admin'>
                          Organization Admin
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field
                    label='Initial status'
                    htmlFor='account-status'
                    hint='Invited accounts sign in with the temporary password and must then set their own.'
                  >
                    <Select
                      value={form.status}
                      onValueChange={(value) =>
                        set('status', value as FormState['status'])
                      }
                    >
                      <SelectTrigger id='account-status' className='w-full'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='invited'>Invited</SelectItem>
                        <SelectItem value='active'>Active</SelectItem>
                        <SelectItem value='pending'>
                          Pending approval
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <ModuleAccessPicker
                  idPrefix='account-modules'
                  value={modules}
                  onChange={setModules}
                  available={organization?.enabledModules}
                  disabled={isSaving}
                  emptyHint='This account will be able to sign in but will not see any module.'
                />

                <Field label='Administrative notes' htmlFor='account-notes'>
                  <Textarea
                    id='account-notes'
                    rows={3}
                    maxLength={1000}
                    value={form.adminNotes}
                    onChange={(event) => set('adminNotes', event.target.value)}
                    placeholder='Context for other administrators. Never shown to the account holder.'
                  />
                </Field>

                <div className='grid gap-3 @xl/form:grid-cols-2'>
                  <ToggleRow
                    id='account-mfa'
                    label='Require email MFA'
                    description='Forced on regardless when the organization enforces MFA.'
                    checked={form.mfaEnabled}
                    onCheckedChange={(value) => set('mfaEnabled', value)}
                  />
                  <ToggleRow
                    id='account-invite'
                    label='Send the invitation email'
                    description='If delivery fails, the password is shown to you once.'
                    checked={form.sendInvite}
                    onCheckedChange={(value) => set('sendInvite', value)}
                  />
                </div>
              </CardContent>
            </Card>

            {error && (
              <p
                role='alert'
                className='rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive'
              >
                {error}
              </p>
            )}

            <div className='sticky bottom-0 flex flex-col-reverse gap-2 border-t bg-background/95 py-4 backdrop-blur sm:flex-row sm:justify-end'>
              <Button
                type='button'
                variant='outline'
                disabled={isSaving}
                onClick={() => {
                  setForm(emptyForm())
                  setModules(directory?.organization.defaultMemberModules ?? [])
                }}
              >
                Reset form
              </Button>
              <Button type='submit' disabled={isSaving || isDirectoryLoading}>
                {isSaving && <Loader2 className='animate-spin' />}
                Create account
              </Button>
            </div>
          </form>
        )}
      </Main>
    </>
  )
}

function Field({
  label,
  htmlFor,
  hint,
  required,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className='space-y-2'>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className='text-destructive'> *</span>}
      </Label>
      {children}
      {hint && <p className='text-xs text-muted-foreground'>{hint}</p>}
    </div>
  )
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  id: string
  label: string
  description: string
  checked: boolean
  onCheckedChange: (value: boolean) => void
}) {
  return (
    <div className='flex items-start justify-between gap-4 rounded-lg border p-4'>
      <div className='min-w-0'>
        <Label htmlFor={id} className='text-sm font-medium'>
          {label}
        </Label>
        <p className='mt-1 text-xs leading-relaxed text-muted-foreground'>
          {description}
        </p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}
