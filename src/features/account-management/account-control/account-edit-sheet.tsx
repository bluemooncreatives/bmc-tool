import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { ApiError } from '@/lib/api-client'
import { EMPLOYMENT_TYPES, EMPLOYMENT_TYPE_LABELS } from '@/lib/organizations'
import { type ModuleKey } from '@/lib/permissions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { TimezoneSelect } from '@/components/timezone-select'
import { ModuleAccessPicker } from '../components/shared'
import { updateAccount } from '../data/api'
import {
  type DirectoryResponse,
  type ManagedAccount,
  type Organization,
} from '../data/types'

const NONE = 'none'

type FormState = {
  name: string
  jobTitle: string
  phone: string
  employeeId: string
  location: string
  timezone: string
  joinedAt: string
  employmentType: string
  designationId: string
  departmentId: string
  managerId: string
  role: string
  status: string
  statusReason: string
  adminNotes: string
  mfaEnabled: boolean
}

function formFrom(account: ManagedAccount): FormState {
  return {
    name: account.name,
    jobTitle: account.jobTitle,
    phone: account.phone,
    employeeId: account.employeeId,
    location: account.location,
    timezone: account.timezone,
    joinedAt: account.joinedAt?.slice(0, 10) ?? '',
    employmentType: account.employmentType || NONE,
    designationId: account.designationId ?? NONE,
    departmentId: account.departmentId ?? NONE,
    managerId: account.managerId ?? NONE,
    role: account.role,
    status: account.status,
    statusReason: account.suspendedReason,
    adminNotes: account.adminNotes,
    mfaEnabled: account.mfaEnabled,
  }
}

/**
 * Full account editor. Grants are sent as the raw request; the server resolves
 * them against the organization's entitlements and the designation template,
 * and answers with the account as it actually ended up.
 */
export function AccountEditSheet({
  account,
  organization,
  directory,
  isSelf,
  onOpenChange,
  onSaved,
}: {
  account: ManagedAccount | null
  organization: Organization | null
  directory: DirectoryResponse | null
  isSelf: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (account: ManagedAccount) => void
}) {
  const [form, setForm] = useState<FormState | null>(null)
  const [granted, setGranted] = useState<ModuleKey[]>([])
  const [denied, setDenied] = useState<ModuleKey[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!account) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(formFrom(account))
    setGranted(account.grantedModules)
    setDenied(account.deniedModules)
    setError(null)
  }, [account])

  function set<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((current) => (current ? { ...current, [key]: value } : current))
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!account || !form) return
    setIsSaving(true)
    setError(null)
    try {
      const response = await updateAccount(account.id, {
        name: form.name.trim(),
        jobTitle: form.jobTitle.trim(),
        phone: form.phone.trim(),
        employeeId: form.employeeId.trim(),
        location: form.location.trim(),
        timezone: form.timezone.trim(),
        joinedAt: form.joinedAt,
        employmentType: form.employmentType === NONE ? '' : form.employmentType,
        designationId: form.designationId === NONE ? null : form.designationId,
        departmentId: form.departmentId === NONE ? null : form.departmentId,
        managerId: form.managerId === NONE ? null : form.managerId,
        ...(isSelf ? {} : { role: form.role, status: form.status }),
        ...(form.status === 'suspended' && form.statusReason
          ? { statusReason: form.statusReason.trim() }
          : {}),
        adminNotes: form.adminNotes.trim(),
        mfaEnabled: form.mfaEnabled,
        grantedModules: granted,
        deniedModules: denied,
        expectedUpdatedAt: account.updatedAt,
      })
      toast.success(`${response.account.email} updated.`)
      onSaved(response.account)
      onOpenChange(false)
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Could not update the account.'
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Sheet open={Boolean(account)} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col gap-0 p-0 sm:max-w-2xl'>
        <SheetHeader className='border-b'>
          <SheetTitle>{account?.name || account?.email}</SheetTitle>
          <SheetDescription>
            {account
              ? `${account.email} · ${account.organizationName} · account ${account.accountNo}`
              : ''}
          </SheetDescription>
        </SheetHeader>

        {form && account && (
          <form onSubmit={submit} className='flex min-h-0 flex-1 flex-col'>
            <Tabs
              defaultValue='profile'
              className='flex min-h-0 flex-1 flex-col gap-0'
            >
              <div className='border-b px-4 py-3'>
                <TabsList>
                  <TabsTrigger value='profile'>Profile</TabsTrigger>
                  <TabsTrigger value='position'>Position</TabsTrigger>
                  <TabsTrigger value='access'>Access</TabsTrigger>
                </TabsList>
              </div>

              <div className='@container/account min-h-0 flex-1 overflow-y-auto p-4'>
                <TabsContent value='profile' className='mt-0 space-y-4'>
                  <div className='grid gap-4 @xl/account:grid-cols-2'>
                    <Field label='Full name' htmlFor='edit-name'>
                      <Input
                        id='edit-name'
                        value={form.name}
                        minLength={2}
                        maxLength={80}
                        onChange={(event) => set('name', event.target.value)}
                      />
                    </Field>
                    <Field label='Job title' htmlFor='edit-title'>
                      <Input
                        id='edit-title'
                        value={form.jobTitle}
                        maxLength={80}
                        onChange={(event) =>
                          set('jobTitle', event.target.value)
                        }
                      />
                    </Field>
                    <Field label='Phone' htmlFor='edit-phone'>
                      <Input
                        id='edit-phone'
                        value={form.phone}
                        maxLength={32}
                        onChange={(event) => set('phone', event.target.value)}
                      />
                    </Field>
                    <Field label='Employee ID' htmlFor='edit-employee'>
                      <Input
                        id='edit-employee'
                        value={form.employeeId}
                        maxLength={40}
                        onChange={(event) =>
                          set('employeeId', event.target.value)
                        }
                      />
                    </Field>
                    <Field label='Location' htmlFor='edit-location'>
                      <Input
                        id='edit-location'
                        value={form.location}
                        maxLength={120}
                        onChange={(event) =>
                          set('location', event.target.value)
                        }
                      />
                    </Field>
                    <Field label='Timezone' htmlFor='edit-timezone'>
                      <TimezoneSelect
                        id='edit-timezone'
                        value={form.timezone}
                        onValueChange={(value) => set('timezone', value)}
                        disabled={isSaving}
                      />
                    </Field>
                  </div>

                  <Field label='Administrative notes' htmlFor='edit-notes'>
                    <Textarea
                      id='edit-notes'
                      rows={3}
                      maxLength={1000}
                      value={form.adminNotes}
                      onChange={(event) =>
                        set('adminNotes', event.target.value)
                      }
                    />
                  </Field>

                  <dl className='grid gap-3 rounded-lg border p-4 text-sm @xl/account:grid-cols-2'>
                    <Detail label='Username' value={account.username} />
                    <Detail
                      label='Last sign-in'
                      value={
                        account.lastLoginAt
                          ? new Date(account.lastLoginAt).toLocaleString()
                          : 'Never'
                      }
                    />
                    <Detail
                      label='Created'
                      value={new Date(account.createdAt).toLocaleDateString()}
                    />
                    <Detail
                      label='Password'
                      value={
                        account.mustChangePassword
                          ? 'Temporary — must be changed at next sign-in'
                          : 'Set by the account holder'
                      }
                    />
                  </dl>
                </TabsContent>

                <TabsContent value='position' className='mt-0 space-y-4'>
                  <div className='grid gap-4 @xl/account:grid-cols-2'>
                    <Field label='Designation' htmlFor='edit-designation'>
                      <Select
                        value={form.designationId}
                        onValueChange={(value) => set('designationId', value)}
                      >
                        <SelectTrigger id='edit-designation' className='w-full'>
                          <SelectValue placeholder='No designation' />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>No designation</SelectItem>
                          {directory?.designations.map((entry) => (
                            <SelectItem key={entry.id} value={entry.id}>
                              {entry.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label='Department' htmlFor='edit-department'>
                      <Select
                        value={form.departmentId}
                        onValueChange={(value) => set('departmentId', value)}
                      >
                        <SelectTrigger id='edit-department' className='w-full'>
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
                      htmlFor='edit-manager'
                      hint='A reporting line that loops back on itself is rejected.'
                    >
                      <Select
                        value={form.managerId}
                        onValueChange={(value) => set('managerId', value)}
                      >
                        <SelectTrigger id='edit-manager' className='w-full'>
                          <SelectValue placeholder='No manager' />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>No manager</SelectItem>
                          {directory?.managers
                            .filter((entry) => entry.id !== account.id)
                            .map((entry) => (
                              <SelectItem key={entry.id} value={entry.id}>
                                {entry.name} — {entry.email}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label='Employment type' htmlFor='edit-employment'>
                      <Select
                        value={form.employmentType}
                        onValueChange={(value) => set('employmentType', value)}
                      >
                        <SelectTrigger id='edit-employment' className='w-full'>
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
                    <Field label='Joining date' htmlFor='edit-joined'>
                      <Input
                        id='edit-joined'
                        type='date'
                        value={form.joinedAt}
                        onChange={(event) =>
                          set('joinedAt', event.target.value)
                        }
                      />
                    </Field>
                  </div>
                </TabsContent>

                <TabsContent value='access' className='mt-0 space-y-5'>
                  {isSelf && (
                    <p className='rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground'>
                      This is your own account, so its role and status are
                      locked here. Another administrator has to change them.
                    </p>
                  )}
                  <div className='grid gap-4 @xl/account:grid-cols-2'>
                    <Field label='Role' htmlFor='edit-role'>
                      <Select
                        value={form.role}
                        onValueChange={(value) => set('role', value)}
                        disabled={isSelf || account.isSystemOwner}
                      >
                        <SelectTrigger id='edit-role' className='w-full'>
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
                    <Field label='Status' htmlFor='edit-status'>
                      <Select
                        value={form.status}
                        onValueChange={(value) => set('status', value)}
                        disabled={isSelf || account.isSystemOwner}
                      >
                        <SelectTrigger id='edit-status' className='w-full'>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='active'>Active</SelectItem>
                          <SelectItem value='invited'>Invited</SelectItem>
                          <SelectItem value='pending'>
                            Pending approval
                          </SelectItem>
                          <SelectItem value='suspended'>Suspended</SelectItem>
                          <SelectItem value='inactive'>Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>

                  {form.status === 'suspended' && (
                    <Field label='Suspension reason' htmlFor='edit-reason'>
                      <Input
                        id='edit-reason'
                        value={form.statusReason}
                        maxLength={300}
                        onChange={(event) =>
                          set('statusReason', event.target.value)
                        }
                        placeholder='Recorded in the audit trail.'
                      />
                    </Field>
                  )}

                  <div className='flex items-start justify-between gap-4 rounded-lg border p-4'>
                    <div className='min-w-0'>
                      <Label htmlFor='edit-mfa' className='text-sm font-medium'>
                        Require email MFA
                      </Label>
                      <p className='mt-1 text-xs text-muted-foreground'>
                        Stays on when the organization enforces MFA for
                        everyone.
                      </p>
                    </div>
                    <Switch
                      id='edit-mfa'
                      checked={form.mfaEnabled}
                      onCheckedChange={(value) => set('mfaEnabled', value)}
                    />
                  </div>

                  <section className='space-y-3 border-t pt-4'>
                    <h3 className='text-sm font-medium'>Granted modules</h3>
                    <p className='text-xs text-muted-foreground'>
                      Direct grants. The designation template is added on top of
                      these automatically.
                    </p>
                    <ModuleAccessPicker
                      idPrefix='edit-granted'
                      value={granted}
                      onChange={setGranted}
                      available={organization?.enabledModules}
                      disabled={isSaving}
                    />
                  </section>

                  <section className='space-y-3 border-t pt-4'>
                    <h3 className='text-sm font-medium'>Explicit denials</h3>
                    <p className='text-xs text-muted-foreground'>
                      Denials win over both direct grants and anything inherited
                      from the designation. Use them to carve an exception out
                      of a template without editing the template itself.
                    </p>
                    <ModuleAccessPicker
                      idPrefix='edit-denied'
                      value={denied}
                      onChange={setDenied}
                      available={organization?.enabledModules}
                      disabled={isSaving}
                    />
                  </section>

                  <div className='rounded-lg border bg-muted/30 p-4'>
                    <p className='text-sm font-medium'>
                      Effective access right now
                    </p>
                    <p className='mt-1 text-xs text-muted-foreground'>
                      {account.modulePermissions.length > 0
                        ? account.modulePermissions.join(', ')
                        : 'No modules. This account can sign in but sees nothing.'}
                    </p>
                  </div>
                </TabsContent>
              </div>
            </Tabs>

            {error && (
              <p
                role='alert'
                className='mx-4 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive'
              >
                {error}
              </p>
            )}

            <SheetFooter className='flex-row justify-end gap-2 border-t'>
              <SheetClose asChild>
                <Button type='button' variant='outline' disabled={isSaving}>
                  Cancel
                </Button>
              </SheetClose>
              <Button type='submit' disabled={isSaving}>
                {isSaving && <Loader2 className='animate-spin' />}
                Save changes
              </Button>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className='space-y-2'>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className='text-xs text-muted-foreground'>{hint}</p>}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className='min-w-0'>
      <dt className='text-xs text-muted-foreground'>{label}</dt>
      <dd className='truncate font-medium'>{value}</dd>
    </div>
  )
}
