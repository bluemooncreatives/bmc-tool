import { useEffect, useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { ApiError, apiFetch } from '@/lib/api-client'
import { isTaskActive } from '@/lib/tasks'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { SelectDropdown } from '@/components/select-dropdown'
import { resolveOptions } from '../data/data'
import { type Task } from '../data/schema'
import { useTaskOptionsStore } from '../stores/task-options-store'
import { useTasks } from './tasks-provider'

type TaskMutateDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: Task
}

const formSchema = z.object({
  // Only editable when renaming an existing task; new numbers are allocated by
  // the server so that two people creating tasks cannot land on the same one.
  id: z.string().optional(),
  title: z.string().min(1, 'Title is required.'),
  description: z.string().optional(),
  status: z.string().min(1, 'Please select a status.'),
  label: z.string().min(1, 'Please select a label.'),
  priority: z.string().min(1, 'Please choose a priority.'),
  taggedTo: z.string().optional(),
})
type TaskForm = z.infer<typeof formSchema>

type DirectoryUser = { id: string; name: string; email: string }

function getDefaultValues(currentRow?: Task): TaskForm {
  return (
    currentRow ?? {
      title: '',
      description: '',
      status: '',
      label: '',
      priority: '',
      taggedTo: '',
    }
  )
}

export function TasksMutateDrawer({
  open,
  onOpenChange,
  currentRow,
}: TaskMutateDrawerProps) {
  const isUpdate = !!currentRow
  const { createTask, updateTask, scope } = useTasks()
  const currentUser = useAuthStore((s) => s.auth.user)

  const storeLabels = useTaskOptionsStore((s) => s.labels)
  const storeStatuses = useTaskOptionsStore((s) => s.statuses)
  const storePriorities = useTaskOptionsStore((s) => s.priorities)
  const labels = resolveOptions(storeLabels)
  const statuses = resolveOptions(storeStatuses).filter(
    (status) => isUpdate || scope !== 'active' || isTaskActive(status.value)
  )
  const priorities = resolveOptions(storePriorities)

  const [directory, setDirectory] = useState<DirectoryUser[]>([])
  useEffect(() => {
    let cancelled = false
    apiFetch<{ users: DirectoryUser[] }>('/api/users/directory')
      .then((response) => {
        if (!cancelled) setDirectory(response.users)
      })
      .catch(() => {
        // Assignee picker degrades to a free empty list; not worth surfacing an error for.
      })
    return () => {
      cancelled = true
    }
  }, [])
  const taggedToItems = directory.map((user) => ({
    label: user.name,
    value: user.email,
  }))

  const taggedByDisplay = isUpdate
    ? currentRow.taggedBy
    : currentUser
      ? [currentUser.firstName, currentUser.lastName]
          .filter(Boolean)
          .join(' ')
          .trim() || currentUser.email
      : ''

  const form = useForm<TaskForm>({
    resolver: zodResolver(formSchema),
    defaultValues: getDefaultValues(currentRow),
  })

  useEffect(() => {
    if (!open) return
    form.reset(getDefaultValues(currentRow))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentRow])

  const onSubmit = async (data: TaskForm) => {
    try {
      if (isUpdate && currentRow) {
        await updateTask(currentRow.id, data)
        toast.success('Task updated.')
      } else {
        await createTask(data)
        toast.success('Task created.')
      }
      onOpenChange(false)
      form.reset()
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : 'Could not save the task.'
      )
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        form.reset()
      }}
    >
      <SheetContent className='flex flex-col'>
        <SheetHeader className='text-start'>
          <SheetTitle>{isUpdate ? 'Update' : 'Create'} Task</SheetTitle>
          <SheetDescription>
            {isUpdate
              ? 'Update the task by providing necessary info.'
              : 'Add a new task by providing necessary info.'}
            Click save when you&apos;re done.
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            id='tasks-form'
            onSubmit={form.handleSubmit(onSubmit)}
            className='flex-1 space-y-6 overflow-y-auto px-4'
          >
            {isUpdate && (
              <FormField
                control={form.control}
                name='id'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Task Number</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder='e.g. TASK-1234' />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name='title'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder='Enter a title' />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='description'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder='Add more detail about this task'
                      className='min-h-24 resize-none'
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='status'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <SelectDropdown
                    defaultValue={field.value}
                    onValueChange={field.onChange}
                    placeholder='Select status'
                    items={statuses}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='label'
              render={({ field }) => (
                <FormItem className='relative'>
                  <FormLabel>Label</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className='flex flex-col space-y-1'
                    >
                      {labels.map((label) => (
                        <FormItem
                          key={label.value}
                          className='flex items-center'
                        >
                          <FormControl>
                            <RadioGroupItem value={label.value} />
                          </FormControl>
                          <FormLabel className='flex items-center gap-1.5 font-normal'>
                            {label.icon && (
                              <label.icon
                                className={cn('size-4', label.color)}
                              />
                            )}
                            {label.label}
                          </FormLabel>
                        </FormItem>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='priority'
              render={({ field }) => (
                <FormItem className='relative'>
                  <FormLabel>Priority</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className='flex flex-col space-y-1'
                    >
                      {priorities.map((priority) => (
                        <FormItem
                          key={priority.value}
                          className='flex items-center'
                        >
                          <FormControl>
                            <RadioGroupItem value={priority.value} />
                          </FormControl>
                          <FormLabel className='flex items-center gap-1.5 font-normal'>
                            {priority.icon && (
                              <priority.icon
                                className={cn('size-4', priority.color)}
                              />
                            )}
                            {priority.label}
                          </FormLabel>
                        </FormItem>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormItem>
              <FormLabel>Tagged By</FormLabel>
              <FormControl>
                <Input value={taggedByDisplay} disabled readOnly />
              </FormControl>
            </FormItem>
            <FormField
              control={form.control}
              name='taggedTo'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tagged To</FormLabel>
                  <SelectDropdown
                    defaultValue={field.value}
                    onValueChange={field.onChange}
                    placeholder='Unassigned'
                    items={taggedToItems}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <SheetFooter className='gap-2'>
          <SheetClose asChild>
            <Button variant='outline'>Close</Button>
          </SheetClose>
          <Button
            form='tasks-form'
            type='submit'
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? 'Saving...' : 'Save changes'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
