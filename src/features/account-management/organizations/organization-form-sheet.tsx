import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { ApiError } from '@/lib/api-client'
import {
  BILLING_PLANS,
  ORGANIZATION_SIZES,
  ORGANIZATION_STATUSES,
  ORGANIZATION_STATUS_LABELS,
  ORGANIZATION_TYPES,
  ORGANIZATION_TYPE_LABELS,
  suggestOrganizationCode,
} from '@/lib/organizations'
import {
  DEFAULT_MEMBER_MODULES,
  DEFAULT_ORGANIZATION_MODULES,
  type ModuleKey,
} from '@/lib/permissions'
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
import { createOrganization, updateOrganization } from '../data/api'
import { type Organization } from '../data/types'
import { ModuleAccessPicker } from '../components/shared'

type FormState = {
  name: string
  code: string
  type: string
  status: string
  description: string
  industry: string
  size: string
  website: string
  logoUrl: string
  contactEmail: string
  contactPhone: string
  line1: string
  line2: string
  city: string
  state: string
  postalCode: string
  country: string
  billingPlan: string
  currency: string
  renewalAt: string
  taxId: string
  billingNotes: string
  enabledModules: ModuleKey[]
  defaultMemberModules: ModuleKey[]
  allowSelfSignUp: boolean
  requireAdminApproval: boolean
  allowedEmailDomains: string
  enforceMfa: boolean
  seatLimit: string
  adminName: string
  adminEmail: string
  sendInvite: boolean
}

function emptyForm(): FormState {
  return {
    name: '',
    code: '',
    type: 'client',
    status: 'active',
    description: '',
    industry: '',
    size: '',
    website: '',
    logoUrl: '',
    contactEmail: '',
    contactPhone: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    billingPlan: 'trial',
    currency: '',
    renewalAt: '',
    taxId: '',
    billingNotes: '',
    enabledModules: [...DEFAULT_ORGANIZATION_MODULES],
    defaultMemberModules: [...DEFAULT_MEMBER_MODULES],
    allowSelfSignUp: false,
    requireAdminApproval: true,
    allowedEmailDomains: '',
    enforceMfa: false,
    seatLimit: '',
    adminName: '',
    adminEmail: '',
    sendInvite: true,
  }
}

function formFromOrganization(organization: Organization): FormState {
  return {
    ...emptyForm(),
    name: organization.name,
    code: organization.code,
    type: organization.type,
    status: organization.status,
    description: organization.description,
    industry: organization.industry,
    size: organization.size,
    website: organization.website,
    logoUrl: organization.logoUrl,
    contactEmail: organization.contactEmail,
    contactPhone: organization.contactPhone,
    line1: organization.address.line1,
    line2: organization.address.line2,
    city: organization.address.city,
    state: organization.address.state,
    postalCode: organization.address.postalCode,
    country: organization.address.country,
    billingPlan: organization.billing.plan,
    currency: organization.billing.currency,
    renewalAt: organization.billing.renewalAt?.slice(0, 10) ?? '',
    taxId: organization.billing.taxId,
    billingNotes: organization.billing.notes,
    enabledModules: organization.enabledModules,
    defaultMemberModules: organization.defaultMemberModules,
    allowSelfSignUp: organization.settings.allowSelfSignUp,
    requireAdminApproval: organization.settings.requireAdminApproval,
    allowedEmailDomains: organization.settings.allowedEmailDomains.join(', '),
    enforceMfa: organization.settings.enforceMfa,
    seatLimit:
      organization.settings.seatLimit === null
        ? ''
        : String(organization.settings.seatLimit),
  }
}

function parseDomains(value: string): string[] {
  return value
    .split(/[\s,;]+/)
    .map((entry) => entry.trim().replace(/^@/, '').toLowerCase())
    .filter(Boolean)
}

/**
 * One sheet for creating and editing an organization. Editing sends only the
 * fields that changed alongside the record version the form was opened with,
 * so two administrators cannot silently overwrite each other.
 */
export function OrganizationFormSheet({
  open,
  onOpenChange,
  organization,
  onSaved,
  onAdminProvisioned,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Absent when creating. */
  organization?: Organization | null
  onSaved: (organization: Organization) => void
  onAdminProvisioned: (result: {
    email: string
    temporaryPassword?: string
    emailDelivered?: boolean
  }) => void
}) {
  const isEdit = Boolean(organization)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    // Reloading the form from the record each time the sheet opens keeps the
    // optimistic-concurrency token in step with what is on screen.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(organization ? formFromOrganization(organization) : emptyForm())
    setError(null)
  }, [open, organization])

  function set<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  // Members can only default into modules the organization itself holds.
  const memberCeiling = useMemo(
    () => form.enabledModules,
    [form.enabledModules]
  )

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm((current) => {
      const allowed = new Set(current.enabledModules)
      const next = current.defaultMemberModules.filter((module) =>
        allowed.has(module)
      )
      return next.length === current.defaultMemberModules.length
        ? current
        : { ...current, defaultMemberModules: next }
    })
  }, [form.enabledModules])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setError(null)

    const shared = {
      name: form.name.trim(),
      type: form.type,
      status: form.status,
      description: form.description.trim(),
      industry: form.industry.trim(),
      size: form.size,
      website: form.website.trim(),
      logoUrl: form.logoUrl.trim(),
      contactEmail: form.contactEmail.trim(),
      contactPhone: form.contactPhone.trim(),
      address: {
        line1: form.line1.trim(),
        line2: form.line2.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        postalCode: form.postalCode.trim(),
        country: form.country.trim(),
      },
      billing: {
        plan: form.billingPlan,
        currency: form.currency.trim(),
        renewalAt: form.renewalAt,
        taxId: form.taxId.trim(),
        notes: form.billingNotes.trim(),
      },
      enabledModules: form.enabledModules,
      defaultMemberModules: form.defaultMemberModules,
      settings: {
        allowSelfSignUp: form.allowSelfSignUp,
        requireAdminApproval: form.requireAdminApproval,
        allowedEmailDomains: parseDomains(form.allowedEmailDomains),
        enforceMfa: form.enforceMfa,
        seatLimit: form.seatLimit.trim()
          ? Number(form.seatLimit.trim())
          : null,
      },
    }

    try {
      if (isEdit && organization) {
        const response = await updateOrganization(organization.id, {
          ...shared,
          code: form.code,
          expectedUpdatedAt: organization.updatedAt,
        })
        response.warnings?.forEach((warning) => toast.warning(warning))
        toast.success(`${response.organization.name} updated.`)
        onSaved(response.organization)
      } else {
        const response = await createOrganization({
          ...shared,
          code: form.code,
          ...(form.adminEmail.trim() && form.adminName.trim()
            ? {
                admin: {
                  email: form.adminEmail.trim(),
                  name: form.adminName.trim(),
                  sendInvite: form.sendInvite,
                },
              }
            : {}),
        })
        toast.success(`${response.organization.name} created.`)
        onSaved(response.organization)

        if (response.admin.created && response.admin.email) {
          onAdminProvisioned({
            email: response.admin.email,
            temporaryPassword: response.admin.temporaryPassword,
            emailDelivered: response.admin.emailDelivered,
          })
        } else if (response.admin.error) {
          toast.error(`Organization created, but: ${response.admin.error}`)
        }
      }
      onOpenChange(false)
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Could not save the organization.'
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col gap-0 p-0 sm:max-w-2xl'>
        <SheetHeader className='border-b'>
          <SheetTitle>
            {isEdit ? `Edit ${organization?.name}` : 'New organization'}
          </SheetTitle>
          <SheetDescription>
            {isEdit
              ? 'Update the profile, module entitlements, and joining policy for this tenant.'
              : 'Connect a client or partner organization and optionally invite its first administrator.'}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={submit}
          className='flex min-h-0 flex-1 flex-col'
          id='organization-form'
        >
          <Tabs
            defaultValue='profile'
            className='flex min-h-0 flex-1 flex-col gap-0'
          >
            <div className='border-b px-4 py-3'>
              <TabsList>
                <TabsTrigger value='profile'>Profile</TabsTrigger>
                <TabsTrigger value='modules'>Modules</TabsTrigger>
                <TabsTrigger value='policy'>Policy &amp; billing</TabsTrigger>
                {!isEdit && (
                  <TabsTrigger value='admin'>Administrator</TabsTrigger>
                )}
              </TabsList>
            </div>

            <div className='@container/org min-h-0 flex-1 overflow-y-auto p-4'>
              <TabsContent value='profile' className='mt-0 space-y-4'>
                <div className='grid gap-4 @xl/org:grid-cols-2'>
                  <Field label='Organization name' htmlFor='org-name' required>
                    <Input
                      id='org-name'
                      value={form.name}
                      required
                      minLength={2}
                      maxLength={120}
                      onChange={(event) => {
                        const name = event.target.value
                        setForm((current) => ({
                          ...current,
                          name,
                          // The code is only auto-filled while it is untouched.
                          code:
                            !isEdit &&
                            (current.code === '' ||
                              current.code === suggestOrganizationCode(current.name))
                              ? suggestOrganizationCode(name)
                              : current.code,
                        }))
                      }}
                      placeholder='Acme Studios'
                    />
                  </Field>
                  <Field
                    label='Organization code'
                    htmlFor='org-code'
                    required
                    hint='Members type this when they sign up. Letters, numbers, and hyphens.'
                  >
                    <Input
                      id='org-code'
                      value={form.code}
                      required
                      minLength={2}
                      maxLength={16}
                      disabled={organization?.isSystemOrg}
                      onChange={(event) =>
                        set('code', event.target.value.toUpperCase())
                      }
                      placeholder='ACME'
                      className='font-mono'
                    />
                  </Field>
                  <Field label='Type' htmlFor='org-type'>
                    <Select
                      value={form.type}
                      onValueChange={(value) => set('type', value)}
                    >
                      <SelectTrigger id='org-type' className='w-full'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ORGANIZATION_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {ORGANIZATION_TYPE_LABELS[type]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label='Status' htmlFor='org-status'>
                    <Select
                      value={form.status}
                      onValueChange={(value) => set('status', value)}
                      disabled={organization?.isSystemOrg}
                    >
                      <SelectTrigger id='org-status' className='w-full'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ORGANIZATION_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {ORGANIZATION_STATUS_LABELS[status]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label='Industry' htmlFor='org-industry'>
                    <Input
                      id='org-industry'
                      value={form.industry}
                      maxLength={80}
                      onChange={(event) => set('industry', event.target.value)}
                      placeholder='Advertising'
                    />
                  </Field>
                  <Field label='Team size' htmlFor='org-size'>
                    <Select
                      value={form.size || 'unset'}
                      onValueChange={(value) =>
                        set('size', value === 'unset' ? '' : value)
                      }
                    >
                      <SelectTrigger id='org-size' className='w-full'>
                        <SelectValue placeholder='Not specified' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='unset'>Not specified</SelectItem>
                        {ORGANIZATION_SIZES.map((size) => (
                          <SelectItem key={size} value={size}>
                            {size} people
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label='Contact email' htmlFor='org-email'>
                    <Input
                      id='org-email'
                      type='email'
                      value={form.contactEmail}
                      onChange={(event) =>
                        set('contactEmail', event.target.value)
                      }
                      placeholder='ops@acme.com'
                    />
                  </Field>
                  <Field label='Contact phone' htmlFor='org-phone'>
                    <Input
                      id='org-phone'
                      value={form.contactPhone}
                      maxLength={32}
                      onChange={(event) =>
                        set('contactPhone', event.target.value)
                      }
                    />
                  </Field>
                  <Field label='Website' htmlFor='org-website'>
                    <Input
                      id='org-website'
                      value={form.website}
                      onChange={(event) => set('website', event.target.value)}
                      placeholder='https://acme.com'
                    />
                  </Field>
                  <Field label='Logo URL' htmlFor='org-logo'>
                    <Input
                      id='org-logo'
                      value={form.logoUrl}
                      onChange={(event) => set('logoUrl', event.target.value)}
                      placeholder='https://acme.com/logo.png'
                    />
                  </Field>
                </div>

                <Field label='Description' htmlFor='org-description'>
                  <Textarea
                    id='org-description'
                    value={form.description}
                    maxLength={1000}
                    rows={3}
                    onChange={(event) =>
                      set('description', event.target.value)
                    }
                    placeholder='What this organization does and how we work with them.'
                  />
                </Field>

                <fieldset className='space-y-4 rounded-lg border p-4'>
                  <legend className='px-1 text-sm font-medium'>Address</legend>
                  <div className='grid gap-4 @xl/org:grid-cols-2'>
                    <Field label='Address line 1' htmlFor='org-line1'>
                      <Input
                        id='org-line1'
                        value={form.line1}
                        onChange={(event) => set('line1', event.target.value)}
                      />
                    </Field>
                    <Field label='Address line 2' htmlFor='org-line2'>
                      <Input
                        id='org-line2'
                        value={form.line2}
                        onChange={(event) => set('line2', event.target.value)}
                      />
                    </Field>
                    <Field label='City' htmlFor='org-city'>
                      <Input
                        id='org-city'
                        value={form.city}
                        onChange={(event) => set('city', event.target.value)}
                      />
                    </Field>
                    <Field label='State / region' htmlFor='org-state'>
                      <Input
                        id='org-state'
                        value={form.state}
                        onChange={(event) => set('state', event.target.value)}
                      />
                    </Field>
                    <Field label='Postal code' htmlFor='org-postal'>
                      <Input
                        id='org-postal'
                        value={form.postalCode}
                        onChange={(event) =>
                          set('postalCode', event.target.value)
                        }
                      />
                    </Field>
                    <Field label='Country' htmlFor='org-country'>
                      <Input
                        id='org-country'
                        value={form.country}
                        onChange={(event) => set('country', event.target.value)}
                      />
                    </Field>
                  </div>
                </fieldset>
              </TabsContent>

              <TabsContent value='modules' className='mt-0 space-y-6'>
                <div className='rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground'>
                  Entitlements are the ceiling for this tenant. Nobody inside
                  the organization — not even its own administrator — can be
                  granted a module that is switched off here, and removing one
                  immediately narrows every account that had it.
                </div>
                <section className='space-y-3'>
                  <h3 className='text-sm font-medium'>
                    Modules this organization is entitled to
                  </h3>
                  <ModuleAccessPicker
                    idPrefix='org-enabled'
                    value={form.enabledModules}
                    onChange={(next) => set('enabledModules', next)}
                    disabled={isSaving}
                  />
                </section>
                <section className='space-y-3 border-t pt-6'>
                  <h3 className='text-sm font-medium'>
                    Default access for new members
                  </h3>
                  <p className='text-xs text-muted-foreground'>
                    Applied to accounts created without a designation, and to
                    anyone who signs up themselves.
                  </p>
                  <ModuleAccessPicker
                    idPrefix='org-default'
                    value={form.defaultMemberModules}
                    onChange={(next) => set('defaultMemberModules', next)}
                    available={memberCeiling}
                    disabled={isSaving}
                    emptyHint='New members will start with no access at all until someone grants it.'
                  />
                </section>
              </TabsContent>

              <TabsContent value='policy' className='mt-0 space-y-4'>
                <ToggleRow
                  id='org-self-signup'
                  label='Allow self sign-up'
                  description='List this organization on the public sign-up page so people can request access with its code.'
                  checked={form.allowSelfSignUp}
                  onCheckedChange={(value) => set('allowSelfSignUp', value)}
                />
                <ToggleRow
                  id='org-approval'
                  label='Require admin approval'
                  description='Self-registered accounts stay pending — and cannot sign in — until an administrator approves them.'
                  checked={form.requireAdminApproval}
                  onCheckedChange={(value) =>
                    set('requireAdminApproval', value)
                  }
                />
                <ToggleRow
                  id='org-mfa'
                  label='Enforce email MFA'
                  description='Every member of this organization must confirm a one-time code at sign-in.'
                  checked={form.enforceMfa}
                  onCheckedChange={(value) => set('enforceMfa', value)}
                />

                <div className='grid gap-4 @xl/org:grid-cols-2'>
                  <Field
                    label='Allowed email domains'
                    htmlFor='org-domains'
                    hint='Comma separated. Leave empty to accept any domain.'
                  >
                    <Input
                      id='org-domains'
                      value={form.allowedEmailDomains}
                      onChange={(event) =>
                        set('allowedEmailDomains', event.target.value)
                      }
                      placeholder='acme.com, acme.co.uk'
                    />
                  </Field>
                  <Field
                    label='Seat limit'
                    htmlFor='org-seats'
                    hint='Leave empty for unlimited seats.'
                  >
                    <Input
                      id='org-seats'
                      type='number'
                      min={1}
                      value={form.seatLimit}
                      onChange={(event) => set('seatLimit', event.target.value)}
                      placeholder='Unlimited'
                    />
                  </Field>
                  <Field label='Billing plan' htmlFor='org-plan'>
                    <Select
                      value={form.billingPlan}
                      onValueChange={(value) => set('billingPlan', value)}
                    >
                      <SelectTrigger id='org-plan' className='w-full'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BILLING_PLANS.map((plan) => (
                          <SelectItem key={plan} value={plan}>
                            {plan[0]?.toUpperCase()}
                            {plan.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label='Renewal date' htmlFor='org-renewal'>
                    <Input
                      id='org-renewal'
                      type='date'
                      value={form.renewalAt}
                      onChange={(event) => set('renewalAt', event.target.value)}
                    />
                  </Field>
                  <Field label='Currency' htmlFor='org-currency'>
                    <Input
                      id='org-currency'
                      value={form.currency}
                      maxLength={8}
                      onChange={(event) => set('currency', event.target.value)}
                      placeholder='INR'
                    />
                  </Field>
                  <Field label='Tax / GST ID' htmlFor='org-tax'>
                    <Input
                      id='org-tax'
                      value={form.taxId}
                      maxLength={40}
                      onChange={(event) => set('taxId', event.target.value)}
                    />
                  </Field>
                </div>

                <Field label='Billing notes' htmlFor='org-billing-notes'>
                  <Textarea
                    id='org-billing-notes'
                    rows={3}
                    maxLength={500}
                    value={form.billingNotes}
                    onChange={(event) =>
                      set('billingNotes', event.target.value)
                    }
                  />
                </Field>
              </TabsContent>

              {!isEdit && (
                <TabsContent value='admin' className='mt-0 space-y-4'>
                  <div className='rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground'>
                    The first administrator is created with a generated password
                    and invited by email. They can change it after signing in,
                    and they will only be able to hand out modules this
                    organization is entitled to.
                  </div>
                  <div className='grid gap-4 @xl/org:grid-cols-2'>
                    <Field label='Administrator name' htmlFor='org-admin-name'>
                      <Input
                        id='org-admin-name'
                        value={form.adminName}
                        maxLength={80}
                        onChange={(event) =>
                          set('adminName', event.target.value)
                        }
                        placeholder='Priya Sharma'
                      />
                    </Field>
                    <Field
                      label='Administrator email'
                      htmlFor='org-admin-email'
                    >
                      <Input
                        id='org-admin-email'
                        type='email'
                        value={form.adminEmail}
                        onChange={(event) =>
                          set('adminEmail', event.target.value)
                        }
                        placeholder='priya@acme.com'
                      />
                    </Field>
                  </div>
                  <ToggleRow
                    id='org-admin-invite'
                    label='Send the invitation email now'
                    description='Turn this off to create the account silently and share the password yourself.'
                    checked={form.sendInvite}
                    onCheckedChange={(value) => set('sendInvite', value)}
                  />
                </TabsContent>
              )}
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
              {isEdit ? 'Save changes' : 'Create organization'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
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
