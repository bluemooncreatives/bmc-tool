import { useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ApiError } from '@/lib/api-client'
import { type ModuleKey } from '@/lib/permissions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ModuleAccessPicker } from '../components/shared'
import {
  createDepartment,
  createDesignation,
  deleteDepartment,
  deleteDesignation,
  updateDepartment,
  updateDesignation,
} from '../data/api'
import {
  type Department,
  type Designation,
  type DirectoryResponse,
} from '../data/types'

const NONE = 'none'

type DesignationDraft = {
  id: string | null
  title: string
  code: string
  level: string
  departmentId: string
  description: string
  isDefault: boolean
  modules: ModuleKey[]
}

type DepartmentDraft = {
  id: string | null
  name: string
  code: string
  description: string
  parentDepartmentId: string
  headUserId: string
}

/**
 * Designations and departments for one organization.
 *
 * A designation is a reusable access template: editing its modules
 * recalculates every account holding it, which the API reports back so the
 * administrator sees the blast radius of what they just did.
 */
export function DirectoryTab({
  directory,
  isLoading,
  onChanged,
}: {
  directory: DirectoryResponse | null
  isLoading: boolean
  onChanged: () => void
}) {
  const [designationDraft, setDesignationDraft] =
    useState<DesignationDraft | null>(null)
  const [departmentDraft, setDepartmentDraft] =
    useState<DepartmentDraft | null>(null)
  const [pendingDelete, setPendingDelete] = useState<
    | { kind: 'designation'; record: Designation }
    | { kind: 'department'; record: Department }
    | null
  >(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function saveDesignation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!designationDraft || !directory) return
    setIsSaving(true)
    setError(null)
    try {
      const payload = {
        title: designationDraft.title.trim(),
        code: designationDraft.code.trim(),
        level: Number(designationDraft.level) || 5,
        departmentId:
          designationDraft.departmentId === NONE
            ? null
            : designationDraft.departmentId,
        description: designationDraft.description.trim(),
        defaultModules: designationDraft.modules,
        isDefault: designationDraft.isDefault,
      }

      if (designationDraft.id) {
        const response = await updateDesignation(designationDraft.id, payload)
        toast.success(
          response.recalculatedAccounts
            ? `${response.designation.title} updated. ${response.recalculatedAccounts} account(s) had access recalculated.`
            : `${response.designation.title} updated.`
        )
      } else {
        await createDesignation({
          ...payload,
          organizationId: directory.organization.id,
        })
        toast.success(`${payload.title} created.`)
      }
      setDesignationDraft(null)
      onChanged()
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Could not save the designation.'
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function saveDepartment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!departmentDraft || !directory) return
    setIsSaving(true)
    setError(null)
    try {
      const payload = {
        name: departmentDraft.name.trim(),
        code: departmentDraft.code.trim(),
        description: departmentDraft.description.trim(),
        parentDepartmentId:
          departmentDraft.parentDepartmentId === NONE
            ? null
            : departmentDraft.parentDepartmentId,
        headUserId:
          departmentDraft.headUserId === NONE
            ? null
            : departmentDraft.headUserId,
      }

      if (departmentDraft.id) {
        await updateDepartment(departmentDraft.id, payload)
      } else {
        await createDepartment({
          ...payload,
          organizationId: directory.organization.id,
        })
      }
      toast.success(`${payload.name} saved.`)
      setDepartmentDraft(null)
      onChanged()
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Could not save the department.'
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setIsSaving(true)
    try {
      if (pendingDelete.kind === 'designation') {
        const response = await deleteDesignation(pendingDelete.record.id)
        toast.success(
          `Designation deleted. ${response.affectedAccounts} account(s) lost its inherited access.`
        )
      } else {
        const response = await deleteDepartment(pendingDelete.record.id)
        toast.success(
          `Department deleted. ${response.detachedAccounts} account(s) no longer have a department.`
        )
      }
      setPendingDelete(null)
      onChanged()
    } catch (requestError) {
      toast.error(
        requestError instanceof ApiError
          ? requestError.message
          : 'Could not delete the record.'
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className='space-y-5'>
      <Card>
        <CardHeader className='flex flex-row items-start justify-between gap-3'>
          <div className='min-w-0'>
            <CardTitle className='text-base'>Designations</CardTitle>
            <CardDescription>
              Reusable access templates. Anyone holding a designation inherits
              its modules on top of their own grants.
            </CardDescription>
          </div>
          <Button
            size='sm'
            disabled={!directory}
            onClick={() =>
              setDesignationDraft({
                id: null,
                title: '',
                code: '',
                level: '5',
                departmentId: NONE,
                description: '',
                isDefault: false,
                modules: [],
              })
            }
          >
            <Plus />
            New designation
          </Button>
        </CardHeader>
        <CardContent className='space-y-2'>
          {isLoading && <p className='text-sm text-muted-foreground'>Loading…</p>}
          {!isLoading && directory?.designations.length === 0 && (
            <p className='py-6 text-center text-sm text-muted-foreground'>
              No designations yet.
            </p>
          )}
          {directory?.designations.map((designation) => (
            <div
              key={designation.id}
              className='flex flex-wrap items-center gap-3 rounded-md border p-3'
            >
              <div className='min-w-0 flex-1'>
                <div className='flex flex-wrap items-center gap-2'>
                  <span className='font-medium'>{designation.title}</span>
                  <Badge variant='outline'>Level {designation.level}</Badge>
                  {designation.isDefault && <Badge>Default</Badge>}
                  {designation.memberCount !== undefined && (
                    <Badge variant='secondary'>
                      {designation.memberCount} holder
                      {designation.memberCount === 1 ? '' : 's'}
                    </Badge>
                  )}
                </div>
                <p className='mt-1 text-xs text-muted-foreground'>
                  {designation.defaultModules.length} module
                  {designation.defaultModules.length === 1 ? '' : 's'}
                  {designation.description
                    ? ` · ${designation.description}`
                    : ''}
                </p>
              </div>
              <div className='flex gap-2'>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() =>
                    setDesignationDraft({
                      id: designation.id,
                      title: designation.title,
                      code: designation.code,
                      level: String(designation.level),
                      departmentId: designation.departmentId ?? NONE,
                      description: designation.description,
                      isDefault: designation.isDefault,
                      modules: designation.defaultModules,
                    })
                  }
                >
                  Edit
                </Button>
                <Button
                  size='icon'
                  variant='ghost'
                  aria-label={`Delete ${designation.title}`}
                  onClick={() =>
                    setPendingDelete({
                      kind: 'designation',
                      record: designation,
                    })
                  }
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='flex flex-row items-start justify-between gap-3'>
          <div className='min-w-0'>
            <CardTitle className='text-base'>Departments</CardTitle>
            <CardDescription>
              Where people sit. Departments nest, and deleting one moves its
              children up rather than removing them.
            </CardDescription>
          </div>
          <Button
            size='sm'
            disabled={!directory}
            onClick={() =>
              setDepartmentDraft({
                id: null,
                name: '',
                code: '',
                description: '',
                parentDepartmentId: NONE,
                headUserId: NONE,
              })
            }
          >
            <Plus />
            New department
          </Button>
        </CardHeader>
        <CardContent className='space-y-2'>
          {!isLoading && directory?.departments.length === 0 && (
            <p className='py-6 text-center text-sm text-muted-foreground'>
              No departments yet.
            </p>
          )}
          {directory?.departments.map((department) => (
            <div
              key={department.id}
              className='flex flex-wrap items-center gap-3 rounded-md border p-3'
            >
              <div className='min-w-0 flex-1'>
                <div className='flex flex-wrap items-center gap-2'>
                  <span className='font-medium'>{department.name}</span>
                  {department.code && (
                    <Badge variant='outline'>{department.code}</Badge>
                  )}
                  {department.memberCount !== undefined && (
                    <Badge variant='secondary'>
                      {department.memberCount} member
                      {department.memberCount === 1 ? '' : 's'}
                    </Badge>
                  )}
                </div>
                {department.description && (
                  <p className='mt-1 text-xs text-muted-foreground'>
                    {department.description}
                  </p>
                )}
              </div>
              <div className='flex gap-2'>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() =>
                    setDepartmentDraft({
                      id: department.id,
                      name: department.name,
                      code: department.code,
                      description: department.description,
                      parentDepartmentId:
                        department.parentDepartmentId ?? NONE,
                      headUserId: department.headUserId ?? NONE,
                    })
                  }
                >
                  Edit
                </Button>
                <Button
                  size='icon'
                  variant='ghost'
                  aria-label={`Delete ${department.name}`}
                  onClick={() =>
                    setPendingDelete({ kind: 'department', record: department })
                  }
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <DesignationDialog
        draft={designationDraft}
        directory={directory}
        isSaving={isSaving}
        error={error}
        onChange={setDesignationDraft}
        onClose={() => setDesignationDraft(null)}
        onSubmit={saveDesignation}
      />

      <DepartmentDialog
        draft={departmentDraft}
        directory={directory}
        isSaving={isSaving}
        error={error}
        onChange={setDepartmentDraft}
        onClose={() => setDepartmentDraft(null)}
        onSubmit={saveDepartment}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        destructive
        isLoading={isSaving}
        title={
          pendingDelete?.kind === 'designation'
            ? `Delete the ${pendingDelete.record.title} designation?`
            : `Delete the ${pendingDelete?.record.name} department?`
        }
        desc={
          pendingDelete?.kind === 'designation' ? (
            <span>
              Accounts holding it keep their direct grants but lose everything
              inherited from this template. Their access is recalculated
              immediately.
            </span>
          ) : (
            <span>
              Child departments move up to this one&apos;s parent and members
              simply lose their department. No account is deleted.
            </span>
          )
        }
        confirmText='Delete'
        handleConfirm={() => void confirmDelete()}
      />
    </div>
  )
}

function DesignationDialog({
  draft,
  directory,
  isSaving,
  error,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: DesignationDraft | null
  directory: DirectoryResponse | null
  isSaving: boolean
  error: string | null
  onChange: (draft: DesignationDraft) => void
  onClose: () => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  return (
    <Dialog open={Boolean(draft)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className='flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-2xl'>
        <DialogHeader className='border-b p-6'>
          <DialogTitle>
            {draft?.id ? 'Edit designation' : 'New designation'}
          </DialogTitle>
          <DialogDescription>
            Everyone assigned this designation inherits the modules selected
            here.
          </DialogDescription>
        </DialogHeader>
        {draft && (
          <form onSubmit={onSubmit} className='flex min-h-0 flex-1 flex-col'>
            <div className='@container/des min-h-0 flex-1 space-y-4 overflow-y-auto p-6'>
              <div className='grid gap-4 @xl/des:grid-cols-2'>
                <div className='space-y-2'>
                  <Label htmlFor='designation-title'>
                    Title<span className='text-destructive'> *</span>
                  </Label>
                  <Input
                    id='designation-title'
                    required
                    minLength={2}
                    maxLength={80}
                    value={draft.title}
                    onChange={(event) =>
                      onChange({ ...draft, title: event.target.value })
                    }
                    placeholder='Frontend Developer'
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='designation-code'>Code</Label>
                  <Input
                    id='designation-code'
                    maxLength={24}
                    value={draft.code}
                    onChange={(event) =>
                      onChange({ ...draft, code: event.target.value })
                    }
                    placeholder='FE-DEV'
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='designation-level'>
                    Seniority level (1 is most senior)
                  </Label>
                  <Input
                    id='designation-level'
                    type='number'
                    min={1}
                    max={20}
                    value={draft.level}
                    onChange={(event) =>
                      onChange({ ...draft, level: event.target.value })
                    }
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='designation-department'>Department</Label>
                  <Select
                    value={draft.departmentId}
                    onValueChange={(value) =>
                      onChange({ ...draft, departmentId: value })
                    }
                  >
                    <SelectTrigger
                      id='designation-department'
                      className='w-full'
                    >
                      <SelectValue placeholder='No department' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>No department</SelectItem>
                      {directory?.departments.map((department) => (
                        <SelectItem key={department.id} value={department.id}>
                          {department.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='designation-description'>Description</Label>
                <Textarea
                  id='designation-description'
                  rows={2}
                  maxLength={500}
                  value={draft.description}
                  onChange={(event) =>
                    onChange({ ...draft, description: event.target.value })
                  }
                />
              </div>

              <div className='flex items-start justify-between gap-4 rounded-lg border p-4'>
                <div className='min-w-0'>
                  <Label
                    htmlFor='designation-default'
                    className='text-sm font-medium'
                  >
                    Use as the default for new members
                  </Label>
                  <p className='mt-1 text-xs text-muted-foreground'>
                    Applied to anyone who signs up themselves. Only one
                    designation can be the default.
                  </p>
                </div>
                <Switch
                  id='designation-default'
                  checked={draft.isDefault}
                  onCheckedChange={(value) =>
                    onChange({ ...draft, isDefault: value })
                  }
                />
              </div>

              <section className='space-y-3 border-t pt-4'>
                <h3 className='text-sm font-medium'>Inherited modules</h3>
                <ModuleAccessPicker
                  idPrefix='designation-modules'
                  value={draft.modules}
                  onChange={(modules) => onChange({ ...draft, modules })}
                  available={directory?.organization.enabledModules}
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
                onClick={onClose}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type='submit' disabled={isSaving}>
                {isSaving && <Loader2 className='animate-spin' />}
                Save designation
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

function DepartmentDialog({
  draft,
  directory,
  isSaving,
  error,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: DepartmentDraft | null
  directory: DirectoryResponse | null
  isSaving: boolean
  error: string | null
  onChange: (draft: DepartmentDraft) => void
  onClose: () => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  return (
    <Dialog open={Boolean(draft)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>
            {draft?.id ? 'Edit department' : 'New department'}
          </DialogTitle>
          <DialogDescription>
            Departments give the org chart its structure above individual
            reporting lines.
          </DialogDescription>
        </DialogHeader>
        {draft && (
          <form onSubmit={onSubmit} className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='department-name'>
                Name<span className='text-destructive'> *</span>
              </Label>
              <Input
                id='department-name'
                required
                minLength={2}
                maxLength={80}
                value={draft.name}
                onChange={(event) =>
                  onChange({ ...draft, name: event.target.value })
                }
                placeholder='Engineering'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='department-code'>Code</Label>
              <Input
                id='department-code'
                maxLength={24}
                value={draft.code}
                onChange={(event) =>
                  onChange({ ...draft, code: event.target.value })
                }
                placeholder='ENG'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='department-parent'>Parent department</Label>
              <Select
                value={draft.parentDepartmentId}
                onValueChange={(value) =>
                  onChange({ ...draft, parentDepartmentId: value })
                }
              >
                <SelectTrigger id='department-parent' className='w-full'>
                  <SelectValue placeholder='Top level' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Top level</SelectItem>
                  {directory?.departments
                    .filter((department) => department.id !== draft.id)
                    .map((department) => (
                      <SelectItem key={department.id} value={department.id}>
                        {department.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='department-head'>Department head</Label>
              <Select
                value={draft.headUserId}
                onValueChange={(value) =>
                  onChange({ ...draft, headUserId: value })
                }
              >
                <SelectTrigger id='department-head' className='w-full'>
                  <SelectValue placeholder='Not assigned' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not assigned</SelectItem>
                  {directory?.managers.map((manager) => (
                    <SelectItem key={manager.id} value={manager.id}>
                      {manager.name} — {manager.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='department-description'>Description</Label>
              <Textarea
                id='department-description'
                rows={2}
                maxLength={500}
                value={draft.description}
                onChange={(event) =>
                  onChange({ ...draft, description: event.target.value })
                }
              />
            </div>

            {error && (
              <p
                role='alert'
                className='rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive'
              >
                {error}
              </p>
            )}

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={onClose}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type='submit' disabled={isSaving}>
                {isSaving && <Loader2 className='animate-spin' />}
                Save department
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
