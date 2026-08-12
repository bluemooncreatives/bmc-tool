import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { ApiError } from '@/lib/api-client'
import { ORG_ADMIN_BASELINE_MODULES, type ModuleKey } from '@/lib/permissions'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { createOrganizationAdmin } from '../data/api'
import { type Organization } from '../data/types'
import { ModuleAccessPicker } from '../components/shared'

/**
 * Creates an organization administrator from an email address, which is the
 * hand-off point where a tenant starts running itself.
 */
export function OrganizationAdminDialog({
  organization,
  onOpenChange,
  onProvisioned,
}: {
  organization: Organization | null
  onOpenChange: (open: boolean) => void
  onProvisioned: (result: {
    email: string
    temporaryPassword?: string
    emailDelivered?: boolean
  }) => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [phone, setPhone] = useState('')
  const [sendInvite, setSendInvite] = useState(true)
  const [makePrimary, setMakePrimary] = useState(true)
  const [modules, setModules] = useState<ModuleKey[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!organization) return
    const allowed = new Set(organization.enabledModules)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setModules(
      ORG_ADMIN_BASELINE_MODULES.filter((module) => allowed.has(module))
    )
    setName('')
    setEmail('')
    setJobTitle('')
    setPhone('')
    setError(null)
  }, [organization])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!organization) return
    setIsSaving(true)
    setError(null)
    try {
      const response = await createOrganizationAdmin(organization.id, {
        name: name.trim(),
        email: email.trim(),
        jobTitle: jobTitle.trim(),
        phone: phone.trim(),
        grantedModules: modules,
        makePrimaryAdmin: makePrimary,
        sendInvite,
      })
      toast.success(
        `${response.account.email} is now an administrator of ${organization.name}.`
      )
      onProvisioned({
        email: response.account.email,
        temporaryPassword: response.temporaryPassword,
        emailDelivered: response.emailDelivered,
      })
      onOpenChange(false)
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Could not create the administrator.'
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={Boolean(organization)} onOpenChange={onOpenChange}>
      <DialogContent className='flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-2xl'>
        <DialogHeader className='border-b p-6'>
          <DialogTitle>Add an administrator</DialogTitle>
          <DialogDescription>
            {organization
              ? `Creates an account in ${organization.name} (${organization.code}) with a generated password and emails the invitation.`
              : ''}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className='flex min-h-0 flex-1 flex-col'>
          <div className='@container/admin min-h-0 flex-1 space-y-4 overflow-y-auto p-6'>
            <div className='grid gap-4 @xl/admin:grid-cols-2'>
              <div className='space-y-2'>
                <Label htmlFor='admin-name'>
                  Full name<span className='text-destructive'> *</span>
                </Label>
                <Input
                  id='admin-name'
                  value={name}
                  required
                  minLength={2}
                  maxLength={80}
                  onChange={(event) => setName(event.target.value)}
                  placeholder='Priya Sharma'
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='admin-email'>
                  Email<span className='text-destructive'> *</span>
                </Label>
                <Input
                  id='admin-email'
                  type='email'
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder='priya@acme.com'
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='admin-title'>Job title</Label>
                <Input
                  id='admin-title'
                  value={jobTitle}
                  maxLength={80}
                  onChange={(event) => setJobTitle(event.target.value)}
                  placeholder='Operations Lead'
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='admin-phone'>Phone</Label>
                <Input
                  id='admin-phone'
                  value={phone}
                  maxLength={32}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </div>
            </div>

            <div className='flex items-start justify-between gap-4 rounded-lg border p-4'>
              <div className='min-w-0'>
                <Label htmlFor='admin-primary' className='text-sm font-medium'>
                  Make this the primary administrator
                </Label>
                <p className='mt-1 text-xs text-muted-foreground'>
                  The primary administrator is the contact shown against the
                  organization.
                </p>
              </div>
              <Switch
                id='admin-primary'
                checked={makePrimary}
                onCheckedChange={setMakePrimary}
              />
            </div>

            <div className='flex items-start justify-between gap-4 rounded-lg border p-4'>
              <div className='min-w-0'>
                <Label htmlFor='admin-invite' className='text-sm font-medium'>
                  Send the invitation email
                </Label>
                <p className='mt-1 text-xs text-muted-foreground'>
                  If email delivery fails, the generated password is shown to
                  you once so you can pass it on.
                </p>
              </div>
              <Switch
                id='admin-invite'
                checked={sendInvite}
                onCheckedChange={setSendInvite}
              />
            </div>

            <section className='space-y-3 border-t pt-4'>
              <h3 className='text-sm font-medium'>Module access</h3>
              <ModuleAccessPicker
                idPrefix='admin-modules'
                value={modules}
                onChange={setModules}
                available={organization?.enabledModules}
                disabled={isSaving}
              />
            </section>

            {error && (
              <p
                role='alert'
                className='rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive'
              >
                {error}
              </p>
            )}
          </div>

          <DialogFooter className='border-t p-4'>
            <Button
              type='button'
              variant='outline'
              disabled={isSaving}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type='submit' disabled={isSaving}>
              {isSaving && <Loader2 className='animate-spin' />}
              Create administrator
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
