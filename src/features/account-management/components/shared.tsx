import { useState } from 'react'
import { Check, Copy, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import {
  ORGANIZATION_STATUS_LABELS,
  type OrganizationStatus,
} from '@/lib/organizations'
import {
  MODULE_DEFINITIONS,
  MODULE_KEYS,
  PLATFORM_ONLY_MODULES,
  type ModuleKey,
} from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { MODULE_ICONS } from '@/components/app-icons'
import {
  type AccountRole,
  type AccountStatus,
} from '../data/types'

const STATUS_VARIANTS: Record<
  AccountStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  active: 'default',
  invited: 'secondary',
  pending: 'outline',
  suspended: 'destructive',
  inactive: 'secondary',
}

const STATUS_LABELS: Record<AccountStatus, string> = {
  active: 'Active',
  invited: 'Invited',
  pending: 'Pending approval',
  suspended: 'Suspended',
  inactive: 'Inactive',
}

export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  return (
    <Badge variant={STATUS_VARIANTS[status] ?? 'secondary'}>
      {STATUS_LABELS[status] ?? status}
    </Badge>
  )
}

const ROLE_LABELS: Record<AccountRole, string> = {
  superadmin: 'Super Admin',
  org_admin: 'Org Admin',
  user: 'Member',
}

export function RoleBadge({ role }: { role: AccountRole }) {
  return (
    <Badge
      variant={role === 'user' ? 'outline' : 'default'}
      className={cn(role === 'superadmin' && 'bg-primary')}
    >
      {ROLE_LABELS[role] ?? role}
    </Badge>
  )
}

export function OrganizationStatusBadge({
  status,
}: {
  status: OrganizationStatus
}) {
  return (
    <Badge
      variant={
        status === 'active'
          ? 'default'
          : status === 'suspended'
            ? 'destructive'
            : 'secondary'
      }
    >
      {ORGANIZATION_STATUS_LABELS[status] ?? status}
    </Badge>
  )
}

/**
 * Grouped module picker used by every screen that grants access.
 *
 * `available` is the ceiling: modules outside it render disabled with an
 * explanation instead of disappearing, so an administrator can see *why* they
 * cannot grant something rather than wondering where it went.
 */
export function ModuleAccessPicker({
  value,
  onChange,
  available,
  disabled = false,
  idPrefix,
  emptyHint,
}: {
  value: ModuleKey[]
  onChange: (next: ModuleKey[]) => void
  /** Omit to allow every module except the platform-only ones. */
  available?: readonly ModuleKey[]
  disabled?: boolean
  idPrefix: string
  emptyHint?: string
}) {
  const ceiling = new Set<ModuleKey>(
    available ??
      MODULE_KEYS.filter((key) => !PLATFORM_ONLY_MODULES.includes(key))
  )
  const selected = new Set(value)
  const groups = [...new Set(MODULE_DEFINITIONS.map((item) => item.group))]

  function toggle(module: ModuleKey, checked: boolean) {
    const next = new Set(selected)
    if (checked) next.add(module)
    else next.delete(module)
    onChange(MODULE_KEYS.filter((key) => next.has(key)))
  }

  return (
    <div className='space-y-5'>
      <div className='flex flex-wrap items-center gap-2'>
        <Button
          type='button'
          size='sm'
          variant='outline'
          disabled={disabled}
          onClick={() =>
            onChange(MODULE_KEYS.filter((key) => ceiling.has(key)))
          }
        >
          Select all available
        </Button>
        <Button
          type='button'
          size='sm'
          variant='outline'
          disabled={disabled}
          onClick={() => onChange([])}
        >
          Clear all
        </Button>
        <span className='text-xs text-muted-foreground sm:ms-auto'>
          {value.length} of {ceiling.size} available modules selected
        </span>
      </div>

      {emptyHint && value.length === 0 && (
        <p className='rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground'>
          {emptyHint}
        </p>
      )}

      {groups.map((group) => {
        const items = MODULE_DEFINITIONS.filter(
          (module) => module.group === group
        )
        return (
          <section key={group} className='space-y-2'>
            <h4 className='text-sm font-medium'>{group}</h4>
            <div className='grid gap-2 @2xl:grid-cols-2'>
              {items.map((module) => {
                const allowed = ceiling.has(module.key)
                const checked = selected.has(module.key)
                const ModuleIcon = MODULE_ICONS[module.key]
                return (
                  <Label
                    key={module.key}
                    htmlFor={`${idPrefix}-${module.key}`}
                    className={cn(
                      'flex min-w-0 items-start gap-3 rounded-md border p-3 transition-colors',
                      checked && 'border-primary/50 bg-primary/5',
                      allowed
                        ? 'cursor-pointer'
                        : 'cursor-not-allowed opacity-60'
                    )}
                  >
                    <Checkbox
                      id={`${idPrefix}-${module.key}`}
                      checked={checked}
                      disabled={disabled || !allowed}
                      onCheckedChange={(next) =>
                        toggle(module.key, next === true)
                      }
                    />
                    <span className='flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary'>
                      <ModuleIcon className='size-4' aria-hidden='true' />
                    </span>
                    <span className='min-w-0 flex-1'>
                      <span className='flex items-center gap-1.5 text-sm font-medium'>
                        {module.title}
                        {checked && <Check className='size-3.5 text-primary' />}
                      </span>
                      <span className='mt-0.5 block text-xs leading-relaxed text-muted-foreground'>
                        {allowed
                          ? module.description
                          : 'Not available to this organization.'}
                      </span>
                    </span>
                  </Label>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

/**
 * Shown after provisioning when the invite email could not be delivered. The
 * password is never retrievable again, so it is presented once, clearly, with
 * an easy way to copy it.
 */
export function TemporaryPasswordNotice({
  email,
  password,
  onDismiss,
}: {
  email: string
  password: string
  onDismiss?: () => void
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
      toast.success('Temporary password copied.')
      window.setTimeout(() => setCopied(false), 2_000)
    } catch {
      toast.error('Could not copy. Select the password and copy it manually.')
    }
  }

  return (
    <div
      role='alert'
      className='space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4'
    >
      <div className='flex items-start gap-3'>
        <ShieldAlert className='mt-0.5 size-5 shrink-0 text-amber-600' />
        <div className='min-w-0'>
          <p className='text-sm font-medium'>
            The invitation email could not be sent
          </p>
          <p className='mt-1 text-sm text-muted-foreground'>
            Give this temporary password to {email} through a channel you trust.
            It is shown once and cannot be recovered afterwards — they will be
            asked to set their own password at first sign-in.
          </p>
        </div>
      </div>
      <div className='flex flex-wrap items-center gap-2'>
        <code className='min-w-0 flex-1 rounded-md border bg-background px-3 py-2 font-mono text-sm break-all'>
          {password}
        </code>
        <Button type='button' size='sm' variant='outline' onClick={() => void copy()}>
          {copied ? <Check /> : <Copy />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
        {onDismiss && (
          <Button type='button' size='sm' variant='ghost' onClick={onDismiss}>
            Dismiss
          </Button>
        )}
      </div>
    </div>
  )
}

export function StatTile({
  label,
  value,
  hint,
}: {
  label: string
  value: string | number
  hint?: string
}) {
  return (
    <div className='rounded-lg border p-4'>
      <p className='text-xs font-medium tracking-wide text-muted-foreground uppercase'>
        {label}
      </p>
      <p className='mt-1 text-2xl font-semibold tabular-nums'>{value}</p>
      {hint && <p className='mt-1 text-xs text-muted-foreground'>{hint}</p>}
    </div>
  )
}
